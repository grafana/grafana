package database

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	rs "github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
)

type getUserPermissionsTestCase struct {
	desc               string
	anonymousUser      bool
	orgID              int64
	role               string
	userPermissions    []string
	teamPermissions    []string
	builtinPermissions []string
	actions            []string
	expected           int
}

func TestAccessControlStore_GetUserPermissions(t *testing.T) {
	tests := []getUserPermissionsTestCase{
		{
			desc:               "should successfully get user, team and builtin permissions",
			orgID:              1,
			role:               "Admin",
			userPermissions:    []string{"1", "2", "10"},
			teamPermissions:    []string{"100", "2"},
			builtinPermissions: []string{"5", "6"},
			expected:           7,
		},
		{
			desc:               "Should not get admin roles",
			orgID:              1,
			role:               "Viewer",
			userPermissions:    []string{"1", "2", "10"},
			teamPermissions:    []string{"100", "2"},
			builtinPermissions: []string{"5", "6"},
			expected:           5,
		},
		{
			desc:               "Should work without org role",
			orgID:              1,
			role:               "",
			userPermissions:    []string{"1", "2", "10"},
			teamPermissions:    []string{"100", "2"},
			builtinPermissions: []string{"5", "6"},
			expected:           5,
		},
		{
			desc:               "Should filter on actions",
			orgID:              1,
			role:               "",
			userPermissions:    []string{"1", "2", "10"},
			teamPermissions:    []string{"100", "2"},
			builtinPermissions: []string{"5", "6"},
			expected:           3,
			actions:            []string{"dashboards:write"},
		},
		{
			desc:               "should only get br permissions for anonymous user",
			anonymousUser:      true,
			orgID:              1,
			role:               "Admin",
			userPermissions:    []string{"1", "2", "10"},
			teamPermissions:    []string{"100", "2"},
			builtinPermissions: []string{"5", "6"},
			expected:           2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store, permissionStore, sql, teamSvc, _ := setupTestEnv(t)

			user, team := createUserAndTeam(t, sql, teamSvc, tt.orgID)

			for _, id := range tt.userPermissions {
				_, err := permissionStore.SetUserResourcePermission(context.Background(), tt.orgID, accesscontrol.User{ID: user.ID}, rs.SetResourcePermissionCommand{
					Actions:    []string{"dashboards:write"},
					Resource:   "dashboards",
					ResourceID: id,
				}, nil)
				require.NoError(t, err)
			}

			for _, id := range tt.teamPermissions {
				_, err := permissionStore.SetTeamResourcePermission(context.Background(), tt.orgID, team.Id, rs.SetResourcePermissionCommand{
					Actions:    []string{"dashboards:read"},
					Resource:   "dashboards",
					ResourceID: id,
				}, nil)
				require.NoError(t, err)
			}

			for _, id := range tt.builtinPermissions {
				_, err := permissionStore.SetBuiltInResourcePermission(context.Background(), tt.orgID, "Admin", rs.SetResourcePermissionCommand{
					Actions:    []string{"dashboards:read"},
					Resource:   "dashboards",
					ResourceID: id,
				}, nil)
				require.NoError(t, err)
			}

			var roles []string
			role := org.RoleType(tt.role)

			if role.IsValid() {
				roles = append(roles, string(role))
				for _, c := range role.Children() {
					roles = append(roles, string(c))
				}
			}

			userID := user.ID
			teamIDs := []int64{team.Id}
			if tt.anonymousUser {
				userID = 0
				teamIDs = []int64{}
			}
			permissions, err := store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
				OrgID:   tt.orgID,
				UserID:  userID,
				Roles:   roles,
				Actions: tt.actions,
				TeamIDs: teamIDs,
			})

			require.NoError(t, err)
			assert.Len(t, permissions, tt.expected)
		})
	}
}

