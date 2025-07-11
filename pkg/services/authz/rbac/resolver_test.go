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
		store    fakeIdentityStore
		want     map[string]bool
	}{
		{
			ns: types.NamespaceInfo{
				Value: "org-2",
				OrgID: 2,
			},
			scopeMap: map[string]bool{
				"teams:id:1": true,
				"teams:id:2": true,
				"teams:id:3": true,
			},
			store: fakeIdentityStore{
				disableNsCheck: true,
				teams: []team.Team{
					{ID: 1, UID: "t1"},
					{ID: 2, UID: "t2"},
					{ID: 3, UID: "t3"},
				},
			},
			want: map[string]bool{
				"teams:uid:t1": true,
				"teams:uid:t2": true,
				"teams:uid:t3": true,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := setupService()
			s.identityStore = &tt.store
			got := s.resolveScopeMap(context.Background(), tt.ns, tt.scopeMap)

			require.Len(t, got, len(tt.want))
			for scope := range tt.want {
				_, ok := got[scope]
				require.True(t, ok)
			}
		})
	}
}
