package legacypermissions_test

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func BenchmarkEmbeddedUserPermissions(b *testing.B) {
	for _, count := range []int{1000, 10000, 50000} {
		b.Run(fmt.Sprintf("permissions=%d", count), func(b *testing.B) {
			cfg := loaderConfig(true)
			cfg.StackID = "12"
			requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleViewer}
			cache := localcache.New(0, 0)
			grants := make([]ac.Permission, count)
			for i := range grants {
				grants[i] = ac.Permission{Action: "dashboards:read", Scope: fmt.Sprintf("dashboards:uid:fixture-%d", i)}
			}
			cache.Set(ac.GetBasicRolePermissionCacheKey("Viewer", 1), grants, ac.PermissionCacheTTL)
			cache.Set(ac.GetUserDirectPermissionCacheKey(requester), []ac.Permission{}, ac.PermissionCacheTTL)
			loader := legacypermissions.NewLoader(nil, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), cache, cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: true}, nil)
			client := legacypermissions.NewEmbeddedClient(loader, cfg)
			b.ReportAllocs()
			for b.Loop() {
				permissions, err := acimpl.GetLegacyUserPermissions(b.Context(), client, requester, ac.Options{}, cfg)
				if err != nil {
					b.Fatal(err)
				}
				if len(permissions) != count {
					b.Fatalf("got %d permissions, want %d", len(permissions), count)
				}
			}
		})
	}
}
