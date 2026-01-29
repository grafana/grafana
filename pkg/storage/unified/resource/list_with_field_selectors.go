package resource

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func (s *server) listWithFieldSelectors(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
	if req.Options.Key.Namespace == "" {
		return &resourcepb.ListResponse{
			Error: NewBadRequestError("namespace must be specified for list with filter"),
		}, nil
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

	searchResp, err := s.searchClient.Search(ctx, srq)
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
		if len(val.Value) > 0 {
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
	}

	return rsp, nil
}

// Remove metadata.namespace filter from requirement fields, if it's present.
func filterFieldSelectors(req *resourcepb.ListRequest) *resourcepb.ListRequest {
	// Remove metadata.namespace filter from requirement fields, if it's present.
	for ix := 0; ix < len(req.Options.Fields); {
		v := req.Options.Fields[ix]
		if v.Key == "metadata.namespace" && v.Operator == "=" {
			if len(v.Values) == 1 && v.Values[0] == req.Options.Key.Namespace {
				// Remove this requirement from fields, as it's implied by the key.namespace.
				req.Options.Fields = append(req.Options.Fields[:ix], req.Options.Fields[ix+1:]...)
				// Don't increment ix, as we're removing an element from the slice.
				continue
			}
		}
		ix++
	}

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
