package team

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/team"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestLegacyUserTeamsSearchClient_Search(t *testing.T) {
	memberFilter := func(userUID string) []*resourcepb.Requirement {
		return []*resourcepb.Requirement{{
			Key:    res.SEARCH_FIELD_PREFIX + builders.TEAM_SEARCH_MEMBERS,
			Values: []string{userUID},
		}}
	}
	keyWithNamespace := &resourcepb.ResourceKey{Namespace: "default"}

	t.Run("returns rows with permission and external cells, sorted by UID, with SortFields populated", func(t *testing.T) {
		// The legacy SQL returns by team.id; the adapter must re-sort by UID
		// so the keyset cursor is consistent with the unified-search path.
		store := &fakeUserTeamsStore{
			pages: []*legacy.ListUserTeamsResult{{
				Items: []legacy.UserTeam{
					{UID: "team-b", Name: "Team B", Permission: team.PermissionTypeMember, External: true},
					{UID: "team-a", Name: "Team A", Permission: team.PermissionTypeAdmin, External: false},
				},
			}},
		}
		client := NewLegacyUserTeamsSearchClient(store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Options: &resourcepb.ListOptions{Key: keyWithNamespace, Fields: memberFilter("alice")},
		}

		resp, err := client.Search(context.Background(), req)

		require.NoError(t, err)
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
		require.Equal(t, []string{"team-a"}, resp.Results.Rows[0].SortFields)
		require.Equal(t, "team-b", resp.Results.Rows[1].Key.Name)
		require.Equal(t, "member", string(resp.Results.Rows[1].Cells[0]))
		require.Equal(t, "true", string(resp.Results.Rows[1].Cells[1]))
		require.Equal(t, []string{"team-b"}, resp.Results.Rows[1].SortFields)
	})

	t.Run("walks every page of the underlying Continue cursor before slicing", func(t *testing.T) {
		store := &fakeUserTeamsStore{
			pages: []*legacy.ListUserTeamsResult{
				{Items: []legacy.UserTeam{{UID: "t1", Permission: team.PermissionTypeMember}}, Continue: 1},
				{Items: []legacy.UserTeam{{UID: "t2", Permission: team.PermissionTypeMember}}, Continue: 2},
				{Items: []legacy.UserTeam{{UID: "t3", Permission: team.PermissionTypeMember}}, Continue: 0},
			},
		}
		client := NewLegacyUserTeamsSearchClient(store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Options: &resourcepb.ListOptions{Key: keyWithNamespace, Fields: memberFilter("alice")},
		}

		resp, err := client.Search(context.Background(), req)
		require.NoError(t, err)
		require.Len(t, resp.Results.Rows, 3)
		require.Equal(t, []string{"t1", "t2", "t3"}, []string{
			resp.Results.Rows[0].Key.Name,
			resp.Results.Rows[1].Key.Name,
			resp.Results.Rows[2].Key.Name,
		})
	})

	t.Run("SearchAfter skips up to and including the matching UID", func(t *testing.T) {
		store := &fakeUserTeamsStore{
			pages: []*legacy.ListUserTeamsResult{{
				Items: []legacy.UserTeam{
					{UID: "t1", Permission: team.PermissionTypeMember},
					{UID: "t2", Permission: team.PermissionTypeMember},
					{UID: "t3", Permission: team.PermissionTypeMember},
					{UID: "t4", Permission: team.PermissionTypeMember},
				},
			}},
		}
		client := NewLegacyUserTeamsSearchClient(store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:       2,
			SearchAfter: []string{"t2"},
			Options:     &resourcepb.ListOptions{Key: keyWithNamespace, Fields: memberFilter("alice")},
		}

		resp, err := client.Search(context.Background(), req)
		require.NoError(t, err)
		require.Len(t, resp.Results.Rows, 2)
		require.Equal(t, "t3", resp.Results.Rows[0].Key.Name)
		require.Equal(t, "t4", resp.Results.Rows[1].Key.Name)
	})

	t.Run("returns empty window when SearchAfter is past the last UID", func(t *testing.T) {
		store := &fakeUserTeamsStore{
			pages: []*legacy.ListUserTeamsResult{{
				Items: []legacy.UserTeam{{UID: "only", Permission: team.PermissionTypeMember}},
			}},
		}
		client := NewLegacyUserTeamsSearchClient(store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:       10,
			SearchAfter: []string{"only"},
			Options:     &resourcepb.ListOptions{Key: keyWithNamespace, Fields: memberFilter("alice")},
		}

		resp, err := client.Search(context.Background(), req)
		require.NoError(t, err)
		require.Empty(t, resp.Results.Rows)
	})

	t.Run("returns empty result when members filter is absent", func(t *testing.T) {
		store := &fakeUserTeamsStore{}
		client := NewLegacyUserTeamsSearchClient(store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Options: &resourcepb.ListOptions{Key: keyWithNamespace},
		}

		resp, err := client.Search(context.Background(), req)
		require.NoError(t, err)
		require.Empty(t, resp.Results.Rows)
		require.Empty(t, store.lastQuery.UserUID, "ListUserTeams should not be called when filter is absent")
	})

	t.Run("returns error if limit exceeds common.MaxListLimit", func(t *testing.T) {
		client := NewLegacyUserTeamsSearchClient(&fakeUserTeamsStore{}, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   common.MaxListLimit + 1,
			Options: &resourcepb.ListOptions{Key: keyWithNamespace, Fields: memberFilter("alice")},
		}

		_, err := client.Search(context.Background(), req)
		require.Error(t, err)
		require.Equal(t, fmt.Sprintf("limit cannot be greater than %d", common.MaxListLimit), err.Error())
	})

	t.Run("returns error when namespace is missing", func(t *testing.T) {
		client := NewLegacyUserTeamsSearchClient(&fakeUserTeamsStore{}, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Options: &resourcepb.ListOptions{Fields: memberFilter("alice")},
		}

		_, err := client.Search(context.Background(), req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing namespace")
	})

	t.Run("propagates ListUserTeams error", func(t *testing.T) {
		store := &fakeUserTeamsStore{err: errors.New("db down")}
		client := NewLegacyUserTeamsSearchClient(store, tracing.InitializeTracerForTest())

		req := &resourcepb.ResourceSearchRequest{
			Limit:   10,
			Options: &resourcepb.ListOptions{Key: keyWithNamespace, Fields: memberFilter("alice")},
		}

		_, err := client.Search(context.Background(), req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "list user teams")
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
