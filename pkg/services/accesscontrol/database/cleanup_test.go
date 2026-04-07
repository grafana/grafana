package database_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationCleanupPluginRBAC seeds a full set of plugin RBAC data — a
// fixed role, action-prefixed permissions, scope-based permissions, user_role
// and team_role assignments — then asserts that CleanupPluginRBAC removes
// exactly the plugin's data while leaving unrelated rows intact.
func TestIntegrationCleanupPluginRBAC(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	sqlStore, _ := db.InitTestDBWithCfg(t)
	store := database.ProvideService(sqlStore)

	pluginID := "test-plugin"
	pluginScope := accesscontrol.Scope("plugins", "id", pluginID)

	// ── seed data ────────────────────────────────────────────────────────────

	// Plugin fixed role (org_id = -1, name = "plugins:<pluginID>:<role>").
	pluginRoleID := insertRole(t, ctx, sqlStore, accesscontrol.PluginRolePrefix+pluginID+":admin", accesscontrol.GlobalOrgID)

	// Permissions that must be cleaned up:
	//   1. action prefixed with "<pluginID>."  (plugin-defined action)
	insertPermission(t, ctx, sqlStore, pluginRoleID, pluginID+".dashboards:read", "")
	//   2. action prefixed with "<pluginID>:"  (namespace-style action)
	insertPermission(t, ctx, sqlStore, pluginRoleID, pluginID+":read", "")
	//   3. any role scoped to "plugins:id:<pluginID>"
	otherRoleID := insertRole(t, ctx, sqlStore, "basic:viewer", accesscontrol.GlobalOrgID)
	insertPermission(t, ctx, sqlStore, otherRoleID, "plugins.app:access", pluginScope)

	// Role assignments that must be cleaned up.
	insertUserRole(t, ctx, sqlStore, pluginRoleID, 42, accesscontrol.GlobalOrgID)
	insertTeamRole(t, ctx, sqlStore, pluginRoleID, 7, accesscontrol.GlobalOrgID)

	// Unrelated data that must survive.
	survivingRoleID := insertRole(t, ctx, sqlStore, "plugins:other-plugin:admin", accesscontrol.GlobalOrgID)
	insertPermission(t, ctx, sqlStore, survivingRoleID, "dashboards:read", "")
	insertPermission(t, ctx, sqlStore, otherRoleID, "plugins.app:access", "plugins:id:other-plugin")

	// ── run cleanup ───────────────────────────────────────────────────────────

	err := store.CleanupPluginRBAC(ctx, []string{pluginID})
	require.NoError(t, err)

	// ── assert plugin data is gone ────────────────────────────────────────────

	assert.False(t, roleExists(t, ctx, sqlStore, pluginRoleID), "plugin role should be deleted")
	assert.Zero(t, countPermsByRoleID(t, ctx, sqlStore, pluginRoleID), "plugin role permissions should be deleted")
	assert.Zero(t, countUserRolesByRoleID(t, ctx, sqlStore, pluginRoleID), "user_role assignment should be deleted")
	assert.Zero(t, countTeamRolesByRoleID(t, ctx, sqlStore, pluginRoleID), "team_role assignment should be deleted")
	assert.Zero(t, countPermsByScope(t, ctx, sqlStore, pluginScope), "scope-based permission should be deleted")

	// ── assert unrelated data survived ───────────────────────────────────────

	assert.True(t, roleExists(t, ctx, sqlStore, survivingRoleID), "unrelated plugin role should survive")
	assert.Equal(t, int64(1), countPermsByRoleID(t, ctx, sqlStore, survivingRoleID), "unrelated role permission should survive")
	assert.Equal(t, int64(1), countPermsByScope(t, ctx, sqlStore, "plugins:id:other-plugin"), "other plugin scope should survive")
}

// ── helpers ──────────────────────────────────────────────────────────────────

func insertRole(t testing.TB, ctx context.Context, store db.DB, name string, orgID int64) int64 {
	t.Helper()
	var id int64
	err := store.WithDbSession(ctx, func(sess *db.Session) error {
		now := time.Now()
		r := accesscontrol.Role{OrgID: orgID, Name: name, UID: name, Created: now, Updated: now}
		_, err := sess.Insert(&r)
		id = r.ID
		return err
	})
	require.NoError(t, err)
	return id
}

func insertPermission(t testing.TB, ctx context.Context, store db.DB, roleID int64, action, scope string) {
	t.Helper()
	err := store.WithDbSession(ctx, func(sess *db.Session) error {
		now := time.Now()
		_, err := sess.Insert(&accesscontrol.Permission{RoleID: roleID, Action: action, Scope: scope, Created: now, Updated: now})
		return err
	})
	require.NoError(t, err)
}

func insertUserRole(t testing.TB, ctx context.Context, store db.DB, roleID, userID, orgID int64) {
	t.Helper()
	err := store.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(&accesscontrol.UserRole{RoleID: roleID, UserID: userID, OrgID: orgID, Created: time.Now()})
		return err
	})
	require.NoError(t, err)
}

func insertTeamRole(t testing.TB, ctx context.Context, store db.DB, roleID, teamID, orgID int64) {
	t.Helper()
	err := store.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(&accesscontrol.TeamRole{RoleID: roleID, TeamID: teamID, OrgID: orgID, Created: time.Now()})
		return err
	})
	require.NoError(t, err)
}

func roleExists(t testing.TB, ctx context.Context, store db.DB, roleID int64) bool {
	t.Helper()
	var exists bool
	err := store.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table("role").Where("id = ?", roleID).Exist()
		exists = has
		return err
	})
	require.NoError(t, err)
	return exists
}

func countPermsByRoleID(t testing.TB, ctx context.Context, store db.DB, roleID int64) int64 {
	t.Helper()
	return countWhere(t, ctx, store, "permission", "role_id = ?", roleID)
}

func countPermsByScope(t testing.TB, ctx context.Context, store db.DB, scope string) int64 {
	t.Helper()
	return countWhere(t, ctx, store, "permission", "scope = ?", scope)
}

func countUserRolesByRoleID(t testing.TB, ctx context.Context, store db.DB, roleID int64) int64 {
	t.Helper()
	return countWhere(t, ctx, store, "user_role", "role_id = ?", roleID)
}

func countTeamRolesByRoleID(t testing.TB, ctx context.Context, store db.DB, roleID int64) int64 {
	t.Helper()
	return countWhere(t, ctx, store, "team_role", "role_id = ?", roleID)
}

func countWhere(t testing.TB, ctx context.Context, store db.DB, table, where string, args ...any) int64 {
	t.Helper()
	var count int64
	err := store.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		count, err = sess.Table(table).Where(where, args...).Count()
		return err
	})
	require.NoError(t, err)
	return count
}
