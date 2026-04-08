package rbac

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestService_resolveScopeMap(t *testing.T) {
	tests := []struct {
		name     string
		scopeMap map[string]bool
		ns       types.NamespaceInfo
		cache    map[string]map[int64]string // Namespace: team ID -> UID cache
		store    []team.Team
		want     map[string]bool
	}{
		{
			name: "Should resolve team IDs to team UIDs",
			ns:   types.NamespaceInfo{Value: "org-2", OrgID: 2},
			scopeMap: map[string]bool{
				"teams:id:1": true,
				"teams:id:2": true,
			},
			store: []team.Team{
				{ID: 1, UID: "t1"},
				{ID: 2, UID: "t2"},
			},
			want: map[string]bool{
				"teams:uid:t1": true,
				"teams:uid:t2": true,
			},
		},
		{
			name: "Should use cache",
			ns:   types.NamespaceInfo{Value: "org-2", OrgID: 2},
			scopeMap: map[string]bool{
				"teams:id:1": true,
				"teams:id:2": true,
			},
			cache: map[string]map[int64]string{
				"org-2": {1: "t1", 2: "t2"},
			},
			want: map[string]bool{
				"teams:uid:t1": true,
				"teams:uid:t2": true,
			},
		},
		{
			name: "Shouldn't use cache from another namespace",
			ns:   types.NamespaceInfo{Value: "org-2", OrgID: 2},
			scopeMap: map[string]bool{
				"teams:id:1": true,
			},
			cache: map[string]map[int64]string{
				"org-31": {1: "org31-t1"},
			},
			store: []team.Team{{ID: 1, UID: "org2-t1"}},
			want: map[string]bool{
				"teams:uid:org2-t1": true,
			},
		},
		{
			name:     "Should handle wildcard",
			ns:       types.NamespaceInfo{Value: "org-2", OrgID: 2},
			scopeMap: map[string]bool{"teams:id:*": true},
			store:    []team.Team{{ID: 1, UID: "t1"}, {ID: 2, UID: "t2"}},
			want:     map[string]bool{"teams:uid:*": true},
		},
		{
			name: "Should skip short scopes",
			ns:   types.NamespaceInfo{Value: "org-2", OrgID: 2},
			scopeMap: map[string]bool{
				"teams:short": true,
				"teams:*":     true,
				"*":           true,
				"teams:id:1":  true,
			},
			store: []team.Team{{ID: 1, UID: "t1"}},
			want: map[string]bool{
				"teams:short":  true,
				"teams:uid:t1": true,
				"teams:*":      true,
				"*":            true,
			},
		},
		{
			name: "Should gracefully handle invalid scopes",
			ns:   types.NamespaceInfo{Value: "org-2", OrgID: 2},
			scopeMap: map[string]bool{
				"teams:id:":    true,
				"teams:id:NaN": true,
				"teams:id:1":   true,
			},
			store: []team.Team{{ID: 1, UID: "t1"}},
			want: map[string]bool{
				"teams:id:":    true,
				"teams:id:NaN": true,
				"teams:uid:t1": true,
			},
		},
		{
			name: "Should recover from stale cache",
			ns:   types.NamespaceInfo{Value: "org-2", OrgID: 2},
			scopeMap: map[string]bool{
				"teams:id:1": true,
				"teams:id:2": true,
				"teams:id:3": true,
			},
			cache: map[string]map[int64]string{
				"org-2": {1: "t1"},
			},
			store: []team.Team{
				{ID: 1, UID: "t1"},
				{ID: 2, UID: "t2"},
				{ID: 3, UID: "t3"},
			},
			want: map[string]bool{
				"teams:uid:t1": true,
				"teams:uid:t2": true,
				"teams:uid:t3": true,
			},
		},
		{
			name: "Should skip unknown team IDs",
			ns:   types.NamespaceInfo{Value: "org-2", OrgID: 2},
			scopeMap: map[string]bool{
				"teams:id:1": true,
			},
			store: []team.Team{
				{ID: 2, UID: "t2"},
			},
			want: map[string]bool{
				"teams:id:1": true,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := setupService()
			s.identityStore = &fakeIdentityStore{
				disableNsCheck: true,
				teams:          tt.store,
			}
			if tt.cache != nil {
				for ns, cache := range tt.cache {
					s.teamIDCache.Set(context.Background(), teamIDsCacheKey(ns), cache)
				}
			}
			got, err := s.resolveScopeMap(context.Background(), tt.ns, tt.scopeMap)
			require.NoError(t, err)

			require.Len(t, got, len(tt.want))
			for scope := range tt.want {
				_, ok := got[scope]
				require.True(t, ok)
			}
		})
	}
}

// Test that fetch* functions paginate through all results when the store returns multiple pages.
// Each test uses pageSize=2 with 5 items, expecting 3 pages (2+2+1).
func TestService_fetchPagination(t *testing.T) {
	ns := types.NamespaceInfo{Value: "org-1", OrgID: 1}

	t.Run("teams", func(t *testing.T) {
		s := setupService()
		store := &fakeIdentityStore{disableNsCheck: true, pageSize: 2, teams: []team.Team{
			{ID: 1, UID: "t1"}, {ID: 2, UID: "t2"}, {ID: 3, UID: "t3"}, {ID: 4, UID: "t4"}, {ID: 5, UID: "t5"},
		}}
		s.identityStore = store

		got, err := s.fetchTeams(context.Background(), ns)
		require.NoError(t, err)
		require.Len(t, got, 5)
		require.Equal(t, 3, store.calls)
	})

	t.Run("service accounts", func(t *testing.T) {
		s := setupService()
		store := &fakeIdentityStore{disableNsCheck: true, pageSize: 2, serviceAccounts: []legacy.ServiceAccount{
			{ID: 1, UID: "sa1"}, {ID: 2, UID: "sa2"}, {ID: 3, UID: "sa3"}, {ID: 4, UID: "sa4"}, {ID: 5, UID: "sa5"},
		}}
		s.identityStore = store

		got, err := s.fetchServiceAccounts(context.Background(), ns)
		require.NoError(t, err)
		require.Len(t, got, 5)
		require.Equal(t, 3, store.calls)
	})

	t.Run("users", func(t *testing.T) {
		s := setupService()
		store := &fakeIdentityStore{disableNsCheck: true, pageSize: 2, users: []common.UserWithRole{
			{User: user.User{ID: 1, UID: "u1"}}, {User: user.User{ID: 2, UID: "u2"}}, {User: user.User{ID: 3, UID: "u3"}},
			{User: user.User{ID: 4, UID: "u4"}}, {User: user.User{ID: 5, UID: "u5"}},
		}}
		s.identityStore = store

		got, err := s.fetchUsers(context.Background(), ns)
		require.NoError(t, err)
		require.Len(t, got, 5)
		require.Equal(t, 3, store.calls)
	})
}
