package test

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDatasourceActionSetMigration(t *testing.T) {
	x := setupTestDB(t)

	type migrationTestCase struct {
		desc               string
		existingRolePerms  map[string]map[string][]string // roleName -> scope -> actions
		expectedActionSets map[string]map[string]string   // roleName -> scope -> expected action set token
	}

	testCases := []migrationTestCase{
		{
			desc:              "empty perms — nothing to do",
			existingRolePerms: map[string]map[string][]string{},
		},
		{
			desc: "non-managed role is skipped",
			existingRolePerms: map[string]map[string][]string{
				"my_custom_role": {
					"datasources:uid:ds1": {"datasources:read", "datasources:query", "datasources:write", "datasources:delete"},
				},
			},
		},
		{
			desc: "query-only grant gets no action set token",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": {"datasources:read", "datasources:query"},
				},
			},
		},
		{
			desc: "managed edit grant gets datasources:edit token",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": {"datasources:read", "datasources:query", "datasources:write", "datasources:delete"},
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": "datasources:edit",
				},
			},
		},
		{
			desc: "managed admin grant gets datasources:admin token",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": {
						"datasources:read", "datasources:query", "datasources:write", "datasources:delete",
						"datasources.permissions:read", "datasources.permissions:write",
					},
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": "datasources:admin",
				},
			},
		},
		{
			desc: "existing action set token is not duplicated",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": {"datasources:write", "datasources:delete", "datasources:edit"},
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": "datasources:edit",
				},
			},
		},
		{
			desc: "multiple roles and UIDs are handled independently",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": {"datasources:write"},
					"datasources:uid:ds2": {"datasources:write", "datasources.permissions:write"},
				},
				"managed:teams:1:permissions": {
					"datasources:uid:ds1": {"datasources:write", "datasources.permissions:write"},
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:users:1:permissions": {
					"datasources:uid:ds1": "datasources:edit",
					"datasources:uid:ds2": "datasources:admin",
				},
				"managed:teams:1:permissions": {
					"datasources:uid:ds1": "datasources:admin",
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, acmig.AddDatasourceActionSetMigrationID)
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
			putTestPermissions(t, x, map[int64]map[string][]rawPermission{int64(orgID): rolePerms})

			acmigrator := migrator.NewMigrator(x, &setting.Cfg{Logger: log.New("acmigration.test")})
			acmig.AddDatasourceActionSetPermissionsMigrator(acmigrator)

			require.NoError(t, acmigrator.Start(false, 0))

			for roleName, existingPerms := range tc.existingRolePerms {
				role := accesscontrol.Role{}
				hasRole, err := x.Table("role").Where("org_id = ? AND name = ?", orgID, roleName).Get(&role)
				require.NoError(t, err)
				require.True(t, hasRole, "expected role to exist: %s", roleName)

				perms := []accesscontrol.Permission{}
				_, err = x.Table("permission").Where("role_id = ?", role.ID).FindAndCount(&perms)
				require.NoError(t, err)

				gotByScopeAction := map[string][]string{}
				for _, p := range perms {
					gotByScopeAction[p.Scope] = append(gotByScopeAction[p.Scope], p.Action)
				}

				for scope, originalActions := range existingPerms {
					got := gotByScopeAction[scope]
					// All original actions must still be present.
					for _, a := range originalActions {
						require.Contains(t, got, a, "original action missing after migration: role=%s scope=%s action=%s", roleName, scope, a)
					}
					// Check the expected action set token was added (or was already present).
					if expectedToken, ok := tc.expectedActionSets[roleName][scope]; ok {
						require.True(t, slices.Contains(got, expectedToken),
							"expected action set token %q for role=%s scope=%s; got %v", expectedToken, roleName, scope, got)
						// Exactly one copy of the token.
						count := 0
						for _, a := range got {
							if a == expectedToken {
								count++
							}
						}
						require.Equal(t, 1, count, "expected exactly one %q for role=%s scope=%s; got %v", expectedToken, roleName, scope, got)
					} else {
						require.False(t, slices.Contains(got, "datasources:edit"),
							"unexpected datasources:edit for role=%s scope=%s; got %v", roleName, scope, got)
						require.False(t, slices.Contains(got, "datasources:admin"),
							"unexpected datasources:admin for role=%s scope=%s; got %v", roleName, scope, got)
					}
				}
			}
		})
	}
}
