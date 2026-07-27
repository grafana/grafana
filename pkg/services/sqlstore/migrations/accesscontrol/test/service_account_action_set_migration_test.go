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

func TestSAActionSetMigration(t *testing.T) {
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
					"serviceaccounts:id:1": {"serviceaccounts:read", "serviceaccounts:write"},
				},
			},
		},
		{
			desc: "managed role with only serviceaccounts:read gets no action set (no view level for SAs)",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": {"serviceaccounts:read"},
				},
			},
		},
		{
			desc: "managed edit grant gets serviceaccounts:edit token",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": {"serviceaccounts:read", "serviceaccounts:write"},
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": "serviceaccounts:edit",
				},
			},
		},
		{
			desc: "managed admin grant gets serviceaccounts:admin token",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": {"serviceaccounts:read", "serviceaccounts:write", "serviceaccounts:delete"},
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": "serviceaccounts:admin",
				},
			},
		},
		{
			desc: "existing action set token is not duplicated",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": {"serviceaccounts:read", "serviceaccounts:write", "serviceaccounts:edit"},
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": "serviceaccounts:edit",
				},
			},
		},
		{
			desc: "multiple roles and SA IDs are handled independently",
			existingRolePerms: map[string]map[string][]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": {"serviceaccounts:read", "serviceaccounts:write"},
					"serviceaccounts:id:2": {"serviceaccounts:read", "serviceaccounts:write", "serviceaccounts:delete"},
				},
				"managed:teams:1:permissions": {
					"serviceaccounts:id:1": {"serviceaccounts:read", "serviceaccounts:write", "serviceaccounts:delete"},
				},
			},
			expectedActionSets: map[string]map[string]string{
				"managed:users:1:permissions": {
					"serviceaccounts:id:1": "serviceaccounts:edit",
					"serviceaccounts:id:2": "serviceaccounts:admin",
				},
				"managed:teams:1:permissions": {
					"serviceaccounts:id:1": "serviceaccounts:admin",
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, acmig.AddSAActionSetMigrationID)
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
			acmig.AddSAActionSetPermissionsMigrator(acmigrator)

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
					}
				}
			}
		})
	}
}
