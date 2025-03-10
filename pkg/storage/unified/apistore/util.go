// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apistore

import (
	"bytes"
	"fmt"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func toListRequest(k *resource.ResourceKey, opts storage.ListOptions) (*resource.ListRequest, storage.SelectionPredicate, error) {
	predicate := opts.Predicate
	req := &resource.ListRequest{
		Limit: opts.Predicate.Limit,
		Options: &resource.ListOptions{
			Key: k,
		},
		NextPageToken: predicate.Continue,
	}

	if opts.Predicate.Label != nil && !opts.Predicate.Label.Empty() {
		requirements, selectable := opts.Predicate.Label.Requirements()
		if !selectable {
			return nil, predicate, nil // not selectable
		}

		for _, r := range requirements {
			v := r.Key()

			// Parse the history request from labels
			if v == utils.LabelKeyGetHistory || v == utils.LabelKeyGetTrash {
				if len(requirements) != 1 {
					return nil, predicate, apierrors.NewBadRequest("single label supported with: " + v)
				}
				if !opts.Predicate.Field.Empty() {
					return nil, predicate, apierrors.NewBadRequest("field selector not supported with: " + v)
				}
				if r.Operator() != selection.Equals {
					return nil, predicate, apierrors.NewBadRequest("only = operator supported with: " + v)
				}

				vals := r.Values().List()
				if len(vals) != 1 {
					return nil, predicate, apierrors.NewBadRequest("expecting single value for: " + v)
				}

				if v == utils.LabelKeyGetTrash {
					req.Source = resource.ListRequest_TRASH
					if vals[0] != "true" {
						return nil, predicate, apierrors.NewBadRequest("expecting true for: " + v)
					}
				} else {
					req.Source = resource.ListRequest_HISTORY
					req.Options.Key.Name = vals[0]
				}

				req.Options.Labels = nil
				req.Options.Fields = nil
				return req, storage.Everything, nil
			}

			req.Options.Labels = append(req.Options.Labels, &resource.Requirement{
				Key:      v,
				Operator: string(r.Operator()),
				Values:   r.Values().List(),
			})
		}
	}

	if opts.Predicate.Field != nil && !opts.Predicate.Field.Empty() {
		requirements := opts.Predicate.Field.Requirements()
		for _, r := range requirements {
			requirement := &resource.Requirement{Key: r.Field, Operator: string(r.Operator)}
			if r.Value != "" {
				requirement.Values = append(requirement.Values, r.Value)
			}
			req.Options.Labels = append(req.Options.Labels, requirement)
		}
	}

	if opts.ResourceVersion != "" {
		rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return nil, predicate, apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %s", opts.ResourceVersion))
		}
		req.ResourceVersion = rv
	}

	switch opts.ResourceVersionMatch {
	case "", metav1.ResourceVersionMatchNotOlderThan:
		req.VersionMatch = resource.ResourceVersionMatch_NotOlderThan
	case metav1.ResourceVersionMatchExact:
		req.VersionMatch = resource.ResourceVersionMatch_Exact
	default:
		return nil, predicate, apierrors.NewBadRequest(
			fmt.Sprintf("unsupported version match: %v", opts.ResourceVersionMatch),
		)
	}

	return req, predicate, nil
}

func isUnchanged(codec runtime.Codec, obj runtime.Object, newObj runtime.Object) (bool, error) {
	buf := new(bytes.Buffer)
	if err := codec.Encode(obj, buf); err != nil {
		return false, err
	}

	newBuf := new(bytes.Buffer)
	if err := codec.Encode(newObj, newBuf); err != nil {
		return false, err
	}

	return bytes.Equal(buf.Bytes(), newBuf.Bytes()), nil
}
