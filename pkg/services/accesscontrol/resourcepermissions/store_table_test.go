package resourcepermissions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationStoreUsesProvidedTableNames asserts every query resolves its table names
// through the LegacyDatabaseProvider rather than hardcoding them. The store runs inside
// transactions opened by callers such as the datasource service, which reuse whatever session
// is on the context without checking which engine created it, so an unresolved table name
// would read and write the connection's default schema instead of the tenant's.
func TestIntegrationStoreUsesProvidedTableNames(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.NewTestStore(t)
	ss := NewStore(setting.NewCfg(), func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB:    sqlStore,
			Table: func(n string) string { return "tenant_" + n },
		}, nil
	}, featuremgmt.WithFeatures())

	ctx := context.Background()
	cmd := SetResourcePermissionCommand{
		Actions:           []string{"datasources:read"},
		Resource:          "datasources",
		ResourceID:        "1",
		ResourceAttribute: "uid",
	}

	// Each case names the tenant table its query must reach. Nothing creates those tables,
	// so a query that resolves them fails naming the prefixed table, and one that does not
	// resolve them succeeds against the migrated tables on the same connection.
	tests := map[string]struct {
		table string
		run   func() error
	}{
		"DeleteResourcePermissions": {"tenant_permission", func() error {
			return ss.DeleteResourcePermissions(ctx, 1, &DeleteResourcePermissionsCmd{
				Resource: "datasources", ResourceAttribute: "uid", ResourceID: "1",
			})
		}},
		"GetPermissionIDByRoleName": {"tenant_permission", func() error {
			_, err := ss.GetPermissionIDByRoleName(ctx, 1, "managed:users:1:permissions")
			return err
		}},
		"GetPermissionIDsByRoleNames": {"tenant_role", func() error {
			_, err := ss.GetPermissionIDsByRoleNames(ctx, 1, "datasources:uid:1", []string{"managed:users:1:permissions"})
			return err
		}},
		"SetUserResourcePermission": {"tenant_role", func() error {
			_, err := ss.SetUserResourcePermission(ctx, 1, accesscontrol.User{ID: 1}, cmd, nil)
			return err
		}},
		"SetTeamResourcePermission": {"tenant_role", func() error {
			_, err := ss.SetTeamResourcePermission(ctx, 1, 1, cmd, nil)
			return err
		}},
		"SetBuiltInResourcePermission": {"tenant_role", func() error {
			_, err := ss.SetBuiltInResourcePermission(ctx, 1, "Viewer", cmd, nil)
			return err
		}},
		"SetResourcePermissions": {"tenant_role", func() error {
			_, err := ss.SetResourcePermissions(ctx, 1, []SetResourcePermissionsCommand{{
				User: accesscontrol.User{ID: 1}, SetResourcePermissionCommand: cmd,
			}}, ResourceHooks{})
			return err
		}},
		"GetResourcePermissions": {"tenant_permission", func() error {
			_, err := ss.GetResourcePermissions(ctx, 1, GetResourcePermissionsQuery{
				Actions: []string{"datasources:read"}, Resource: "datasources",
				ResourceID: "1", ResourceAttribute: "uid",
				// The team filter is built for every non-ExcludeManaged query, and needs a
				// requester with team read access to produce a filter rather than an error.
				User: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionTeamsRead: {"teams:*"}},
				}},
			})
			return err
		}},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			err := tc.run()
			require.Error(t, err)
			require.ErrorContains(t, err, tc.table)
		})
	}
}

// TestIntegrationStoreRoundTripsOnTenantTables asserts the store both writes and reads
// permissions on the tenant's tables. The test above only proves the queries name those
// tables; this one proves they are well formed against them, and that nothing lands in the
// unprefixed tables that exist on the same connection.
func TestIntegrationStoreRoundTripsOnTenantTables(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.NewTestStore(t)
	ctx := context.Background()

	// Every table the store joins, created under the tenant prefix. GetResourcePermissions
	// unions the user, team and built-in queries, so all of them must exist.
	beans := map[string]any{
		"tenant_permission":   &accesscontrol.Permission{},
		"tenant_role":         &accesscontrol.Role{},
		"tenant_user_role":    &accesscontrol.UserRole{},
		"tenant_team_role":    &accesscontrol.TeamRole{},
		"tenant_builtin_role": &accesscontrol.BuiltinRole{},
		"tenant_team":         &team.Team{},
		"tenant_user":         &user.User{},
	}
	require.NoError(t, sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		for name, bean := range beans {
			if err := sess.Table(name).CreateTable(bean); err != nil {
				return err
			}
		}
		return nil
	}))

	ss := NewStore(setting.NewCfg(), func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB:    sqlStore,
			Table: func(n string) string { return "tenant_" + n },
		}, nil
	}, featuremgmt.WithFeatures())

	const orgID int64 = 1
	cmd := SetResourcePermissionCommand{
		Actions:           []string{"datasources:read", "datasources:query"},
		Resource:          "datasources",
		ResourceID:        "ds-uid",
		ResourceAttribute: "uid",
		Permission:        "Query",
	}

	added, err := ss.SetBuiltInResourcePermission(ctx, orgID, "Viewer", cmd, nil)
	require.NoError(t, err)
	require.ElementsMatch(t, cmd.Actions, added.Actions)

	query := GetResourcePermissionsQuery{
		Actions:           cmd.Actions,
		Resource:          cmd.Resource,
		ResourceID:        cmd.ResourceID,
		ResourceAttribute: cmd.ResourceAttribute,
		User: &user.SignedInUser{OrgID: orgID, Permissions: map[int64]map[string][]string{
			orgID: {accesscontrol.ActionTeamsRead: {"teams:*"}},
		}},
	}
	got, err := ss.GetResourcePermissions(ctx, orgID, query)
	require.NoError(t, err)
	require.Len(t, got, 1)
	require.Equal(t, "Viewer", got[0].BuiltInRole)
	require.ElementsMatch(t, cmd.Actions, got[0].Actions)

	// The migrated, unprefixed tables on the same connection are untouched.
	for _, table := range []string{"permission", "role", "builtin_role"} {
		var count int64
		require.NoError(t, sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			var err error
			count, err = sess.Table(table).Count(beans["tenant_"+table])
			return err
		}))
		require.Zerof(t, count, "%s should be empty", table)
	}

	require.NoError(t, ss.DeleteResourcePermissions(ctx, orgID, &DeleteResourcePermissionsCmd{
		Resource:          cmd.Resource,
		ResourceAttribute: cmd.ResourceAttribute,
		ResourceID:        cmd.ResourceID,
	}))

	got, err = ss.GetResourcePermissions(ctx, orgID, query)
	require.NoError(t, err)
	require.Empty(t, got)
}
