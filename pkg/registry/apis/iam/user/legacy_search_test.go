package user

import (
	"errors"
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/searchusers/sortopts"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestUserLegacySearchClient_Search(t *testing.T) {
	login, email := "testlogin", "test@example.com"
	tests := []struct {
		name  string
		query SearchQuery
		want  string
	}{
		{name: "free text", query: SearchQuery{Query: "test user"}, want: "test user"},
		{name: "login lookup", query: SearchQuery{Login: &login}, want: login},
		{name: "email lookup", query: SearchQuery{Email: &email}, want: email},
		{name: "legacy wildcard matching", query: SearchQuery{Query: `test*?\user`}, want: "testuser"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := orgtest.NewMockService(t)
			client := NewUserLegacySearchClient(service, tracing.InitializeTracerForTest(), &setting.Cfg{})
			requester := &user.SignedInUser{OrgID: 1, UserID: 1}
			ctx := identity.WithRequester(t.Context(), requester)
			tt.query.Limit = 10
			tt.query.Page = 2
			tt.query.Offset = 10
			created := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)
			seen := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)
			service.On("SearchOrgUsers", mock.Anything, mock.MatchedBy(func(q *org.SearchOrgUsersQuery) bool {
				return q.Query == tt.want && q.Limit == 10 && q.Page == 2 && q.OrgID == 1 && q.User == requester
			})).Return(&org.SearchOrgUsersQueryResult{
				OrgUsers: []*org.OrgUserDTO{{
					UID: "uid1", UserID: 42, Name: "Test User", Email: email, Login: login,
					Role: "Viewer", Created: created, LastSeenAt: seen, IsDisabled: true,
				}},
				TotalCount: 25,
			}, nil).Once()

			resp, err := client.Search(ctx, tt.query)

			require.NoError(t, err)
			require.Equal(t, int64(25), resp.TotalHits)
			require.Len(t, resp.Hits, 1)
			hit := resp.Hits[0]
			require.Equal(t, "uid1", hit.Name)
			require.Equal(t, "Test User", hit.Title)
			require.Equal(t, email, hit.Email)
			require.Equal(t, login, hit.Login)
			require.Equal(t, "Viewer", hit.Role)
			require.Equal(t, int64(42), hit.InternalId)
			require.Equal(t, created.UnixMilli(), hit.Created)
			require.Equal(t, seen.Unix(), hit.LastSeenAt)
			require.NotEmpty(t, hit.LastSeenAtAge)
			require.True(t, hit.Disabled)
		})
	}
}

func TestUserLegacySearchClient_Pagination(t *testing.T) {
	for _, tt := range []struct {
		name  string
		query SearchQuery
		err   string
	}{
		{name: "defaults"},
		{name: "limit exceeds maximum", query: SearchQuery{Limit: common.MaxListLimit + 1}, err: "limit cannot be greater"},
		{name: "negative page", query: SearchQuery{Page: -1}, err: "invalid page number"},
		{name: "page overflow", query: SearchQuery{Page: math.MaxInt32 + 1}, err: "invalid page number"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			service := orgtest.NewMockService(t)
			client := NewUserLegacySearchClient(service, tracing.InitializeTracerForTest(), &setting.Cfg{})
			ctx := identity.WithRequester(t.Context(), &user.SignedInUser{OrgID: 1})
			if tt.err == "" {
				service.On("SearchOrgUsers", mock.Anything, mock.MatchedBy(func(q *org.SearchOrgUsersQuery) bool {
					return q.Limit == common.DefaultListLimit && q.Page == 1
				})).Return(&org.SearchOrgUsersQueryResult{}, nil).Once()
			}

			resp, err := client.Search(ctx, tt.query)

			if tt.err != "" {
				require.ErrorContains(t, err, tt.err)
				require.Nil(t, resp)
			} else {
				require.NoError(t, err)
				require.Empty(t, resp.Hits)
			}
		})
	}
}

func TestUserLegacySearchClient_HiddenUsers(t *testing.T) {
	for _, tt := range []struct {
		name      string
		requester *user.SignedInUser
		want      []string
	}{
		{name: "hidden users excluded", requester: &user.SignedInUser{Login: "viewer"}, want: []string{"visible"}},
		{name: "own account included", requester: &user.SignedInUser{Login: "hidden"}, want: []string{"visible", "hidden"}},
		{name: "grafana admin sees all", requester: &user.SignedInUser{Login: "admin", IsGrafanaAdmin: true}, want: []string{"visible", "hidden"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			service := orgtest.NewMockService(t)
			cfg := &setting.Cfg{HiddenUsers: map[string]struct{}{"hidden": {}}}
			client := NewUserLegacySearchClient(service, tracing.InitializeTracerForTest(), cfg)
			ctx := identity.WithRequester(t.Context(), tt.requester)
			service.On("SearchOrgUsers", mock.Anything, mock.Anything).Return(&org.SearchOrgUsersQueryResult{
				TotalCount: 2,
				OrgUsers: []*org.OrgUserDTO{
					{UID: "visible", Login: "visible"},
					{UID: "hidden", Login: "hidden"},
				},
			}, nil).Once()

			resp, err := client.Search(ctx, SearchQuery{})

			require.NoError(t, err)
			names := make([]string, 0, len(resp.Hits))
			for _, hit := range resp.Hits {
				names = append(names, hit.Name)
			}
			require.Equal(t, tt.want, names)
			require.Equal(t, int64(2), resp.TotalHits)
		})
	}
}

func TestUserLegacySearchClient_Error(t *testing.T) {
	service := orgtest.NewMockService(t)
	client := NewUserLegacySearchClient(service, tracing.InitializeTracerForTest(), &setting.Cfg{})
	wantErr := errors.New("org search failed")
	service.On("SearchOrgUsers", mock.Anything, mock.Anything).Return(nil, wantErr).Once()
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{OrgID: 1})

	resp, err := client.Search(ctx, SearchQuery{})

	require.ErrorIs(t, err, wantErr)
	require.Nil(t, resp)
}

func TestLegacyUserSortOptions(t *testing.T) {
	for _, tt := range []struct {
		name string
		sort []string
		want []model.SortOption
	}{
		{name: "empty", want: []model.SortOption{}},
		{name: "title", sort: []string{"title"}, want: []model.SortOption{sortopts.SortOptionsByQueryParam["name-asc"]}},
		{name: "last seen", sort: []string{"-lastSeenAt"}, want: []model.SortOption{sortopts.SortOptionsByQueryParam["lastSeenAtAge-desc"]}},
		{name: "prefixed login", sort: []string{"-fields.login"}, want: []model.SortOption{sortopts.SortOptionsByQueryParam["login-desc"]}},
		{name: "unknown ignored", sort: []string{"unknown"}, want: []model.SortOption{}},
		{name: "legacy ordering", sort: []string{"title", "-email", "login"}, want: []model.SortOption{
			sortopts.SortOptionsByQueryParam["login-asc"],
			sortopts.SortOptionsByQueryParam["email-desc"],
			sortopts.SortOptionsByQueryParam["name-asc"],
		}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, legacyUserSortOptions(tt.sort))
		})
	}
}