func TestAccessControlStore_DeleteUserPermissions(t *testing.T) {
	t.Run("expect permissions in all orgs to be deleted", func(t *testing.T) {
		store, permissionsStore, sql, teamSvc, _ := setupTestEnv(t)
		user, _ := createUserAndTeam(t, sql, teamSvc, 1)

		// generate permissions in org 1
		_, err := permissionsStore.SetUserResourcePermission(context.Background(), 1, accesscontrol.User{ID: user.ID}, rs.SetResourcePermissionCommand{
			Actions:    []string{"dashboards:write"},
			Resource:   "dashboards",
			ResourceID: "1",
		}, nil)
		require.NoError(t, err)

		// generate permissions in org 2
		_, err = permissionsStore.SetUserResourcePermission(context.Background(), 2, accesscontrol.User{ID: user.ID}, rs.SetResourcePermissionCommand{
			Actions:    []string{"dashboards:write"},
			Resource:   "dashboards",
			ResourceID: "1",
		}, nil)
		require.NoError(t, err)

		err = store.DeleteUserPermissions(context.Background(), accesscontrol.GlobalOrgID, user.ID)
		require.NoError(t, err)

		permissions, err := store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
			OrgID:  1,
			UserID: user.ID,
			Roles:  []string{"Admin"},
		})
		require.NoError(t, err)
		assert.Len(t, permissions, 0)

		permissions, err = store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
			OrgID:  2,
			UserID: user.ID,
			Roles:  []string{"Admin"},
		})
		require.NoError(t, err)
		assert.Len(t, permissions, 0)
	})

	t.Run("expect permissions in org 1 to be deleted", func(t *testing.T) {
		store, permissionsStore, sql, teamSvc, _ := setupTestEnv(t)
		user, _ := createUserAndTeam(t, sql, teamSvc, 1)

		// generate permissions in org 1
		_, err := permissionsStore.SetUserResourcePermission(context.Background(), 1, accesscontrol.User{ID: user.ID}, rs.SetResourcePermissionCommand{
			Actions:    []string{"dashboards:write"},
			Resource:   "dashboards",
			ResourceID: "1",
		}, nil)
		require.NoError(t, err)

		// generate permissions in org 2
		_, err = permissionsStore.SetUserResourcePermission(context.Background(), 2, accesscontrol.User{ID: user.ID}, rs.SetResourcePermissionCommand{
			Actions:    []string{"dashboards:write"},
			Resource:   "dashboards",
			ResourceID: "1",
		}, nil)
		require.NoError(t, err)

		err = store.DeleteUserPermissions(context.Background(), 1, user.ID)
		require.NoError(t, err)

		permissions, err := store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
			OrgID:  1,
			UserID: user.ID,
			Roles:  []string{"Admin"},
		})
		require.NoError(t, err)
		assert.Len(t, permissions, 0)

		permissions, err = store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
			OrgID:  2,
			UserID: user.ID,
			Roles:  []string{"Admin"},
		})
		require.NoError(t, err)
		assert.Len(t, permissions, 1)
	})
}

func createUserAndTeam(t *testing.T, userSrv user.Service, teamSvc team.Service, orgID int64) (*user.User, models.Team) {
	t.Helper()

	user, err := userSrv.Create(context.Background(), &user.CreateUserCommand{
		Login: "user",
		OrgID: orgID,
	})
	require.NoError(t, err)

	team, err := teamSvc.CreateTeam("team", "", orgID)
	require.NoError(t, err)

	err = teamSvc.AddTeamMember(user.ID, orgID, team.Id, false, models.PERMISSION_VIEW)
	require.NoError(t, err)

	return user, team
}

type helperServices struct {
	userSvc user.Service
	teamSvc team.Service
	orgSvc  org.Service
}

type testUser struct {
	orgRole org.RoleType
	isAdmin bool
}

type dbUser struct {
	userID int64
	teamID int64
}

func createUsersAndTeams(t *testing.T, svcs helperServices, orgID int64, users []testUser) []dbUser {
	t.Helper()
	res := []dbUser{}

	for i := range users {
		user, err := svcs.userSvc.Create(context.Background(), &user.CreateUserCommand{
			Login:   fmt.Sprintf("user%v", i+1),
			OrgID:   orgID,
			IsAdmin: users[i].isAdmin,
		})
		require.NoError(t, err)

		// User is not member of the org
		if users[i].orgRole == "" {
			err = svcs.orgSvc.RemoveOrgUser(context.Background(),
				&org.RemoveOrgUserCommand{OrgID: orgID, UserID: user.ID})
			require.NoError(t, err)

			res = append(res, dbUser{userID: user.ID})
			continue
		}

		team, err := svcs.teamSvc.CreateTeam(fmt.Sprintf("team%v", i+1), "", orgID)
		require.NoError(t, err)

		err = svcs.teamSvc.AddTeamMember(user.ID, orgID, team.Id, false, models.PERMISSION_VIEW)
		require.NoError(t, err)

		err = svcs.orgSvc.UpdateOrgUser(context.Background(),
			&org.UpdateOrgUserCommand{Role: users[i].orgRole, OrgID: orgID, UserID: user.ID})
		require.NoError(t, err)

		res = append(res, dbUser{userID: user.ID, teamID: team.Id})
	}

	return res
}

