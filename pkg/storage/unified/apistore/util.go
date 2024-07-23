// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apistore

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/storage"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func errorWrap(status *resource.ErrorResult) error {
	if status != nil {
		err := &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    status.Code,
			Reason:  metav1.StatusReason(status.Reason),
			Message: status.Message,
		}}
		if status.Details != nil {
			err.ErrStatus.Details = &metav1.StatusDetails{
				Group:             status.Details.Group,
				Kind:              status.Details.Kind,
				Name:              status.Details.Name,
				UID:               types.UID(status.Details.Uid),
				RetryAfterSeconds: status.Details.RetryAfterSeconds,
			}
			for _, c := range status.Details.Causes {
				err.ErrStatus.Details.Causes = append(err.ErrStatus.Details.Causes, metav1.StatusCause{
					Type:    metav1.CauseType(c.Reason),
					Message: c.Message,
					Field:   c.Field,
				})
			}
		}
		return err
	}
	return nil
}

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

func testKeyParser(val string) (*resource.ResourceKey, error) {
	k, err := grafanaregistry.ParseKey(val)
	if err != nil {
		if strings.HasPrefix(val, "pods/") {
			parts := strings.Split(val, "/")
			if len(parts) == 2 {
				err = nil
				k = &grafanaregistry.Key{
					Resource: parts[0], // pods
					Name:     parts[1],
				}
			} else if len(parts) == 3 {
				err = nil
				k = &grafanaregistry.Key{
					Resource:  parts[0], // pods
					Namespace: parts[1],
					Name:      parts[2],
				}
			}
		}
	}
	if err != nil {
		return nil, err
	}
	if k.Group == "" {
		k.Group = "example.apiserver.k8s.io"
	}
	if k.Resource == "" {
		return nil, apierrors.NewInternalError(fmt.Errorf("missing resource in request"))
	}
	return &resource.ResourceKey{
		Namespace: k.Namespace,
		Group:     k.Group,
		Resource:  k.Resource,
		Name:      k.Name,
	}, err
}
