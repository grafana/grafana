package legacypermissions_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) { testsuite.Run(m) }

type enforcementLicense struct {
	licensing.OSSLicensingService
	enabled bool
}

func (l *enforcementLicense) FeatureEnabled(feature string) bool {
	return feature == "accesscontrol.enforcement" && l.enabled
}

func loaderConfig(cached bool) *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.RBAC.PermissionCache = cached
	return cfg
}

func seedGrant(t *testing.T, sql db.DB, name string, orgID, userID int64, permission accesscontrol.Permission) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		now := time.Now()
		role := accesscontrol.Role{Name: name, UID: name, OrgID: orgID, Created: now, Updated: now}
		if _, err := sess.Insert(&role); err != nil {
			return err
		}
		permission.RoleID, permission.Created, permission.Updated = role.ID, now, now
		if _, err := sess.Insert(&permission); err != nil {
			return err
		}
		_, err := sess.Insert(&accesscontrol.UserRole{RoleID: role.ID, OrgID: orgID, UserID: userID, Created: now})
		return err
	}))
}

func TestIntegrationGetUserPermissionsSources(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enterprise := range []bool{false, true} {
		for _, cached := range []bool{false, true} {
			t.Run(fmt.Sprintf("enterprise=%t/cache=%t", enterprise, cached), func(t *testing.T) {
				sql := db.NewTestStore(t)
				catalog := legacypermissions.NewRoleCatalog()
				catalog.Replace(map[string][]accesscontrol.Permission{"Viewer": {{Action: "users:read", Scope: "users:*"}}})
				resolver := resourcepermissions.NewActionSetService()
				resolver.StoreActionSet("folders:view", []string{"folders:read", "dashboards:read"})
				loader := legacypermissions.NewLoader(sql, catalog, resolver, localcache.New(0, 0),
					loaderConfig(cached), featuremgmt.WithFeatures(), &enforcementLicense{enabled: enterprise}, nil,
				)
				seedGrant(t, sql, "managed:direct", 1, 7, accesscontrol.Permission{Action: "folders:view", Scope: "folders:uid:one"})
				seedGrant(t, sql, "custom:direct", 1, 7, accesscontrol.Permission{Action: "users:create"})
				seedGrant(t, sql, "extsvc:global", 0, 7, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:global"})
				seedGrant(t, sql, "managed:other-user", 1, 8, accesscontrol.Permission{Action: "users:delete"})
				seedGrant(t, sql, "managed:other-org", 2, 7, accesscontrol.Permission{Action: "users:delete"})
				want := []accesscontrol.Permission{
					{Action: "folders:read", Scope: "folders:uid:one"},
					{Action: "dashboards:read", Scope: "folders:uid:one"},
					{Action: "dashboards:read", Scope: "dashboards:uid:global"},
					{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
				}
				if enterprise {
					want = append(want, accesscontrol.Permission{Action: "users:create"})
				} else {
					want = append(want, accesscontrol.Permission{Action: "users:read", Scope: "users:*"})
				}
				requester := &user.SignedInUser{UserID: 7, UserUID: "8", OrgID: 1, OrgRole: org.RoleViewer}
				for _, options := range []accesscontrol.Options{{}, {}, {ReloadCache: true}} {
					got, err := loader.GetUserPermissions(context.Background(), requester, options)
					require.NoError(t, err)
					require.ElementsMatch(t, want, got)
				}
			})
		}
	}
}
