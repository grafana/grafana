package user

import (
	"context"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// FakeUserLegacySearchClient is a fake implementation of UserLegacySearchClient for testing.
type FakeUserLegacySearchClient struct {
	resourcepb.ResourceIndexClient
	SearchFunc func(ctx context.Context, req *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error)
	Users      []*user.UserSearchHitDTO
}

// Search calls the underlying SearchFunc or simulates a search over the Users slice.
func (c *FakeUserLegacySearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	if c.SearchFunc != nil {
		return c.SearchFunc(ctx, req, opts...)
	}

	// Basic filtering for testing purposes
	var filteredUsers []*user.UserSearchHitDTO
	var queryValue string

	for _, field := range req.Options.Fields {
		if len(field.Values) > 0 {
			queryValue = field.Values[0]
			break
		}
	}

	for _, u := range c.Users {
		if u.Login == queryValue || u.Email == queryValue {
			filteredUsers = append(filteredUsers, u)
		}
	}

	rows := make([]*resourcepb.ResourceTableRow, 0, len(filteredUsers))
	for _, u := range filteredUsers {
		rows = append(rows, &resourcepb.ResourceTableRow{
			Key:   getResourceKey(u, req.Options.Key.Namespace),
			Cells: createBaseCells(u, req.Fields),
		})
	}

	return &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: getColumns(req.Fields),
			Rows:    rows,
		},
		TotalHits: int64(len(filteredUsers)),
	}, nil
}
