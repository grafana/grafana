package test

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	acmig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func TestActionSetMigration(t *testing.T) {
	// Run initial migration to have a working DB
	x := setupTestDB(t)

	type migrationTestCase struct {
		desc               string
		existingRolePerms  map[string]map[string][]string
		expectedActionSets map[string]map[string]string
	}
	testCases := []migrationTestCase{
		{
			desc:              "empty perms",
			existingRolePerms: map[string]map[string][]string{},
		},
		{
			desc: "dashboard permissions that are not managed don't get an action set",
			existingRolePerms: map[string]map[string][]string{
				"my_custom_role": {
					"dashboards:uid:1": ossaccesscontrol.DashboardViewActions,
				},
			},
		},
		{
			desc: "managed permissions that are not dashboard permissions don't get an action set",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"datasources:uid:1": {"datasources:query", "datasources:read"},
				},
			},
		},
		{
			desc: "managed dash viewer gets a viewer action set",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"dashboards:uid:1": ossaccesscontrol.DashboardViewActions,
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"dashboards:uid:1": "dashboards:view",
				},
			},
		},
		{
			desc: "managed dash editor gets an editor action set",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"dashboards:uid:1": ossaccesscontrol.DashboardEditActions,
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"dashboards:uid:1": "dashboards:edit",
				},
			},
		},
		{
			desc: "managed dash admin gets an admin action set",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"dashboards:uid:1": ossaccesscontrol.DashboardAdminActions,
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"dashboards:uid:1": "dashboards:admin",
				},
			},
		},
		{
			desc: "managed folder viewer gets a viewer action set",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1": append(ossaccesscontrol.FolderViewActions, ossaccesscontrol.DashboardViewActions...),
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1": "folders:view",
				},
			},
		},
		{
			desc: "managed folder editor gets an editor action set",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1": append(ossaccesscontrol.FolderEditActions, ossaccesscontrol.DashboardEditActions...),
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1": "folders:edit",
				},
			},
		},
		{
			desc: "managed folder admin gets an admin action set",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1": append(ossaccesscontrol.FolderAdminActions, ossaccesscontrol.DashboardAdminActions...),
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1": "folders:admin",
				},
			},
		},
		{
			desc: "can add action sets for multiple folders and dashboards under the same managed permission",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1":     append(ossaccesscontrol.FolderAdminActions, ossaccesscontrol.DashboardAdminActions...),
					"dashboards:uid:1":  ossaccesscontrol.DashboardEditActions,
					"datasources:uid:1": {"datasources:query", "datasources:read"},
					"folders:uid:2":     append(ossaccesscontrol.FolderViewActions, ossaccesscontrol.DashboardViewActions...),
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1":    "folders:admin",
					"folders:uid:2":    "folders:view",
					"dashboards:uid:1": "dashboards:edit",
				},
			},
		},
		{
			desc: "can add action sets for multiple managed roles",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1": append(ossaccesscontrol.FolderAdminActions, ossaccesscontrol.DashboardAdminActions...),
					"folders:uid:2": append(ossaccesscontrol.FolderViewActions, ossaccesscontrol.DashboardViewActions...),
				},
				"managed:users:1:permissions": {
					"folders:uid:1":    append(ossaccesscontrol.FolderEditActions, ossaccesscontrol.DashboardEditActions...),
					"dashboards:uid:1": ossaccesscontrol.DashboardEditActions,
				},
				"managed:teams:1:permissions": {
					"folders:uid:1": append(ossaccesscontrol.FolderEditActions, ossaccesscontrol.DashboardEditActions...),
					"folders:uid:2": append(ossaccesscontrol.FolderAdminActions, ossaccesscontrol.DashboardAdminActions...),
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"folders:uid:1": "folders:admin",
					"folders:uid:2": "folders:view",
				},
				"managed:users:1:permissions": {
					"folders:uid:1":    "folders:edit",
					"dashboards:uid:1": "dashboards:edit",
				},
				"managed:teams:1:permissions": {
					"folders:uid:1": "folders:edit",
					"folders:uid:2": "folders:admin",
				},
			},
		},
		{
			desc: "can handle existing action sets",
			existingRolePerms: map[string]map[string][]string{
				"managed:builtins:viewer:permissions": {
					"dashboards:uid:1": append(ossaccesscontrol.DashboardAdminActions, "dashboards:admin"),
					"dashboards:uid:2": ossaccesscontrol.DashboardViewActions,
					"dashboards:uid:4": append(ossaccesscontrol.DashboardViewActions, "dashboards:view"),
				},
				"managed:users:1:permissions": {
					"dashboards:uid:1": append(ossaccesscontrol.DashboardEditActions, "dashboards:edit"),
					"dashboards:uid:2": append(ossaccesscontrol.DashboardViewActions, "dashboards:view"),
					"dashboards:uid:3": ossaccesscontrol.DashboardEditActions,
					"dashboards:uid:4": ossaccesscontrol.DashboardAdminActions,
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:builtins:viewer:permissions": {
					"dashboards:uid:1": "dashboards:admin",
					"dashboards:uid:2": "dashboards:view",
					"dashboards:uid:4": "dashboards:view",
				},
				"managed:users:1:permissions": {
					"dashboards:uid:1": "dashboards:edit",
					"dashboards:uid:2": "dashboards:view",
					"dashboards:uid:3": "dashboards:edit",
					"dashboards:uid:4": "dashboards:admin",
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration, roles and permissions
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, acmig.AddActionSetMigrationID)
			require.NoError(t, errDeleteMig)
			_, errDeleteRole := x.Exec(`DELETE FROM role`)
			require.NoError(t, errDeleteRole)
			_, errDeletePerms := x.Exec(`DELETE FROM permission`)
			require.NoError(t, errDeletePerms)

			orgID := 1
			rolePerms := map[string][]rawPermission{}
			for roleName, permissions := range tc.existingRolePerms {
				rawPerms := []rawPermission{}
				for scope, actions := range permissions {
					for _, action := range actions {
						rawPerms = append(rawPerms, rawPermission{Scope: scope, Action: action})
					}
				}
				rolePerms[roleName] = rawPerms
			}
			perms := map[int64]map[string][]rawPermission{int64(orgID): rolePerms}

			// seed DB with permissions
			putTestPermissions(t, x, perms)

			// Run action set migration
			acmigrator := migrator.NewMigrator(x, setting.ProvideService(&setting.Cfg{Logger: log.New("acmigration.test")}))
			acmig.AddActionSetPermissionsMigrator(acmigrator)

			errRunningMig := acmigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			// verify got == want
			for roleName, existingPerms := range tc.existingRolePerms {
				// Check the role exists
				role := accesscontrol.Role{}
				hasRole, err := x.Table("role").Where("org_id = ? AND name = ?", orgID, roleName).Get(&role)
				require.NoError(t, err)
				require.True(t, hasRole, "expected role to exist", "role", roleName)

				// Check permissions associated with each role
				perms := []accesscontrol.Permission{}
				_, err = x.Table("permission").Where("role_id = ?", role.ID).FindAndCount(&perms)
				require.NoError(t, err)

				gotRawPerms := convertToScopeActionMap(perms)
				expectedPerms := getExpectedPerms(existingPerms, tc.expectedActionSets[roleName])
				require.Equal(t, len(gotRawPerms), len(expectedPerms), "expected role to contain the same amount of scopes", "role", roleName)
				for scope, actions := range expectedPerms {
					require.ElementsMatch(t, gotRawPerms[scope], actions, "expected role to have the same permissions", "role", roleName)
				}
			}
		})
	}
}

func convertToScopeActionMap(perms []accesscontrol.Permission) map[string][]string {
	result := map[string][]string{}
	for _, perm := range perms {
		if _, ok := result[perm.Scope]; !ok {
			result[perm.Scope] = []string{}
		}
		result[perm.Scope] = append(result[perm.Scope], perm.Action)
	}
	return result
}

func getExpectedPerms(existingPerms map[string][]string, actionSets map[string]string) map[string][]string {
	for scope := range existingPerms {
		if actionSet, ok := actionSets[scope]; ok {
			if !slices.Contains(existingPerms[scope], actionSet) {
				existingPerms[scope] = append(existingPerms[scope], actionSets[scope])
			}
		}
	}
	return existingPerms
}
