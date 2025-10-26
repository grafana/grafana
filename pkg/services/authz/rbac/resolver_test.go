package rbac

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/team"
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
