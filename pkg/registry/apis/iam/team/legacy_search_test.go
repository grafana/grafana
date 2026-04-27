package team

import (
	"context"
	"errors"
	"fmt"
	"math"
	"testing"

	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestLegacyTeamSearchClient_Search(t *testing.T) {
	t.Run("search by query", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, nil, tracing.InitializeTracerForTest())

		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit:  10,
			Page:   1,
			Query:  "test",
			Fields: []string{"name", "email", "provisioned", "externalUID"},
		}

		mockTeamService.ExpectedSearchTeamsResult = team.SearchTeamQueryResult{
			Teams: []*team.TeamDTO{
				{
					UID:           "testTeamUID",
					Name:          "test team",
					Email:         "test@example.com",
					IsProvisioned: true,
					ExternalUID:   "testExternalUID",
				},
			},
			TotalCount: 1,
			Page:       1,
			PerPage:    10,
		}

		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.Equal(t, int64(1), resp.TotalHits)
		require.Len(t, resp.Results.Rows, 1)
		require.Len(t, resp.Results.Columns, 5)
		require.Equal(t, "default", resp.Results.Rows[0].Key.Namespace)
		require.Equal(t, "iam.grafana.app", resp.Results.Rows[0].Key.Group)
		require.Equal(t, "teams", resp.Results.Rows[0].Key.Resource)
		require.Equal(t, "testTeamUID", resp.Results.Rows[0].Key.Name)
		require.Equal(t, "testTeamUID", string(resp.Results.Rows[0].Cells[0]))
		require.Equal(t, "test team", string(resp.Results.Rows[0].Cells[1]))
		require.Equal(t, "test@example.com", string(resp.Results.Rows[0].Cells[2]))
		require.Equal(t, "true", string(resp.Results.Rows[0].Cells[3]))
		require.Equal(t, "testExternalUID", string(resp.Results.Rows[0].Cells[4]))
	})

	t.Run("returns error if page is negative", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, nil, tracing.InitializeTracerForTest())
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  -1,
		}

		_, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Equal(t, "invalid page number: -1", err.Error())
	})

	t.Run("returns error if page is greater than math.MaxInt32", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, nil, tracing.InitializeTracerForTest())
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  math.MaxInt32 + 1,
		}

		_, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Equal(t, "invalid page number: 2147483648", err.Error())
	})

	t.Run("returns error if limit exceeds common.MaxListLimit", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, nil, tracing.InitializeTracerForTest())
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: common.MaxListLimit + 1,
			Page:  1,
		}

		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Equal(t, fmt.Sprintf("limit cannot be greater than %d", common.MaxListLimit), err.Error())
	})

	t.Run("returns error if search teams fails", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, nil, tracing.InitializeTracerForTest())
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  1,
			Query: "test",
		}

		mockTeamService.ExpectedError = errors.New("search teams failed")

		_, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Equal(t, "search teams failed", err.Error())
	})
}

func Test_titleFromRequirements(t *testing.T) {
	t.Run("should extract title from fields", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{Key: res.SEARCH_FIELD_TITLE, Values: []string{"My Team"}},
			},
		}
		title, err := titleFromRequirements(opts)
		require.NoError(t, err)
		require.Equal(t, "My Team", title)
	})

	t.Run("should return empty string when no title requirement", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{Key: "other.field", Values: []string{"value"}},
			},
		}
		title, err := titleFromRequirements(opts)
		require.NoError(t, err)
		require.Equal(t, "", title)
	})

	t.Run("should return error when values are empty", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{Key: res.SEARCH_FIELD_TITLE, Values: []string{}},
			},
		}
		_, err := titleFromRequirements(opts)
		require.EqualError(t, err, "title filter requires exactly one value, got 0")
	})

	t.Run("should return error when multiple values provided", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{Key: res.SEARCH_FIELD_TITLE, Values: []string{"a", "b"}},
			},
		}
		_, err := titleFromRequirements(opts)
		require.EqualError(t, err, "title filter requires exactly one value, got 2")
	})

	t.Run("should return empty string when opts is nil", func(t *testing.T) {
		title, err := titleFromRequirements(nil)
		require.NoError(t, err)
		require.Equal(t, "", title)
	})

	t.Run("should skip nil requirements", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				nil,
				{Key: res.SEARCH_FIELD_TITLE, Values: []string{"Found"}},
			},
		}
		title, err := titleFromRequirements(opts)
		require.NoError(t, err)
		require.Equal(t, "Found", title)
	})
}

