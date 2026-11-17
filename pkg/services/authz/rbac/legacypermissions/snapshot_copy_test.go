package legacypermissions_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestSnapshotDoesNotMutateCachedSources(t *testing.T) {
	requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleViewer, TeamIDs: []int64{10, 11}}
	cache := localcache.New(0, 0)
	keys := []string{
		ac.GetBasicRolePermissionCacheKey("Viewer", 1),
		ac.GetTeamPermissionCacheKey(10, 1),
		ac.GetTeamPermissionCacheKey(11, 1),
		ac.GetUserDirectPermissionCacheKey(requester),
	}
	var want []ac.Permission
	for _, key := range keys {
		grants := make([]ac.Permission, 2, 16)
		grants[0] = ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:" + key}
		grants[1] = ac.Permission{Action: "users:read", Scope: "users:*"}
		cache.Set(key, grants, ac.PermissionCacheTTL)
		want = append(want, grants...)
	}
	loader := legacypermissions.NewLoader(nil, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), cache, loaderConfig(true), featuremgmt.WithFeatures(), &enforcementLicense{enabled: true}, nil)
	first, err := loader.GetUserPermissions(t.Context(), requester, ac.Options{})
	require.NoError(t, err)
	require.Equal(t, want, first)
	require.Equal(t, len(first), cap(first))
	first[0].Action = "mutated"
	first[2].Scope = "mutated"
	first = append(first, ac.Permission{Action: "appended"})
	require.Len(t, first, len(want)+1)
	second, err := loader.GetUserPermissions(t.Context(), requester, ac.Options{})
	require.NoError(t, err)
	require.Equal(t, want, second)
	for i, key := range keys {
		value, ok := cache.Get(key)
		require.True(t, ok)
		grants := value.([]ac.Permission)
		require.Equal(t, want[2*i:2*i+2], grants)
		require.Equal(t, ac.Permission{}, grants[:cap(grants)][2])
	}
}
