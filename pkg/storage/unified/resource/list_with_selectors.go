package resource

import (
	"context"
	"net/http"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/selection"
)

func (s *server) listWithSelectors(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.server.ListWithFieldSelectors")
	defer span.End()

	if req.Options.Key.Namespace == "" {
		return &resourcepb.ListResponse{
			Error: NewBadRequestError("namespace must be specified for list with filter"),
		}, nil
	}

	for _, v := range req.Options.Fields {
		v.Key = SEARCH_SELECTABLE_FIELDS_PREFIX + v.Key
	}

	srq := &resourcepb.ResourceSearchRequest{
		Options: req.Options,
		Limit:   req.Limit,
	}

	var listRv int64
	if req.NextPageToken != "" {
		span.AddEvent("continue token present")
		token, err := GetContinueToken(req.NextPageToken)
		if err != nil {
			return &resourcepb.ListResponse{
				Error: NewBadRequestError("invalid continue token"),
			}, nil
		}
		if tokenFromOtherListPath(token, true) {
			return &resourcepb.ListResponse{
				Error: NewBadRequestError("continue token was not issued for a search-backed list"),
			}, nil
		}
		listRv = token.ResourceVersion
		srq.SearchAfter = token.SearchAfter
		srq.SearchBefore = token.SearchBefore
	}

	var searchResp *resourcepb.ResourceSearchResponse
	var err error
	if s.search != nil {
		// Use local search service
		searchResp, err = s.search.Search(ctx, srq)
	} else {
		// Use remote search service
		// useSelectorSearch() already checks that either s.search or s.searchClient is set
		searchResp, err = s.searchClient.Search(ctx, srq)
	}
	if err != nil {
		return nil, err
	}
	span.AddEvent("search finished", trace.WithAttributes(attribute.Int64("total_hits", searchResp.TotalHits)))

	// If it's the first page, set the listRv to the search response RV
	if listRv <= 0 {
		listRv = searchResp.ResourceVersion
	}

	pageBytes := 0
	rsp := &resourcepb.ListResponse{
		ResourceVersion: listRv,
	}

	s.log.Info("Search used for List with selectors", "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "search_hits", searchResp.TotalHits, "with_pagination", req.NextPageToken != "", "search_after", srq.SearchAfter, "selectable_fields", req.Options.Fields, "labels", req.Options.Labels)
	// Using searchResp.GetResults().GetRows() will not panic if anything is nil on the path.
	for _, row := range searchResp.GetResults().GetRows() {
		// TODO: use batch reads
		// The Read() will also handle permission checks here
		val, err := s.Read(ctx, &resourcepb.ReadRequest{
			Key:             row.Key,
			ResourceVersion: row.ResourceVersion,
		})
		if err := ErrorFromResponse(val.GetError(), err); err != nil {
			resErr := AsErrorResult(err)
			if resErr.Code == http.StatusForbidden {
				continue
			}
			return &resourcepb.ListResponse{Error: resErr}, nil
		}
		pageBytes += len(val.Value)
		rsp.Items = append(rsp.Items, &resourcepb.ResourceWrapper{
			Value:           val.Value,
			ResourceVersion: val.ResourceVersion,
		})
		if (req.Limit > 0 && len(rsp.Items) >= int(req.Limit)) || pageBytes >= s.maxPageSizeBytes {
			token, err := NewSearchContinueToken(row.GetSortFields(), listRv)
			if err != nil {
				return &resourcepb.ListResponse{
					Error: NewBadRequestError("invalid continue token"),
				}, nil
			}
			rsp.NextPageToken = token
			return rsp, nil
		}
	}

	return rsp, nil
}

// tokenFromOtherListPath reports whether a continue token was issued by the other
// list path. The two encode a position differently, sort values against the index
// and a name against the store, so continuing with the wrong one would silently
// restart from the first result.
func tokenFromOtherListPath(token *ContinueToken, searchPath bool) bool {
	if searchPath {
		return token.Name != "" || token.Namespace != ""
	}
	return len(token.SearchAfter) > 0 || len(token.SearchBefore) > 0
}

// filterSelectors drops the requirements the index cannot answer, so a request
// carrying one of them is still served rather than refused. Callers re-apply the
// selector to the returned objects, so a dropped requirement costs extra reads
// rather than correctness.
func filterSelectors(req *resourcepb.ListRequest) *resourcepb.ListRequest {
	fields := make([]*resourcepb.Requirement, 0, len(req.Options.Fields))
	for _, f := range req.Options.Fields {
		// metadata.namespace is already in the request key.
		if (f.Operator != "=" && f.Operator != "==") || f.Key == "metadata.namespace" {
			continue
		}
		fields = append(fields, f)
	}
	req.Options.Fields = fields

	labels := make([]*resourcepb.Requirement, 0, len(req.Options.Labels))
	for _, l := range req.Options.Labels {
		if !indexableSelectorOperator(l.Operator) {
			continue
		}
		labels = append(labels, l)
	}
	req.Options.Labels = labels

	return req
}

// indexableSelectorOperator reports whether requirementQuery can turn the operator
// into an index query. A label selector may also carry !=, key and !key.
func indexableSelectorOperator(op string) bool {
	switch selection.Operator(op) {
	case selection.Equals, selection.DoubleEquals, selection.In, selection.NotIn:
		return true
	default:
		return false
	}
}

func (s *server) useSelectorSearch(req *resourcepb.ListRequest) bool {
	if (s.searchClient == nil && s.search == nil) || req.Source != resourcepb.ListRequest_STORE {
		return false
	}
	// An index covers one namespace, so a cross-namespace list stays on the store
	// scan, which supports it.
	if req.Options.Key.Namespace == "" {
		return false
	}
	if len(req.Options.Fields) == 0 && len(req.Options.Labels) == 0 {
		return false
	}

	if req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_Exact || req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_NotOlderThan {
		return false
	}

	// TODO have a way of including enterprise manifests
	manifests := AppManifestsWithKinds(AppManifests())
	return slices.ContainsFunc(manifests, func(m app.Manifest) bool {
		return m.ManifestData.Group == req.Options.Key.Group
	})
}