func setupTestEnv(t testing.TB) (*AccessControlStore, rs.Store, user.Service, team.Service, org.Service) {
	sql, cfg := db.InitTestDBwithCfg(t)
	acstore := ProvideService(sql)
	permissionStore := rs.NewStore(sql)
	teamService := teamimpl.ProvideService(sql, cfg)
	orgService, err := orgimpl.ProvideService(sql, cfg, quotatest.New(false, nil))
	require.NoError(t, err)
	userService, err := userimpl.ProvideService(sql, orgService, cfg, teamService, localcache.ProvideService(), quotatest.New(false, nil))
	require.NoError(t, err)
	return acstore, permissionStore, userService, teamService, orgService
}

func TestAccessControlStore_SearchUsersPermissions(t *testing.T) {
	ctx := context.Background()
	options := accesscontrol.SearchOptions{ActionPrefix: "teams:"}
	readTeamPerm := func(teamID string) rs.SetResourcePermissionCommand {
		return rs.SetResourcePermissionCommand{
			Actions:           []string{"teams:read"},
			Resource:          "teams",
			ResourceAttribute: "id",
			ResourceID:        teamID,
		}
	}
	writeTeamPerm := func(teamID string) rs.SetResourcePermissionCommand {
		return rs.SetResourcePermissionCommand{
			Actions:           []string{"teams:read", "teams:write"},
			Resource:          "teams",
			ResourceAttribute: "id",
			ResourceID:        teamID,
		}
	}
	readDashPerm := func(dashUID string) rs.SetResourcePermissionCommand {
		return rs.SetResourcePermissionCommand{
			Actions:           []string{"dashboards:read"},
			Resource:          "dashboards",
			ResourceAttribute: "uid",
			ResourceID:        dashUID,
		}
	}
	tests := []struct {
		name     string
		users    []testUser
		permCmds []rs.SetResourcePermissionsCommand
		wantPerm map[int64][]accesscontrol.Permission
		wantErr  bool
	}{
		{
			name:  "user assignment",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
			},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name: "users assignment",
			users: []testUser{
				{orgRole: org.RoleAdmin, isAdmin: false},
				{orgRole: org.RoleEditor, isAdmin: false},
			},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: writeTeamPerm("1")},
				{User: accesscontrol.User{ID: 2, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("2")},
			},
			wantPerm: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}, {Action: "teams:write", Scope: "teams:id:1"}},
				2: {{Action: "teams:read", Scope: "teams:id:2"}},
			},
		},
		{
			name:     "team assignment",
			users:    []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{{TeamID: 1, SetResourcePermissionCommand: readTeamPerm("1")}},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name:  "basic role assignment",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{BuiltinRole: string(org.RoleAdmin), SetResourcePermissionCommand: readTeamPerm("1")},
			},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name:  "server admin assignment",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: true}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{BuiltinRole: accesscontrol.RoleGrafanaAdmin, SetResourcePermissionCommand: readTeamPerm("1")},
			},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name: "all assignments",
			users: []testUser{
				{orgRole: org.RoleAdmin, isAdmin: true},
				{orgRole: org.RoleEditor, isAdmin: false},
			},
			permCmds: []rs.SetResourcePermissionsCommand{
				// User assignments
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
				{User: accesscontrol.User{ID: 2, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("2")},
				// Team assignments
				{TeamID: 1, SetResourcePermissionCommand: readTeamPerm("10")},
				{TeamID: 2, SetResourcePermissionCommand: readTeamPerm("20")},
				// Basic Assignments
				{BuiltinRole: string(org.RoleAdmin), SetResourcePermissionCommand: readTeamPerm("100")},
				{BuiltinRole: string(org.RoleEditor), SetResourcePermissionCommand: readTeamPerm("200")},
				// Server Admin Assignment
				{BuiltinRole: accesscontrol.RoleGrafanaAdmin, SetResourcePermissionCommand: readTeamPerm("1000")},
			},
			wantPerm: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}, {Action: "teams:read", Scope: "teams:id:10"},
					{Action: "teams:read", Scope: "teams:id:100"}, {Action: "teams:read", Scope: "teams:id:1000"}},
				2: {{Action: "teams:read", Scope: "teams:id:2"}, {Action: "teams:read", Scope: "teams:id:20"},
					{Action: "teams:read", Scope: "teams:id:200"}},
			},
		},
		{
			name:  "filter permissions by action prefix",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: true}},
			permCmds: []rs.SetResourcePermissionsCommand{
				// User assignments
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readDashPerm("d1")},
				// Team assignments
				{TeamID: 1, SetResourcePermissionCommand: readTeamPerm("10")},
				{TeamID: 1, SetResourcePermissionCommand: readDashPerm("d10")},
				// Basic Assignments
				{BuiltinRole: string(org.RoleAdmin), SetResourcePermissionCommand: readTeamPerm("100")},
				{BuiltinRole: string(org.RoleAdmin), SetResourcePermissionCommand: readDashPerm("d100")},
				// Server Admin Assignment
				{BuiltinRole: accesscontrol.RoleGrafanaAdmin, SetResourcePermissionCommand: readTeamPerm("1000")},
				{BuiltinRole: accesscontrol.RoleGrafanaAdmin, SetResourcePermissionCommand: readDashPerm("d1000")},
			},
			wantPerm: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}, {Action: "teams:read", Scope: "teams:id:10"},
					{Action: "teams:read", Scope: "teams:id:100"}, {Action: "teams:read", Scope: "teams:id:1000"}},
			},
		},
		{
			name: "include not org member server admin permissions",
			// Three users, one member, one not member but Server Admin, one not member and not server admin
			users:    []testUser{{orgRole: org.RoleAdmin, isAdmin: false}, {isAdmin: true}, {}},
			permCmds: []rs.SetResourcePermissionsCommand{{BuiltinRole: accesscontrol.RoleGrafanaAdmin, SetResourcePermissionCommand: readTeamPerm("1")}},
			wantPerm: map[int64][]accesscontrol.Permission{
				2: {{Action: "teams:read", Scope: "teams:id:1"}},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			acStore, permissionsStore, userSvc, teamSvc, orgSvc := setupTestEnv(t)
			dbUsers := createUsersAndTeams(t, helperServices{userSvc, teamSvc, orgSvc}, 1, tt.users)

			// Switch userID and TeamID by the real stored ones
			for i := range tt.permCmds {
				if tt.permCmds[i].User.ID != 0 {
					tt.permCmds[i].User.ID = dbUsers[tt.permCmds[i].User.ID-1].userID
				}
				if tt.permCmds[i].TeamID != 0 {
					tt.permCmds[i].TeamID = dbUsers[tt.permCmds[i].TeamID-1].teamID
				}
			}
			_, err := permissionsStore.SetResourcePermissions(ctx, 1, tt.permCmds, rs.ResourceHooks{})
			require.NoError(t, err)

			// Test
			dbPermissions, err := acStore.SearchUsersPermissions(ctx, 1, options)
			if tt.wantErr {
				require.NotNil(t, err)
				return
			}
			require.Nil(t, err)
			require.Len(t, dbPermissions, len(tt.wantPerm))

			for userID, expectedUserPerms := range tt.wantPerm {
				dbUserPerms, ok := dbPermissions[dbUsers[userID-1].userID]
				require.True(t, ok, "expected permissions for user", userID)
				require.ElementsMatch(t, expectedUserPerms, dbUserPerms)
			}
		})
	}
}

