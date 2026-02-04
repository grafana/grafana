package resource

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func (s *server) listWithFieldSelectors(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
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

	var searchResp *resourcepb.ResourceSearchResponse
	var err error
	if s.search != nil {
		// Use local search service
		searchResp, err = s.search.Search(ctx, srq)
	} else {
		// Use remote search service
		// if search is not configured, searchClient will be set
		searchResp, err = s.searchClient.Search(ctx, srq)
	}
	if err != nil {
		return nil, err
	}

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
	if (s.searchClient == nil && s.search == nil) || req.Source != resourcepb.ListRequest_STORE || len(req.Options.Fields) == 0 {
		return false
	}

	if req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_Exact || req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_NotOlderThan {
		return false
	}

	return true
}
