// +build integration

package database

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	actesting "github.com/grafana/grafana/pkg/services/accesscontrol/testing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestCreatingRole(t *testing.T) {
	MockTimeNow()
	t.Cleanup(ResetTimeNow)

	testCases := []struct {
		desc        string
		role        actesting.RoleTestCase
		permissions []actesting.PermissionTestCase

		expectedError   error
		expectedUpdated time.Time
	}{
		{
			desc: "should successfully create simple role",
			role: actesting.RoleTestCase{
				Name:        "a name",
				Permissions: nil,
			},
			expectedUpdated: time.Unix(1, 0).UTC(),
		},
		{
			desc: "should successfully create role with UID",
			role: actesting.RoleTestCase{
				Name:        "a name",
				UID:         "testUID",
				Permissions: nil,
			},
			expectedUpdated: time.Unix(3, 0).UTC(),
		},
		{
			desc: "should successfully create role with permissions",
			role: actesting.RoleTestCase{
				Name: "a name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "users", Permission: "admin.users:create"},
					{Scope: "reports", Permission: "reports:read"},
				},
			},
			expectedUpdated: time.Unix(5, 0).UTC(),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			createRoleRes := actesting.CreateRole(t, store, tc.role)

			res, err := store.GetRoleByUID(context.Background(), 1, createRoleRes.UID)
			role := res
			require.NoError(t, err)
			assert.Equal(t, tc.expectedUpdated, role.Updated)

			if tc.role.UID != "" {
				assert.Equal(t, tc.role.UID, role.UID)
			}

			if tc.role.Permissions == nil {
				assert.Empty(t, role.Permissions)
			} else {
				assert.Len(t, tc.role.Permissions, len(role.Permissions))
				for i, p := range role.Permissions {
					assert.Equal(t, tc.role.Permissions[i].Permission, p.Permission)
					assert.Equal(t, tc.role.Permissions[i].Scope, p.Scope)
				}
			}
		})
	}
}

func TestUpdatingRole(t *testing.T) {
	MockTimeNow()
	t.Cleanup(ResetTimeNow)

	testCases := []struct {
		desc    string
		role    actesting.RoleTestCase
		newRole actesting.RoleTestCase

		expectedError error
	}{
		{
			desc: "should successfully update role name",
			role: actesting.RoleTestCase{
				Name: "a name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "reports", Permission: "reports:read"},
				},
			},
			newRole: actesting.RoleTestCase{
				Name: "a different name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "reports", Permission: "reports:create"},
					{Scope: "reports", Permission: "reports:read"},
				},
			},
		},
		{
			desc: "should successfully create role with permissions",
			role: actesting.RoleTestCase{
				Name: "a name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "users", Permission: "admin.users:create"},
					{Scope: "reports", Permission: "reports:read"},
				},
			},
			newRole: actesting.RoleTestCase{
				Name: "a different name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "users", Permission: "admin.users:read"},
					{Scope: "reports", Permission: "reports:create"},
				},
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			role := actesting.CreateRole(t, store, tc.role)
			updated := role.Updated

			updateRoleCmd := accesscontrol.UpdateRoleCommand{
				UID:  role.UID,
				Name: tc.newRole.Name,
			}
			for _, perm := range tc.newRole.Permissions {
				updateRoleCmd.Permissions = append(updateRoleCmd.Permissions, accesscontrol.Permission{
					Permission: perm.Permission,
					Scope:      perm.Scope,
				})
			}

			_, err := store.UpdateRole(context.Background(), updateRoleCmd)
			require.NoError(t, err)

			updatedRole, err := store.GetRoleByUID(context.Background(), 1, role.UID)
			require.NoError(t, err)
			assert.Equal(t, tc.newRole.Name, updatedRole.Name)
			assert.True(t, updatedRole.Updated.After(updated))
			assert.Equal(t, len(tc.newRole.Permissions), len(updatedRole.Permissions))

			// Check permissions
			require.NoError(t, err)
			for i, updatedPermission := range updatedRole.Permissions {
				assert.Equal(t, tc.newRole.Permissions[i].Permission, updatedPermission.Permission)
				assert.Equal(t, tc.newRole.Permissions[i].Scope, updatedPermission.Scope)
			}
		})
	}
}

type userRoleTestCase struct {
	desc      string
	userName  string
	teamName  string
	userRoles []actesting.RoleTestCase
	teamRoles []actesting.RoleTestCase
}

