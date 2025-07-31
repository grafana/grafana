package test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	acmig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

type testCase struct {
	desc          string
	putRolePerms  map[int64]map[string][]rawPermission
	wantRolePerms map[int64]map[string][]rawPermission
}

func testCases() []testCase {
	allAnnotationPermissions := []rawPermission{
		{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsTypeDashboard},
		{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard},
		{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard},
		{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard},
	}

	onlyOrgAnnotations := []rawPermission{
		{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsTypeOrganization},
		{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization},
		{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization},
		{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeOrganization},
	}

	wildcardAnnotationPermissions := []rawPermission{
		{Action: accesscontrol.ActionAnnotationsRead, Scope: "*"},
		{Action: accesscontrol.ActionAnnotationsCreate, Scope: "annotations:*"},
		{Action: accesscontrol.ActionAnnotationsDelete, Scope: "annotations:type:*"},
		{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsAll},
	}

	return []testCase{
		{
			desc:          "empty permissions lead to empty permissions",
			putRolePerms:  map[int64]map[string][]rawPermission{},
			wantRolePerms: map[int64]map[string][]rawPermission{},
		},
		{
			desc: "adds new permissions for instances without basic roles (should only be OSS instances)",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"managed:users:1:permissions": {{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"}},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"},
						{Action: accesscontrol.ActionAnnotationsRead, Scope: "dashboards:uid:test"},
					},
				},
			},
		},
		{
			desc: "doesn't add any new permissions if has default annotation permissions on basic roles but no dashboard or folder permissions",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
				},
			},
		},
		{
			desc: "adds new permissions if has default annotation permissions on basic roles and dashboard read permissions",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer":                allAnnotationPermissions,
					"basic:editor":                allAnnotationPermissions,
					"basic:admin":                 allAnnotationPermissions,
					"managed:users:1:permissions": {{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"}},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"},
						{Action: accesscontrol.ActionAnnotationsRead, Scope: "dashboards:uid:test"},
					},
				},
			},
		},
		{
			desc: "adds new permissions if has default annotation permissions on basic roles and dashboard write permissions",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:test"},
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"},
					},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:test"},
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"},
						{Action: accesscontrol.ActionAnnotationsRead, Scope: "dashboards:uid:test"},
						{Action: accesscontrol.ActionAnnotationsWrite, Scope: "dashboards:uid:test"},
						{Action: accesscontrol.ActionAnnotationsDelete, Scope: "dashboards:uid:test"},
						{Action: accesscontrol.ActionAnnotationsCreate, Scope: "dashboards:uid:test"},
					},
				},
			},
		},
		{
			desc: "adds new permissions if has default annotation permissions on basic roles and folder read permissions",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer":                allAnnotationPermissions,
					"basic:editor":                allAnnotationPermissions,
					"basic:admin":                 allAnnotationPermissions,
					"managed:users:1:permissions": {{Action: dashboards.ActionDashboardsRead, Scope: "folders:uid:test"}},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsRead, Scope: "folders:uid:test"},
						{Action: accesscontrol.ActionAnnotationsRead, Scope: "folders:uid:test"},
					},
				},
			},
		},
		{
			desc: "adds new permissions if has default annotation permissions on basic roles and folder write permissions",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsWrite, Scope: "folders:uid:test"},
						{Action: dashboards.ActionDashboardsRead, Scope: "folders:uid:test"},
					},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsWrite, Scope: "folders:uid:test"},
						{Action: dashboards.ActionDashboardsRead, Scope: "folders:uid:test"},
						{Action: accesscontrol.ActionAnnotationsRead, Scope: "folders:uid:test"},
						{Action: accesscontrol.ActionAnnotationsWrite, Scope: "folders:uid:test"},
						{Action: accesscontrol.ActionAnnotationsDelete, Scope: "folders:uid:test"},
						{Action: accesscontrol.ActionAnnotationsCreate, Scope: "folders:uid:test"},
					},
				},
			},
		},
		{
			desc: "adds new permissions to several managed roles if has default annotation permissions on basic roles and dashboard read permissions",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer":                allAnnotationPermissions,
					"basic:editor":                allAnnotationPermissions,
					"basic:admin":                 allAnnotationPermissions,
					"managed:users:1:permissions": {{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"}},
					"managed:teams:1:permissions": {{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test2"}},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": allAnnotationPermissions,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"},
						{Action: accesscontrol.ActionAnnotationsRead, Scope: "dashboards:uid:test"},
					},
					"managed:teams:1:permissions": {
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test2"},
						{Action: accesscontrol.ActionAnnotationsRead, Scope: "dashboards:uid:test2"},
					},
				},
			},
		},
		{
			desc: "doesn't add any new permissions if annotation permissions are missing from the basic roles",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:test"},
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"},
					},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
				},
			},
		},
		{
			desc: "doesn't add any new permissions if annotation permissions from the basic roles don't have the dashboard scope",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": onlyOrgAnnotations,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:test"},
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"},
					},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": onlyOrgAnnotations,
					"basic:editor": allAnnotationPermissions,
					"basic:admin":  allAnnotationPermissions,
				},
			},
		},
		{
			desc: "adds new permissions if has default annotation permissions with different wildcard scopes",
			putRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer":                wildcardAnnotationPermissions,
					"basic:editor":                wildcardAnnotationPermissions,
					"basic:admin":                 wildcardAnnotationPermissions,
					"managed:users:1:permissions": {{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"}},
				},
			},
			wantRolePerms: map[int64]map[string][]rawPermission{
				1: {
					"basic:viewer": wildcardAnnotationPermissions,
					"basic:editor": wildcardAnnotationPermissions,
					"basic:admin":  wildcardAnnotationPermissions,
					"managed:users:1:permissions": {
						{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:test"},
						{Action: accesscontrol.ActionAnnotationsRead, Scope: "dashboards:uid:test"},
					},
				},
			},
		},
	}
}

