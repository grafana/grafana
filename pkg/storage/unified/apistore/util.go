// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apistore

import (
	"fmt"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func toListRequest(k *resourcepb.ResourceKey, opts storage.ListOptions) (*resourcepb.ListRequest, storage.SelectionPredicate, error) {
	predicate := opts.Predicate
	req := &resourcepb.ListRequest{
		Limit: opts.Predicate.Limit,
		Options: &resourcepb.ListOptions{
			Key: k,
		},
		NextPageToken: predicate.Continue,
	}

	if opts.ResourceVersion != "" {
		rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return nil, predicate, apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %s", opts.ResourceVersion))
		}
		req.ResourceVersion = rv
	}

	switch opts.ResourceVersionMatch {
	case "":
		req.VersionMatchV2 = resourcepb.ResourceVersionMatchV2_Unset
	case metav1.ResourceVersionMatchNotOlderThan:
		req.VersionMatchV2 = resourcepb.ResourceVersionMatchV2_NotOlderThan
	case metav1.ResourceVersionMatchExact:
		req.VersionMatchV2 = resourcepb.ResourceVersionMatchV2_Exact
	default:
		return nil, predicate, apierrors.NewBadRequest(
			fmt.Sprintf("unsupported version match: %v", opts.ResourceVersionMatch),
		)
	}

	if opts.Predicate.Label != nil && !opts.Predicate.Label.Empty() {
		requirements, selectable := opts.Predicate.Label.Requirements()
		if !selectable {
			return nil, predicate, nil // not selectable
		}

		for _, r := range requirements {
			v := r.Key()

			// Parse the history request from labels
			// TODO: for LabelGetFullpath, we just skip this for unistore. We need a better solution for
			// getting the full path for folders in unistore, without making a request for each parent folder.
			// In modes 0-2 we added this label to indicate that the sql query should return that data as
			// an annotation on the folder. However, this annotation cannot be saved to unified storage, otherwise
			// we will have to recompute annotations for all descendants of a folder during a folder move.
			// While we look for a better solution, unified storage will continue to return all folders & the folder
			// service will get the full path by retrieving each parent folder.
			if v == utils.LabelKeyGetHistory || v == utils.LabelKeyGetTrash || v == utils.LabelGetFullpath {
				if len(requirements) != 1 {
					return nil, predicate, apierrors.NewBadRequest("single label supported with: " + v)
				}
				if r.Operator() != selection.Equals {
					return nil, predicate, apierrors.NewBadRequest("only = operator supported with: " + v)
				}

				vals := r.Values().List()
				if len(vals) != 1 {
					return nil, predicate, apierrors.NewBadRequest("expecting single value for: " + v)
				}

				switch v {
				case utils.LabelKeyGetTrash:
					req.Source = resourcepb.ListRequest_TRASH
					if vals[0] != "true" {
						return nil, predicate, apierrors.NewBadRequest("expecting true for: " + v)
					}
				case utils.LabelKeyGetHistory:
					req.Source = resourcepb.ListRequest_HISTORY
					if opts.Predicate.Field == nil || opts.Predicate.Field.Empty() {
						return nil, predicate, apierrors.NewBadRequest("metadata.name field selector required for history requests")
					}

					fieldRequirements := opts.Predicate.Field.Requirements()
					if len(fieldRequirements) != 1 {
						return nil, predicate, apierrors.NewBadRequest("only one field selector supported for history requests")
					}

					fieldReq := fieldRequirements[0]
					if fieldReq.Field != "metadata.name" {
						return nil, predicate, apierrors.NewBadRequest("metadata.name field selector required for history requests")
					}

					req.Options.Key.Name = fieldReq.Value
				}

				req.Options.Labels = nil
				req.Options.Fields = nil
				return req, storage.Everything, nil
			}

			req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{
				Key:      v,
				Operator: string(r.Operator()),
				Values:   r.Values().List(),
			})
		}
	}

	if opts.Predicate.Field != nil && !opts.Predicate.Field.Empty() {
		requirements := opts.Predicate.Field.Requirements()
		for _, r := range requirements {
			requirement := &resourcepb.Requirement{Key: r.Field, Operator: string(r.Operator)}
			if r.Value != "" {
				requirement.Values = append(requirement.Values, r.Value)
			}
			req.Options.Labels = append(req.Options.Labels, requirement)
		}
	}

	return req, predicate, nil
}