func TestUserRole(t *testing.T) {
	MockTimeNow()
	t.Cleanup(ResetTimeNow)

	testCases := []userRoleTestCase{
		{
			desc:     "should successfully get user roles",
			userName: "testuser",
			teamName: "team1",
			userRoles: []actesting.RoleTestCase{
				{
					Name: "CreateUser", Permissions: []actesting.PermissionTestCase{},
				},
			},
			teamRoles: nil,
		},
		{
			desc:     "should successfully get user and team roles",
			userName: "testuser",
			teamName: "team1",
			userRoles: []actesting.RoleTestCase{
				{
					Name: "CreateUser", Permissions: []actesting.PermissionTestCase{},
				},
			},
			teamRoles: []actesting.RoleTestCase{
				{
					Name: "CreateDataSource", Permissions: []actesting.PermissionTestCase{},
				},
				{
					Name: "EditDataSource", Permissions: []actesting.PermissionTestCase{},
				},
			},
		},
		{
			desc:      "should successfully get user and team roles if user has no roles",
			userName:  "testuser",
			teamName:  "team1",
			userRoles: nil,
			teamRoles: []actesting.RoleTestCase{
				{
					Name: "CreateDataSource", Permissions: []actesting.PermissionTestCase{},
				},
				{
					Name: "EditDataSource", Permissions: []actesting.PermissionTestCase{},
				},
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			actesting.CreateUserWithRole(t, store.SQLStore, store, tc.userName, tc.userRoles)
			actesting.CreateTeamWithRole(t, store.SQLStore, store, tc.teamName, tc.teamRoles)

			// Create more teams
			for i := 0; i < 10; i++ {
				teamName := fmt.Sprintf("faketeam%v", i)
				roles := []actesting.RoleTestCase{
					{
						Name: fmt.Sprintf("fakerole%v", i),
						Permissions: []actesting.PermissionTestCase{
							{Scope: "datasources", Permission: "datasources:create"},
						},
					},
				}
				actesting.CreateTeamWithRole(t, store.SQLStore, store, teamName, roles)
			}

			userQuery := models.GetUserByLoginQuery{
				LoginOrEmail: tc.userName,
			}
			err := sqlstore.GetUserByLogin(&userQuery)
			require.NoError(t, err)
			userId := userQuery.Result.Id

			teamQuery := models.SearchTeamsQuery{
				OrgId: 1,
				Name:  tc.teamName,
			}
			err = sqlstore.SearchTeams(&teamQuery)
			require.NoError(t, err)
			require.Len(t, teamQuery.Result.Teams, 1)
			teamId := teamQuery.Result.Teams[0].Id

			err = store.SQLStore.AddTeamMember(userId, 1, teamId, false, 1)
			require.NoError(t, err)

			userRolesQuery := accesscontrol.GetUserRolesQuery{
				OrgID:  1,
				UserID: userQuery.Result.Id,
			}

			res, err := store.GetUserRoles(context.Background(), userRolesQuery)
			require.NoError(t, err)
			assert.Equal(t, len(tc.userRoles)+len(tc.teamRoles), len(res))
		})
	}
}

type userTeamRoleTestCase struct {
	desc      string
	userName  string
	teamName  string
	userRoles []actesting.RoleTestCase
	teamRoles []actesting.RoleTestCase
}

func TestUserPermissions(t *testing.T) {
	MockTimeNow()
	t.Cleanup(ResetTimeNow)

	testCases := []userTeamRoleTestCase{
		{
			desc:     "should successfully get user and team permissions",
			userName: "testuser",
			teamName: "team1",
			userRoles: []actesting.RoleTestCase{
				{
					Name: "CreateUser", Permissions: []actesting.PermissionTestCase{
						{Scope: "users", Permission: "admin.users:create"},
						{Scope: "reports", Permission: "reports:read"},
					},
				},
			},
			teamRoles: []actesting.RoleTestCase{
				{
					Name: "CreateDataSource", Permissions: []actesting.PermissionTestCase{
						{Scope: "datasources", Permission: "datasources:create"},
					},
				},
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			actesting.CreateUserWithRole(t, store.SQLStore, store, tc.userName, tc.userRoles)
			actesting.CreateTeamWithRole(t, store.SQLStore, store, tc.teamName, tc.teamRoles)

			// Create more teams
			for i := 0; i < 10; i++ {
				teamName := fmt.Sprintf("faketeam%v", i)
				roles := []actesting.RoleTestCase{
					{
						Name: fmt.Sprintf("fakerole%v", i),
						Permissions: []actesting.PermissionTestCase{
							{Scope: "datasources", Permission: "datasources:create"},
						},
					},
				}
				actesting.CreateTeamWithRole(t, store.SQLStore, store, teamName, roles)
			}

			userQuery := models.GetUserByLoginQuery{
				LoginOrEmail: tc.userName,
			}
			err := sqlstore.GetUserByLogin(&userQuery)
			require.NoError(t, err)
			userId := userQuery.Result.Id

			teamQuery := models.SearchTeamsQuery{
				OrgId: 1,
				Name:  tc.teamName,
			}
			err = sqlstore.SearchTeams(&teamQuery)
			require.NoError(t, err)
			require.Len(t, teamQuery.Result.Teams, 1)
			teamId := teamQuery.Result.Teams[0].Id

			err = store.SQLStore.AddTeamMember(userId, 1, teamId, false, 1)
			require.NoError(t, err)

			userPermissionsQuery := accesscontrol.GetUserPermissionsQuery{
				OrgID:  1,
				UserID: userId,
			}

			getUserTeamsQuery := models.GetTeamsByUserQuery{
				OrgId:  1,
				UserId: userId,
			}
			err = sqlstore.GetTeamsByUser(&getUserTeamsQuery)
			require.NoError(t, err)
			require.Len(t, getUserTeamsQuery.Result, 1)

			expectedPermissions := []actesting.PermissionTestCase{}
			for _, p := range tc.userRoles {
				expectedPermissions = append(expectedPermissions, p.Permissions...)
			}
			for _, p := range tc.teamRoles {
				expectedPermissions = append(expectedPermissions, p.Permissions...)
			}

			res, err := store.GetUserPermissions(context.Background(), userPermissionsQuery)
			require.NoError(t, err)
			assert.Len(t, res, len(expectedPermissions))
			assert.Contains(t, expectedPermissions, actesting.PermissionTestCase{Scope: "datasources", Permission: "datasources:create"})
			assert.NotContains(t, expectedPermissions, actesting.PermissionTestCase{Scope: "/api/restricted", Permission: "restricted:read"})
		})
	}
}
