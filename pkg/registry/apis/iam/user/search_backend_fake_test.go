package user

import (
	"context"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/org"
)

// fakeSearchBackend supports search and validation tests without an index client.
type fakeSearchBackend struct {
	SearchFunc func(context.Context, SearchQuery) (*iamv0.GetSearchUsersResponse, error)
	Users      []*org.OrgUserDTO
}

func (c *fakeSearchBackend) Search(ctx context.Context, query SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
	if c.SearchFunc != nil {
		return c.SearchFunc(ctx, query)
	}

	var value string
	if query.Email != nil {
		value = *query.Email
	} else if query.Login != nil {
		value = *query.Login
	}

	result := iamv0.NewGetSearchUsersResponse()
	for _, u := range c.Users {
		if u.Login == value || u.Email == value {
			result.Hits = append(result.Hits, iamv0.GetSearchUsersUserHit{Name: u.UID})
		}
	}
	result.TotalHits = int64(len(result.Hits))
	return result, nil
}
