package user

import (
	"context"
	"errors"
	"fmt"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/team"
)

func TestLegacyUserTeams(t *testing.T) {
	for _, tt := range []struct {
		name  string
		limit int64
		after []string
		want  []string
		next  []string
	}{
		{name: "sorted page", limit: 10, want: []string{"team-a", "team-b", "team-c"}},
		{name: "full page", limit: 2, want: []string{"team-a", "team-b"}, next: []string{"team-b"}},
		{name: "last full page", limit: 2, after: []string{"team-a"}, want: []string{"team-b", "team-c"}, next: []string{"team-c"}},
		{name: "partial page", limit: 2, after: []string{"team-b"}, want: []string{"team-c"}},
		{name: "past last UID", limit: 10, after: []string{"team-c"}},
		{name: "missing cursor team", limit: 10, after: []string{"team-bb"}, want: []string{"team-c"}},
		{name: "default limit", want: []string{"team-a", "team-b", "team-c"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeUserTeamsStore{pages: []*legacy.ListUserTeamsResult{
				{Items: []legacy.UserTeam{{UID: "team-c", Permission: team.PermissionTypeMember}}, Continue: 11},
				{Items: []legacy.UserTeam{{UID: "team-a", Permission: team.PermissionTypeAdmin}}, Continue: 22},
				{Items: []legacy.UserTeam{{UID: "team-b", Permission: team.PermissionTypeMember, External: true}}},
			}}
			backend := NewLegacyUserTeamsBackend(store, tracing.NewNoopTracerService())
			page, err := backend.ListUserTeams(t.Context(), UserTeamsQuery{Namespace: "stacks-1", UserUID: "alice", Limit: tt.limit, After: tt.after})
			require.NoError(t, err)
			require.Equal(t, tt.next, page.Next)
			require.Zero(t, page.ResourceVersion)
			require.Len(t, store.queries, 3)
			for i, cursor := range []int64{0, 11, 22} {
				require.Equal(t, legacy.ListUserTeamsQuery{UserUID: "alice", Pagination: common.Pagination{Limit: 500, Continue: cursor}}, store.queries[i])
			}
			require.Equal(t, int64(1), store.namespace.OrgID)
			require.Equal(t, "stacks-1", store.namespace.Value)
			var names []string
			for _, item := range page.Items {
				names = append(names, item.Team)
				require.Equal(t, "alice", item.User)
				if item.Team == "team-a" {
					require.Equal(t, "admin", item.Permission)
				} else {
					require.Equal(t, "member", item.Permission)
				}
				require.Equal(t, item.Team == "team-b", item.External)
			}
			require.Equal(t, tt.want, names)
		})
	}
}

func TestLegacyUserTeamsEmpty(t *testing.T) {
	for _, uid := range []string{"alice", ""} {
		t.Run(uid, func(t *testing.T) {
			store := &fakeUserTeamsStore{}
			page, err := NewLegacyUserTeamsBackend(store, tracing.NewNoopTracerService()).ListUserTeams(t.Context(), UserTeamsQuery{Namespace: "default", UserUID: uid, Limit: 10})
			require.NoError(t, err)
			require.Equal(t, &UserTeamsPage{}, page)
			if uid == "" {
				require.Empty(t, store.queries)
			}
		})
	}
}

func TestLegacyUserTeamsDefaultPermission(t *testing.T) {
	store := &fakeUserTeamsStore{pages: []*legacy.ListUserTeamsResult{{Items: []legacy.UserTeam{{UID: "team-a"}}}}}
	page, err := NewLegacyUserTeamsBackend(store, tracing.NewNoopTracerService()).ListUserTeams(t.Context(), UserTeamsQuery{Namespace: "default", UserUID: "alice", Limit: 10})
	require.NoError(t, err)
	require.Equal(t, []iamv0.GetUserTeamsUserTeam{{Team: "team-a", User: "alice", Permission: "member"}}, page.Items)
}

func TestLegacyUserTeamsErrors(t *testing.T) {
	for _, tt := range []struct {
		name  string
		query UserTeamsQuery
		err   string
	}{
		{name: "large limit", query: UserTeamsQuery{Limit: common.MaxListLimit + 1}, err: fmt.Sprintf("limit cannot be greater than %d", common.MaxListLimit)},
		{name: "missing namespace", query: UserTeamsQuery{UserUID: "alice"}, err: "missing namespace"},
		{name: "invalid namespace", query: UserTeamsQuery{UserUID: "alice", Namespace: "stacks-abc"}, err: "invalid stack id"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeUserTeamsStore{}
			page, err := NewLegacyUserTeamsBackend(store, tracing.NewNoopTracerService()).ListUserTeams(t.Context(), tt.query)
			require.ErrorContains(t, err, tt.err)
			require.Nil(t, page)
			require.Empty(t, store.queries)
		})
	}
	t.Run("store error", func(t *testing.T) {
		wantErr := errors.New("db down")
		store := &fakeUserTeamsStore{err: wantErr}
		_, err := NewLegacyUserTeamsBackend(store, tracing.NewNoopTracerService()).ListUserTeams(t.Context(), UserTeamsQuery{UserUID: "alice", Namespace: "default"})
		require.ErrorIs(t, err, wantErr)
	})
}

type fakeUserTeamsStore struct {
	legacy.LegacyIdentityStore
	pages     []*legacy.ListUserTeamsResult
	queries   []legacy.ListUserTeamsQuery
	namespace claims.NamespaceInfo
	err       error
}

func (f *fakeUserTeamsStore) ListUserTeams(_ context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
	index := len(f.queries)
	f.queries = append(f.queries, query)
	f.namespace = ns
	if f.err != nil {
		return nil, f.err
	}
	if index >= len(f.pages) {
		return &legacy.ListUserTeamsResult{}, nil
	}
	return f.pages[index], nil
}
