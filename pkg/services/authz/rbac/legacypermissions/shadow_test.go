package legacypermissions_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationShadowDoesNotWritePermissionCache(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enterprise := range []bool{false, true} {
		for _, reload := range []bool{false, true} {
			for _, warm := range []bool{false, true} {
				t.Run(fmt.Sprintf("enterprise=%t/reload=%t/warm=%t", enterprise, reload, warm), func(t *testing.T) {
					sql := db.NewTestStore(t)
					cache := localcache.New(0, 0)
					cfg := loaderConfig(true)
					migrated := &migratedGrants{permissions: []ac.Permission{{Action: "folders:read", Scope: "folders:uid:migrated"}}}
					loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), cache, cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: enterprise}, migrated)
					seedGrant(t, sql, "managed:shadow", 1, 7, ac.Permission{Action: "folders:read", Scope: "folders:uid:shadow"})
					require.NoError(t, sql.WithDbSession(t.Context(), func(sess *db.Session) error {
						var role ac.Role
						_, err := sess.Where("name = ?", "managed:shadow").Get(&role)
						if err != nil {
							return err
						}
						_, err = sess.Insert(&ac.TeamRole{RoleID: role.ID, OrgID: 1, TeamID: 10, Created: time.Now()})
						return err
					}))
					usr := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleViewer}
					keys := []string{
						ac.GetBasicRolePermissionCacheKey("Viewer", 1),
						ac.GetTeamPermissionCacheKey(10, 1),
						ac.GetUserDirectPermissionCacheKey(usr),
						ac.GetZanzanaUserPermissionCacheKey(usr),
					}
					sentinel := []ac.Permission{{Action: "sentinel", Scope: "unchanged"}}
					if warm {
						for _, key := range keys {
							cache.Set(key, sentinel, time.Minute)
						}
					}
					id := int64(7)
					cacheKey, namespace := usr.GetCacheKey(), usr.GetNamespace()
					req := legacyclient.LegacyGetUserPermissionsRequest{
						Namespace: types.OrgNamespaceFormatter(1), ReloadCache: reload,
						Identity: legacyclient.LegacyPermissionIdentity{
							Type: types.TypeUser, UID: "seven", InternalID: &id, HasUniqueID: true, OrgRole: "Viewer", TeamIDs: []int64{10}, CacheKey: &cacheKey, RequesterNamespace: &namespace,
						},
					}
					client := legacypermissions.NewEmbeddedClient(loader, cfg)
					res, err := client.LegacyGetUserPermissions(legacypermissions.WithPermissionShadow(t.Context()), legacypermissions.LegacyPermissionCaller(req.Namespace), req)
					require.NoError(t, err)
					require.NotEmpty(t, res.Permissions)
					for _, key := range keys {
						value, found := cache.Get(key)
						require.Equal(t, warm, found, "key %s", key)
						if warm {
							require.Equal(t, sentinel, value, "key %s", key)
						}
					}
					// Normal calls still populate and refresh the same keys.
					req.ReloadCache = true
					_, err = client.LegacyGetUserPermissions(context.Background(), legacypermissions.LegacyPermissionCaller(req.Namespace), req)
					require.NoError(t, err)
					for _, key := range keys {
						value, found := cache.Get(key)
						require.True(t, found, "key %s", key)
						require.NotEqual(t, sentinel, value, "key %s", key)
					}
				})
			}
		}
	}
}
