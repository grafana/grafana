// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apistore

import (
	"fmt"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
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

		// Track the search.* requirements so we can drop them from the predicate;
		// they're sent to the server as field filters and don't exist as real labels
		// on the returned objects.
		var residualLabelReqs []labels.Requirement

		for _, r := range requirements {
			v := r.Key()

			// grafana.app/search.* selections are converted to search requests
			if field, ok := strings.CutPrefix(v, utils.LabelKeySearchPrefix); ok {
				switch {
				case strings.HasPrefix(field, "OR."): // Converts to a SHOULD condition in bleve
					return nil, predicate, apierrors.NewBadRequest("OR conditions in search labels are not yet supported: " + v)
				case strings.HasPrefix(field, "AND."):
					field = strings.TrimPrefix(field, "AND.") // the default -- converts to a MUST condition in bleve
				}
				req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
					Key:      field,
					Operator: string(r.Operator()),
					Values:   r.Values().List(),
				})
				continue
			}
			residualLabelReqs = append(residualLabelReqs, r)

			// Parse the history/trash request from labels
			if v == utils.LabelKeyGetHistory || v == utils.LabelKeyGetTrash {
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

		// Rebuild the predicate's label selector without the search.* requirements
		// so they aren't re-applied as client-side label filters.
		if len(residualLabelReqs) != len(requirements) {
			if len(residualLabelReqs) == 0 {
				predicate.Label = labels.NewSelector()
			} else {
				predicate.Label = labels.NewSelector().Add(residualLabelReqs...)
			}
		}
	}

	if opts.Predicate.Field != nil && !opts.Predicate.Field.Empty() {
		requirements := opts.Predicate.Field.Requirements()
		for _, r := range requirements {
			requirement := &resourcepb.Requirement{Key: r.Field, Operator: string(r.Operator)}
			if r.Value != "" {
				requirement.Values = append(requirement.Values, r.Value)
			}
			req.Options.Fields = append(req.Options.Fields, requirement)
		}
	}

	return req, predicate, nil
}
