package resourcepermissions

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacysqltest"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var tenantStoreTables = []string{"permission", "role", "user_role", "team_role", "builtin_role", "team", "team_member", "user"}

// tenantSeed is what one tenant's managed permissions on the shared resource were granted to.
type tenantSeed struct {
	userID, teamID int64
	action         string
}

func TestIntegrationStoreIsolatesTenants(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const orgID = int64(1)
	sqlStore := db.NewTestStore(t)
	tenants := legacysqltest.New(t, sqlStore, 2, tenantStoreTables...)
	provider := tenants.Provider()
	cfg := setting.NewCfg()
	store := NewStore(cfg, provider, featuremgmt.WithFeatures())

	cmd := func(action string) SetResourcePermissionCommand {
		return SetResourcePermissionCommand{
			Actions:           []string{action},
			Permission:        "View",
			Resource:          "dashboards",
			ResourceID:        "shared",
			ResourceAttribute: "uid",
		}
	}
	query := GetResourcePermissionsQuery{
		Actions:           []string{"decoy:read", "tenant0:read", "tenant1:read"},
		Resource:          "dashboards",
		ResourceID:        "shared",
		ResourceAttribute: "uid",
		OnlyManaged:       true,
		User: &user.SignedInUser{OrgID: orgID, Permissions: map[int64]map[string][]string{
			orgID: {accesscontrol.ActionTeamsRead: {accesscontrol.ScopeTeamsAll}},
		}},
	}

	// A query that misses its tenant's table reads or overwrites this grant in the default schema.
	decoyStore := NewStore(cfg, legacysql.NewDatabaseProvider(sqlStore), featuremgmt.WithFeatures())
	_, err := decoyStore.SetBuiltInResourcePermission(t.Context(), orgID, "Viewer", cmd("decoy:read"), nil)
	require.NoError(t, err)

	seeds := make([]tenantSeed, len(tenants.Tenants))
	for i, tenant := range tenants.Tenants {
		ctx := tenant.Context(t.Context())
		seed := tenantSeed{action: fmt.Sprintf("tenant%d:read", i)}
		seed.userID, seed.teamID = insertUserAndTeam(t, ctx, provider)

		// The hook runs in the store's transaction, so it must resolve the same tenant from ctx.
		_, err := store.SetUserResourcePermission(ctx, orgID, accesscontrol.User{ID: seed.userID}, cmd(seed.action),
			func(ctx context.Context, sess *db.Session, orgID int64, u accesscontrol.User, _, _ string) error {
				h, err := provider(ctx)
				if err != nil {
					return err
				}
				return teamimpl.AddOrUpdateTeamMemberHook(h, sess, u.ID, orgID, seed.teamID, false, team.PermissionTypeMember)
			})
		require.NoError(t, err)
		_, err = store.SetTeamResourcePermission(ctx, orgID, seed.teamID, cmd(seed.action), nil)
		require.NoError(t, err)
		_, err = store.SetBuiltInResourcePermission(ctx, orgID, "Viewer", cmd(seed.action), nil)
		require.NoError(t, err)
		_, err = store.SetResourcePermissions(ctx, orgID, []SetResourcePermissionsCommand{
			{BuiltinRole: "Editor", SetResourcePermissionCommand: cmd(seed.action)},
		}, ResourceHooks{})
		require.NoError(t, err)
		seeds[i] = seed
	}

	for i, tenant := range tenants.Tenants {
		ctx := tenant.Context(t.Context())
		seed := seeds[i]

		permissions, err := store.GetResourcePermissions(ctx, orgID, query)
		require.NoError(t, err)
		require.Len(t, permissions, 4, "tenant %d", i)
		for _, p := range permissions {
			assert.Equal(t, []string{seed.action}, p.Actions, "tenant %d", i)
		}

		userRole := accesscontrol.ManagedUserRoleName(seed.userID)
		id, err := store.GetPermissionIDByRoleName(ctx, orgID, userRole)
		require.NoError(t, err)
		ids, err := store.GetPermissionIDsByRoleNames(ctx, orgID, "dashboards:uid:shared", []string{userRole, accesscontrol.ManagedBuiltInRoleName("Viewer")})
		require.NoError(t, err)
		require.Len(t, ids, 2)
		require.Equal(t, id, ids[userRole])

		require.Equal(t, 1, countRows(t, ctx, provider, "team_member"), "tenant %d", i)
	}

	t.Run("deleting in one tenant leaves the others", func(t *testing.T) {
		ctx := tenants.Tenants[0].Context(t.Context())
		require.NoError(t, store.DeleteResourcePermissions(ctx, orgID, &DeleteResourcePermissionsCmd{
			Resource: "dashboards", ResourceAttribute: "uid", ResourceID: "shared",
		}))

		permissions, err := store.GetResourcePermissions(ctx, orgID, query)
		require.NoError(t, err)
		require.Empty(t, permissions)

		permissions, err = store.GetResourcePermissions(tenants.Tenants[1].Context(t.Context()), orgID, query)
		require.NoError(t, err)
		require.Len(t, permissions, 4)
	})

	t.Run("default schema keeps only the decoy", func(t *testing.T) {
		permissions, err := decoyStore.GetResourcePermissions(t.Context(), orgID, query)
		require.NoError(t, err)
		require.Len(t, permissions, 1)
		require.Equal(t, []string{"decoy:read"}, permissions[0].Actions)
	})

	t.Run("fails without a tenant", func(t *testing.T) {
		_, err := store.GetResourcePermissions(t.Context(), orgID, query)
		require.Error(t, err)
		_, err = store.SetBuiltInResourcePermission(t.Context(), orgID, "Viewer", cmd("tenant0:read"), nil)
		require.Error(t, err)
	})
}

func insertUserAndTeam(t *testing.T, ctx context.Context, provider legacysql.LegacyDatabaseProvider) (int64, int64) {
	t.Helper()
	h, err := provider(ctx)
	require.NoError(t, err)
	now := time.Now()
	u := &user.User{UID: "user", Login: "user", Email: "user@example.com", OrgID: 1, Created: now, Updated: now, LastSeenAt: now}
	tm := &team.Team{UID: "team", Name: "team", OrgID: 1, Created: now, Updated: now}
	err = h.DB.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Table(h.Table("user")).Insert(u); err != nil {
			return err
		}
		_, err := sess.Table(h.Table("team")).Insert(tm)
		return err
	})
	require.NoError(t, err)
	return u.ID, tm.ID
}

func countRows(t *testing.T, ctx context.Context, provider legacysql.LegacyDatabaseProvider, table string) int {
	t.Helper()
	h, err := provider(ctx)
	require.NoError(t, err)
	var n int
	err = h.DB.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.SQL("SELECT COUNT(*) FROM " + h.QuotedTable(table)).Get(&n)
		return err
	})
	require.NoError(t, err)
	return n
}