func TestAnnotationActionMigration(t *testing.T) {
	// Run initial migration to have a working DB
	x := setupTestDB(t)

	for _, tc := range testCases() {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id LIKE ?`, acmig.ManagedDashboardAnnotationActionsMigratorID)
			require.NoError(t, errDeleteMig)
			_, errDeletePerm := x.Exec(`DELETE FROM permission`)
			require.NoError(t, errDeletePerm)
			_, errDeleteRole := x.Exec(`DELETE FROM role`)
			require.NoError(t, errDeleteRole)

			// Test running the migrations twice to make sure they don't conflict
			for i := 0; i < 2; i++ {
				if i == 0 {
					// put permissions
					putTestPermissions(t, x, tc.putRolePerms)
				}

				// Run accesscontrol migration (permissions insertion should not have conflicted)
				acmigrator := migrator.NewMigrator(x, setting.ProvideService(&setting.Cfg{Logger: log.New("acmigration.test")}))
				acmig.AddManagedDashboardAnnotationActionsMigration(acmigrator)

				errRunningMig := acmigrator.Start(false, 0)
				require.NoError(t, errRunningMig)

				// verify got == want
				for orgID, roles := range tc.wantRolePerms {
					for roleName := range roles {
						// Check managed roles exist
						role := accesscontrol.Role{}
						hasRole, errRoleSearch := x.Table("role").Where("org_id = ? AND name = ?", orgID, roleName).Get(&role)

						require.NoError(t, errRoleSearch)
						require.True(t, hasRole, "expected role to exist", "orgID", orgID, "role", roleName)

						// Check permissions associated with each role
						perms := []accesscontrol.Permission{}
						count, errManagedPermsSearch := x.Table("permission").Where("role_id = ?", role.ID).FindAndCount(&perms)

						require.NoError(t, errManagedPermsSearch)
						require.Equal(t, int64(len(tc.wantRolePerms[orgID][roleName])), count, "expected role to be tied to permissions", "orgID", orgID, "role", roleName)

						gotRawPerms := convertToRawPermissions(perms)
						require.ElementsMatch(t, gotRawPerms, tc.wantRolePerms[orgID][roleName], "expected role to have permissions", "orgID", orgID, "role", roleName)

						// Check assignment of the roles
						br := accesscontrol.BuiltinRole{}
						has, errAssignmentSearch := x.Table("builtin_role").Where("role_id = ? AND role = ? AND org_id = ?", role.ID, acmig.ParseRoleFromName(roleName), orgID).Get(&br)
						require.NoError(t, errAssignmentSearch)
						require.True(t, has, "expected assignment of role to builtin role", "orgID", orgID, "role", roleName)
					}
				}
			}
		})
	}
}
