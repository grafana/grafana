package resource

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func (s *server) listWithFieldSelectors(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
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
		listRv = token.ResourceVersion
		srq.SearchAfter = token.SearchAfter
		srq.SearchBefore = token.SearchBefore
	}

	searchResp, err := s.searchClient.Search(ctx, srq)
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

	// Using searchResp.GetResults().GetRows() will not panic if anything is nil on the path.
	for _, row := range searchResp.GetResults().GetRows() {
		// TODO: use batch reads
		// The Read() will also handle permission checks here
		val, err := s.Read(ctx, &resourcepb.ReadRequest{
			Key:             row.Key,
			ResourceVersion: row.ResourceVersion,
		})
		if err != nil {
			return &resourcepb.ListResponse{Error: AsErrorResult(err)}, nil
		}
		if val.Error != nil {
			if val.Error.Code == http.StatusForbidden {
				continue
			}
			return &resourcepb.ListResponse{Error: val.Error}, nil
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

	s.log.Info("Search used for List with field selectors", "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "search_hits", searchResp.TotalHits, "with_pagination", req.NextPageToken != "", "selectable_fields", req.Options.Fields)

	return rsp, nil
}

func filterFieldSelectors(req *resourcepb.ListRequest) *resourcepb.ListRequest {
	fields := make([]*resourcepb.Requirement, 0, len(req.Options.Fields))
	for _, f := range req.Options.Fields {
		if (f.Operator != "=" && f.Operator != "==") || f.Key == "metadata.namespace" {
			continue
		}
		fields = append(fields, f)
	}
	req.Options.Fields = fields

	return req
}

func (s *server) useFieldSelectorSearch(req *resourcepb.ListRequest) bool {
	if s.searchClient == nil || req.Source != resourcepb.ListRequest_STORE || len(req.Options.Fields) == 0 {
		return false
	}

	if req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_Exact || req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_NotOlderThan {
		return false
	}

	return true
}