func TestLegacyTeamSearchClient_Search_byMember(t *testing.T) {
	memberFilter := func(userUID string) []*resourcepb.Requirement {
		return []*resourcepb.Requirement{{
			Key:    res.SEARCH_FIELD_PREFIX + builders.TEAM_SEARCH_MEMBERS,
			Values: []string{userUID},
		}}
	}

	signedInCtx := func() context.Context {
		return identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
	}

	t.Run("dispatches to ListUserTeams when members filter is set", func(t *testing.T) {
		store := &fakeUserTeamsStore{
			pages: []*legacy.ListUserTeamsResult{{
				Items: []legacy.UserTeam{
					{UID: "team-a", Name: "Team A", Permission: team.PermissionTypeAdmin, External: false},
					{UID: "team-b", Name: "Team B", Permission: team.PermissionTypeMember, External: true},
				},
			}},
		}
		client := NewLegacyTeamSearchClient(teamtest.NewFakeService(), store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Page:    1,
			Options: &resourcepb.ListOptions{Fields: memberFilter("alice")},
		}
		resp, err := client.Search(signedInCtx(), req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "alice", store.lastQuery.UserUID)

		require.Len(t, resp.Results.Columns, 2)
		require.Equal(t, "permission", resp.Results.Columns[0].Name)
		require.Equal(t, "external", resp.Results.Columns[1].Name)

		require.Len(t, resp.Results.Rows, 2)
		require.Equal(t, "team-a", resp.Results.Rows[0].Key.Name)
		require.Equal(t, "iam.grafana.app", resp.Results.Rows[0].Key.Group)
		require.Equal(t, "teams", resp.Results.Rows[0].Key.Resource)
		require.Equal(t, "default", resp.Results.Rows[0].Key.Namespace)
		require.Equal(t, "admin", string(resp.Results.Rows[0].Cells[0]))
		require.Equal(t, "false", string(resp.Results.Rows[0].Cells[1]))
		require.Equal(t, "team-b", resp.Results.Rows[1].Key.Name)
		require.Equal(t, "member", string(resp.Results.Rows[1].Cells[0]))
		require.Equal(t, "true", string(resp.Results.Rows[1].Cells[1]))
	})

	t.Run("paginates by walking the Continue cursor", func(t *testing.T) {
		store := &fakeUserTeamsStore{
			pages: []*legacy.ListUserTeamsResult{
				// Each fake page returns one team and a non-zero Continue token until exhausted.
				{Items: []legacy.UserTeam{{UID: "t1", Permission: team.PermissionTypeMember}}, Continue: 1},
				{Items: []legacy.UserTeam{{UID: "t2", Permission: team.PermissionTypeMember}}, Continue: 2},
				{Items: []legacy.UserTeam{{UID: "t3", Permission: team.PermissionTypeMember}}, Continue: 0},
			},
		}
		client := NewLegacyTeamSearchClient(teamtest.NewFakeService(), store, tracing.InitializeTracerForTest())

		// Page 2, limit 1 -> want offset+limit = 2; need to walk at least two pages.
		req := &resourcepb.ResourceSearchRequest{
			Limit:   1,
			Page:    2,
			Options: &resourcepb.ListOptions{Fields: memberFilter("alice")},
		}
		resp, err := client.Search(signedInCtx(), req)
		require.NoError(t, err)
		require.Len(t, resp.Results.Rows, 1)
		require.Equal(t, "t2", resp.Results.Rows[0].Key.Name)
	})

	t.Run("returns empty window when offset exceeds available items", func(t *testing.T) {
		store := &fakeUserTeamsStore{
			pages: []*legacy.ListUserTeamsResult{{
				Items: []legacy.UserTeam{{UID: "only", Permission: team.PermissionTypeMember}},
			}},
		}
		client := NewLegacyTeamSearchClient(teamtest.NewFakeService(), store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Page:    5,
			Options: &resourcepb.ListOptions{Fields: memberFilter("alice")},
		}
		resp, err := client.Search(signedInCtx(), req)
		require.NoError(t, err)
		require.Empty(t, resp.Results.Rows)
	})

	t.Run("falls through to general search when members filter is absent", func(t *testing.T) {
		// fakeUserTeamsStore would record the call if the dispatcher mistakenly
		// routed to the member branch.
		store := &fakeUserTeamsStore{}
		mockTeamService := teamtest.NewFakeService()
		mockTeamService.ExpectedSearchTeamsResult = team.SearchTeamQueryResult{
			Teams:      []*team.TeamDTO{{UID: "general-team", Name: "general"}},
			TotalCount: 1,
		}
		client := NewLegacyTeamSearchClient(mockTeamService, store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{Limit: 10, Page: 1, Query: "test"}
		resp, err := client.Search(signedInCtx(), req)
		require.NoError(t, err)
		require.Equal(t, int64(1), resp.TotalHits)
		require.Equal(t, "general-team", resp.Results.Rows[0].Key.Name)
		require.Empty(t, store.lastQuery.UserUID, "general path should not call ListUserTeams")
	})

	t.Run("propagates ListUserTeams error", func(t *testing.T) {
		store := &fakeUserTeamsStore{err: errors.New("db down")}
		client := NewLegacyTeamSearchClient(teamtest.NewFakeService(), store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Page:    1,
			Options: &resourcepb.ListOptions{Fields: memberFilter("alice")},
		}
		_, err := client.Search(signedInCtx(), req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "list user teams")
	})

	t.Run("errors when store is not configured", func(t *testing.T) {
		client := NewLegacyTeamSearchClient(teamtest.NewFakeService(), nil, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Page:    1,
			Options: &resourcepb.ListOptions{Fields: memberFilter("alice")},
		}
		_, err := client.Search(signedInCtx(), req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "legacy identity store not configured")
	})
}

// fakeUserTeamsStore is a minimal LegacyIdentityStore that only implements
// ListUserTeams; every other method panics so a misrouted call surfaces loudly.
type fakeUserTeamsStore struct {
	legacy.LegacyIdentityStore
	pages     []*legacy.ListUserTeamsResult
	calls     int
	lastQuery legacy.ListUserTeamsQuery
	err       error
}

func (f *fakeUserTeamsStore) ListUserTeams(_ context.Context, _ claims.NamespaceInfo, q legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
	f.lastQuery = q
	if f.err != nil {
		return nil, f.err
	}
	if f.calls >= len(f.pages) {
		return &legacy.ListUserTeamsResult{}, nil
	}
	page := f.pages[f.calls]
	f.calls++
	return page, nil
}
