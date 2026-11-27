package legacypermissions_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	authcache "github.com/grafana/authlib/cache"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Two AuthZ replicas share one cache, as they share memcached in Cloud.
func TestIntegrationRemoteLegacyPermissionsSharedCache(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedRemoteIdentity(t, sql)
	direct := ac.Permission{Action: "users:read", Scope: "users:*"}
	added := ac.Permission{Action: "users:create"}
	viewer := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:viewer"}
	sharedWithMe := ac.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
	seedGrant(t, sql, "managed:direct", 1, 7, direct)
	seedBasicRoleGrant(t, sql, "Viewer", viewer)
	teamGrant := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:team"}
	seedTeamGrant(t, sql, 9, teamGrant)

	zanzanaOld := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-old"}
	zanzanaNew := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-new"}
	zanzanaSkip := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-skip"}
	z := &migratedGrants{permissions: []ac.Permission{zanzanaOld}}

	shared := authcache.NewLocalCache(authcache.Config{})
	replica := func() authzv1.LegacyAuthzServiceClient {
		loader := legacypermissions.NewEnforcedLoader(legacysql.NewDatabaseProvider(sql), resourcepermissions.NewActionSetService(),
			shared, loaderConfig(true), featuremgmt.WithFeatures(), z, nil)
		return startRemoteReplica(t, loader)
	}
	a, b := replica(), replica()
	request := func(reload, skipZanzana bool) *authzv1.LegacyGetUserPermissionsRequest {
		return &authzv1.LegacyGetUserPermissionsRequest{
			Namespace:        "stacks-1",
			Identity:         &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "user-7"},
			ReloadCache:      reload,
			SkipZanzanaCache: skipZanzana,
		}
	}

	require.ElementsMatch(t, []ac.Permission{direct, viewer, teamGrant, sharedWithMe, zanzanaOld}, receivePermissions(t, a, request(false, false)))

	seedGrant(t, sql, "managed:added", 1, 7, added)
	z.permissions = []ac.Permission{zanzanaNew}
	require.ElementsMatch(t, []ac.Permission{direct, viewer, teamGrant, sharedWithMe, zanzanaOld}, receivePermissions(t, b, request(false, false)),
		"replica B must read the entries that replica A filled")
	require.Equal(t, 1, z.calls)

	require.ElementsMatch(t, []ac.Permission{direct, added, viewer, teamGrant, sharedWithMe, zanzanaNew}, receivePermissions(t, a, request(true, false)))
	require.ElementsMatch(t, []ac.Permission{direct, added, viewer, teamGrant, sharedWithMe, zanzanaNew}, receivePermissions(t, b, request(false, false)),
		"a refresh on replica A must be visible on replica B")
	require.Equal(t, 2, z.calls)

	z.permissions = []ac.Permission{zanzanaSkip}
	require.ElementsMatch(t, []ac.Permission{direct, added, viewer, teamGrant, sharedWithMe, zanzanaSkip}, receivePermissions(t, b, request(false, true)))
	require.ElementsMatch(t, []ac.Permission{direct, added, viewer, teamGrant, sharedWithMe, zanzanaNew}, receivePermissions(t, a, request(false, false)),
		"skip_zanzana_cache must not replace the cached Zanzana entry")

	// The server loads the role from SQL on each call, so a role change selects new entries at once.
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec("UPDATE org_user SET role = ? WHERE org_id = ? AND user_id = ?", "Editor", 1, 7)
		return err
	}))
	require.ElementsMatch(t, []ac.Permission{direct, added, teamGrant, sharedWithMe, zanzanaSkip}, receivePermissions(t, b, request(false, false)))

	// Team IDs are also loaded per call, so a membership change selects a new team-set entry at once.
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM team_member WHERE org_id = ? AND user_id = ? AND team_id = ?", 1, 7, 9)
		return err
	}))
	require.ElementsMatch(t, []ac.Permission{direct, added, sharedWithMe, zanzanaSkip}, receivePermissions(t, a, request(false, false)))
}

func seedTeamGrant(t *testing.T, sql db.DB, teamID int64, permission ac.Permission) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		now := time.Now()
		role := ac.Role{Name: fmt.Sprintf("managed:teams:%d", teamID), UID: fmt.Sprintf("team-%d", teamID), OrgID: 1, Created: now, Updated: now}
		if _, err := sess.Insert(&role); err != nil {
			return err
		}
		permission.RoleID, permission.Created, permission.Updated = role.ID, now, now
		if _, err := sess.Insert(&permission); err != nil {
			return err
		}
		_, err := sess.Insert(&ac.TeamRole{TeamID: teamID, OrgID: 1, RoleID: role.ID, Created: now})
		return err
	}))
}

func seedBasicRoleGrant(t *testing.T, sql db.DB, basicRole string, permission ac.Permission) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		now := time.Now()
		role := ac.Role{Name: "basic:" + basicRole, UID: "basic-" + basicRole, OrgID: 1, Created: now, Updated: now}
		if _, err := sess.Insert(&role); err != nil {
			return err
		}
		permission.RoleID, permission.Created, permission.Updated = role.ID, now, now
		if _, err := sess.Insert(&permission); err != nil {
			return err
		}
		_, err := sess.Insert(&ac.BuiltinRole{Role: basicRole, OrgID: 1, RoleID: role.ID, Created: now, Updated: now})
		return err
	}))
}
