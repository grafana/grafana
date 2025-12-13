package resource

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Some list queries can be calculated with simple reads or search index
func (s *server) tryFieldSelector(ctx context.Context, req *resourcepb.ListRequest) *resourcepb.ListResponse {
	if req.Source != resourcepb.ListRequest_STORE || req.Options.Key.Namespace == "" {
		return nil
	}

	var names []string
	for _, v := range req.Options.Fields {
		if v.Key == "metadata.name" && v.Operator == `=` {
			names = v.Values
		}

		// Search by owner reference
		if v.Key == "search.ownerReference" {
			if len(req.Options.Fields) > 1 {
				return &resourcepb.ListResponse{
					Error: NewBadRequestError("multiple fields found"),
				}
			}

			results, err := s.Search(ctx, &resourcepb.ResourceSearchRequest{
				Fields: []string{}, // no extra fields
				Options: &resourcepb.ListOptions{
					Key: req.Options.Key,
					Fields: []*resourcepb.Requirement{{
						Key:      SEARCH_FIELD_OWNER_REFERENCES,
						Operator: v.Operator,
						Values:   v.Values,
					}},
				},
			})
			if err != nil {
				return &resourcepb.ListResponse{
					Error: AsErrorResult(err),
				}
			}
			if len(results.Results.Rows) < 1 { // nothing found
				return &resourcepb.ListResponse{
					ResourceVersion: 1, // TODO, search result should include when it was indexed
				}
			}
			for _, res := range results.Results.Rows {
				names = append(names, res.Key.Name)
			}
		}
	}

	// The required names
	if len(names) > 0 {
		read := &resourcepb.ReadRequest{
			Key:             req.Options.Key,
			ResourceVersion: req.ResourceVersion,
		}
		rsp := &resourcepb.ListResponse{
			ResourceVersion: 1, // TODO, search result should include when it was indexed
		}
		for _, name := range names {
			read.Key.Name = name
			found, err := s.Read(ctx, read)
			if err != nil {
				return &resourcepb.ListResponse{Error: AsErrorResult(err)}
			}
			if len(found.Value) > 0 {
				rsp.Items = append(rsp.Items, &resourcepb.ResourceWrapper{
					Value:           found.Value,
					ResourceVersion: found.ResourceVersion,
				})
			}
		}
		return rsp
	}
	return nil
}