func TestAccessControlStore_GetUsersBasicRoles(t *testing.T) {
	ctx := context.Background()
	tests := []struct {
		name      string
		users     []testUser
		wantRoles map[int64][]string
		wantErr   bool
	}{
		{
			name:      "user with basic role",
			users:     []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			wantRoles: map[int64][]string{1: {string(org.RoleAdmin)}},
		},
		{
			name: "one admin, one editor",
			users: []testUser{
				{orgRole: org.RoleAdmin, isAdmin: false},
				{orgRole: org.RoleEditor, isAdmin: false},
			},
			wantRoles: map[int64][]string{
				1: {string(org.RoleAdmin)},
				2: {string(org.RoleEditor)},
			},
		},
		{
			name:  "one org member, one not member but Server Admin, one not member and not server admin",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}, {isAdmin: true}, {}},
			wantRoles: map[int64][]string{
				1: {string(org.RoleAdmin)},
				2: {accesscontrol.RoleGrafanaAdmin},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			acStore, _, userSvc, teamSvc, orgSvc := setupTestEnv(t)
			dbUsers := createUsersAndTeams(t, helperServices{userSvc, teamSvc, orgSvc}, 1, tt.users)

			// Test
			dbRoles, err := acStore.GetUsersBasicRoles(ctx, 1)
			if tt.wantErr {
				require.NotNil(t, err)
				return
			}
			require.Nil(t, err)
			require.Len(t, dbRoles, len(tt.wantRoles))

			for userID, expectedUserRoles := range tt.wantRoles {
				dbUserRoles, ok := dbRoles[dbUsers[userID-1].userID]
				require.True(t, ok, "expected organization role for user", userID)
				require.ElementsMatch(t, expectedUserRoles, dbUserRoles)
			}
		})
	}
}
