package team

import (
	"context"
	"errors"
	"fmt"
	"math"
	"testing"

	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

type searchTeamService struct {
	team.Service
	search func(context.Context, *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error)
}

func (s *searchTeamService) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	return s.search(ctx, query)
}

func TestLegacyTeamSearch(t *testing.T) {
	requester := &user.SignedInUser{OrgID: 1, UserID: 2, Namespace: "default"}
	for _, tt := range []struct {
		name      string
		query     SearchQuery
		wantIDs   []int64
		wantLimit int
	}{
		{name: "query", query: SearchQuery{Query: "test", Limit: 10, Page: 2, Offset: 15}, wantLimit: 10},
		{name: "title", query: SearchQuery{Title: "Engineering", Limit: 2, Page: 1}, wantLimit: 2},
		{name: "UIDs", query: SearchQuery{UIDs: []string{"team-1", "team-2"}, Limit: 10, Page: 1}, wantLimit: 10},
		{name: "legacy IDs", query: SearchQuery{TeamIDs: []string{"001", "2"}, Limit: 10, Page: 1}, wantIDs: []int64{1, 2}, wantLimit: 10},
		{name: "defaults", wantLimit: common.DefaultListLimit},
	} {
		t.Run(tt.name, func(t *testing.T) {
			called := false
			service := &searchTeamService{search: func(_ context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
				called = true
				require.Same(t, requester, query.SignedInUser)
				require.Equal(t, int64(1), query.OrgID)
				require.Equal(t, tt.query.Query, query.Query)
				require.Equal(t, tt.query.Title, query.Name)
				require.Equal(t, tt.query.UIDs, query.UIDs)
				require.Equal(t, tt.wantIDs, query.TeamIds)
				require.Equal(t, tt.wantLimit, query.Limit)
				require.Equal(t, int(tt.query.Page), query.Page)
				return team.SearchTeamQueryResult{
					Teams:      []*team.TeamDTO{{ID: 42, UID: "team-1", Name: "Engineering", Email: "team@example.com", IsProvisioned: true, ExternalUID: "external-1"}},
					TotalCount: 5,
				}, nil
			}}
			backend := NewLegacyTeamSearchClient(service, tracing.NewNoopTracerService())
			result, err := backend.Search(identity.WithRequester(t.Context(), requester), tt.query)
			require.NoError(t, err)
			require.True(t, called)
			require.Equal(t, int64(5), result.TotalHits)
			require.Equal(t, tt.query.Offset, result.Offset)
			id := int64(42)
			require.Equal(t, []iamv0.GetSearchTeamsTeamHit{{Name: "team-1", Title: "Engineering", Email: "team@example.com", Provisioned: true, ExternalUID: "external-1", InternalId: &id}}, result.Hits)
		})
	}
}

func TestLegacyTeamSearchErrors(t *testing.T) {
	for _, tt := range []struct {
		name  string
		query SearchQuery
		err   string
	}{
		{name: "negative page", query: SearchQuery{Page: -1}, err: "invalid page number: -1"},
		{name: "large page", query: SearchQuery{Page: math.MaxInt32 + 1}, err: "invalid page number: 2147483648"},
		{name: "large limit", query: SearchQuery{Limit: common.MaxListLimit + 1}, err: fmt.Sprintf("limit cannot be greater than %d", common.MaxListLimit)},
		{name: "invalid ID", query: SearchQuery{TeamIDs: []string{"invalid"}}, err: "invalid legacy team ID"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			service := &searchTeamService{search: func(context.Context, *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
				t.Fatal("invalid query must not reach the service")
				return team.SearchTeamQueryResult{}, nil
			}}
			backend := NewLegacyTeamSearchClient(service, tracing.NewNoopTracerService())
			ctx := identity.WithRequester(t.Context(), &user.SignedInUser{OrgID: 1})
			result, err := backend.Search(ctx, tt.query)
			require.ErrorContains(t, err, tt.err)
			require.Nil(t, result)
		})
	}

	t.Run("service error", func(t *testing.T) {
		wantErr := errors.New("search teams failed")
		service := &searchTeamService{search: func(context.Context, *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
			return team.SearchTeamQueryResult{}, wantErr
		}}
		backend := NewLegacyTeamSearchClient(service, tracing.NewNoopTracerService())
		ctx := identity.WithRequester(t.Context(), &user.SignedInUser{OrgID: 1})
		_, err := backend.Search(ctx, SearchQuery{})
		require.ErrorIs(t, err, wantErr)
	})

	t.Run("missing requester", func(t *testing.T) {
		backend := NewLegacyTeamSearchClient(nil, tracing.NewNoopTracerService())
		_, err := backend.Search(t.Context(), SearchQuery{})
		require.Error(t, err)
	})
}

func TestLegacyTeamSortOptions(t *testing.T) {
	for _, tt := range []struct {
		name string
		sort []string
		want []string
	}{
		{name: "empty", want: []string{}},
		{name: "title", sort: []string{"title"}, want: []string{"name-asc"}},
		{name: "descending", sort: []string{"-title", "-email"}, want: []string{"name-desc", "email-desc"}},
		{name: "legacy priority", sort: []string{"-email", "title"}, want: []string{"name-asc", "email-desc"}},
		{name: "prefixed fields", sort: []string{"fields.email", "-fields.title"}, want: []string{"name-desc", "email-asc"}},
		{name: "unknown ignored", sort: []string{"invalid"}, want: []string{}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			opts := legacyTeamSortOptions(tt.sort)
			names := make([]string, 0, len(opts))
			for _, opt := range opts {
				names = append(names, opt.Name)
			}
			require.Equal(t, tt.want, names)
		})
	}
}
