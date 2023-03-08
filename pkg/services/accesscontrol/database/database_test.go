package database

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	rs "github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
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
				_, err := permissionStore.SetTeamResourcePermission(context.Background(), tt.orgID, team.ID, rs.SetResourcePermissionCommand{
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
			teamIDs := []int64{team.ID}
			if tt.anonymousUser {
				userID = 0
				teamIDs = []int64{}
			}
			permissions, err := store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
				OrgID:   tt.orgID,
				UserID:  userID,
				Roles:   roles,
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

func createUserAndTeam(t *testing.T, userSrv user.Service, teamSvc team.Service, orgID int64) (*user.User, team.Team) {
	t.Helper()

	user, err := userSrv.Create(context.Background(), &user.CreateUserCommand{
		Login: "user",
		OrgID: orgID,
	})
	require.NoError(t, err)

	team, err := teamSvc.CreateTeam("team", "", orgID)
	require.NoError(t, err)

	err = teamSvc.AddTeamMember(user.ID, orgID, team.ID, false, dashboards.PERMISSION_VIEW)
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
		require.Equal(t, orgID, user.OrgID)

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

		err = svcs.teamSvc.AddTeamMember(user.ID, orgID, team.ID, false, dashboards.PERMISSION_VIEW)
		require.NoError(t, err)

		err = svcs.orgSvc.UpdateOrgUser(context.Background(),
			&org.UpdateOrgUserCommand{Role: users[i].orgRole, OrgID: orgID, UserID: user.ID})
		require.NoError(t, err)

		res = append(res, dbUser{userID: user.ID, teamID: team.ID})
	}

	return res
}

func setupTestEnv(t testing.TB) (*AccessControlStore, rs.Store, user.Service, team.Service, org.Service) {
	sql, cfg := db.InitTestDBwithCfg(t)
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgRole = "Viewer"
	cfg.AutoAssignOrgId = 1
	acstore := ProvideService(sql)
	permissionStore := rs.NewStore(sql)
	teamService := teamimpl.ProvideService(sql, cfg)
	orgService, err := orgimpl.ProvideService(sql, cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	orgID, err := orgService.GetOrCreate(context.Background(), "test")
	require.Equal(t, int64(1), orgID)
	require.NoError(t, err)

	userService, err := userimpl.ProvideService(sql, orgService, cfg, teamService, localcache.ProvideService(), quotatest.New(false, nil), supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)
	return acstore, permissionStore, userService, teamService, orgService
}

func TestIntegrationAccessControlStore_SearchUsersPermissions(t *testing.T) {
	ctx := context.Background()
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
		options  accesscontrol.SearchOptions
		wantPerm map[int64][]accesscontrol.Permission
		wantErr  bool
	}{
		{
			name:  "user assignment by actionPrefix",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
			},
			options:  accesscontrol.SearchOptions{ActionPrefix: "teams:"},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name: "users assignment by actionPrefix",
			users: []testUser{
				{orgRole: org.RoleAdmin, isAdmin: false},
				{orgRole: org.RoleEditor, isAdmin: false},
			},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: writeTeamPerm("1")},
				{User: accesscontrol.User{ID: 2, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("2")},
			},
			options: accesscontrol.SearchOptions{ActionPrefix: "teams:"},
			wantPerm: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}, {Action: "teams:write", Scope: "teams:id:1"}},
				2: {{Action: "teams:read", Scope: "teams:id:2"}},
			},
		},
		{
			name:     "team assignment by actionPrefix",
			users:    []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{{TeamID: 1, SetResourcePermissionCommand: readTeamPerm("1")}},
			options:  accesscontrol.SearchOptions{ActionPrefix: "teams:"},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name:  "basic role assignment by actionPrefix",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{BuiltinRole: string(org.RoleAdmin), SetResourcePermissionCommand: readTeamPerm("1")},
			},
			options:  accesscontrol.SearchOptions{ActionPrefix: "teams:"},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name:  "server admin assignment by actionPrefix",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: true}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{BuiltinRole: accesscontrol.RoleGrafanaAdmin, SetResourcePermissionCommand: readTeamPerm("1")},
			},
			options:  accesscontrol.SearchOptions{ActionPrefix: "teams:"},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name: "all assignments by actionPrefix",
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
			options: accesscontrol.SearchOptions{ActionPrefix: "teams:"},
			wantPerm: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}, {Action: "teams:read", Scope: "teams:id:10"},
					{Action: "teams:read", Scope: "teams:id:100"}, {Action: "teams:read", Scope: "teams:id:1000"}},
				2: {{Action: "teams:read", Scope: "teams:id:2"}, {Action: "teams:read", Scope: "teams:id:20"},
					{Action: "teams:read", Scope: "teams:id:200"}},
			},
		},
		{
			name: "all assignments for one user by actionPrefix",
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
			options: accesscontrol.SearchOptions{
				ActionPrefix: "teams:",
				UserID:       1,
			},
			wantPerm: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}, {Action: "teams:read", Scope: "teams:id:10"},
					{Action: "teams:read", Scope: "teams:id:100"}, {Action: "teams:read", Scope: "teams:id:1000"}},
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
			options: accesscontrol.SearchOptions{ActionPrefix: "teams:"},
			wantPerm: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}, {Action: "teams:read", Scope: "teams:id:10"},
					{Action: "teams:read", Scope: "teams:id:100"}, {Action: "teams:read", Scope: "teams:id:1000"}},
			},
		},
		{
			name: "include not org member server admin permissions by actionPrefix",
			// Three users, one member, one not member but Server Admin, one not member and not server admin
			users:    []testUser{{orgRole: org.RoleAdmin, isAdmin: false}, {isAdmin: true}, {}},
			permCmds: []rs.SetResourcePermissionsCommand{{BuiltinRole: accesscontrol.RoleGrafanaAdmin, SetResourcePermissionCommand: readTeamPerm("1")}},
			wantPerm: map[int64][]accesscontrol.Permission{
				2: {{Action: "teams:read", Scope: "teams:id:1"}},
			},
		},
		{
			name:  "user assignment by action",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("2")},
			},
			options: accesscontrol.SearchOptions{Action: "teams:read"},
			wantPerm: map[int64][]accesscontrol.Permission{1: {
				{Action: "teams:read", Scope: "teams:id:1"},
				{Action: "teams:read", Scope: "teams:id:2"}},
			},
		},
		{
			name:  "user assignment by scope",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: writeTeamPerm("1")},
			},
			options: accesscontrol.SearchOptions{Scope: "teams:id:1"},
			wantPerm: map[int64][]accesscontrol.Permission{1: {
				{Action: "teams:read", Scope: "teams:id:1"},
				{Action: "teams:write", Scope: "teams:id:1"},
			}},
		},
		{
			name:  "user assignment by action and scope",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("2")},
			},
			options:  accesscontrol.SearchOptions{Action: "teams:read", Scope: "teams:id:1"},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
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
			dbPermissions, err := acStore.SearchUsersPermissions(ctx, 1, tt.options)
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
		name       string
		users      []testUser
		userFilter []int64
		wantRoles  map[int64][]string
		wantErr    bool
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
		{
			name:       "when filtered to one user, returns results only for that user",
			userFilter: []int64{2},
			users: []testUser{
				{orgRole: org.RoleAdmin, isAdmin: false},
				{orgRole: org.RoleEditor, isAdmin: true},
			},
			wantRoles: map[int64][]string{
				2: {string(org.RoleEditor), accesscontrol.RoleGrafanaAdmin},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			acStore, _, userSvc, teamSvc, orgSvc := setupTestEnv(t)
			dbUsers := createUsersAndTeams(t, helperServices{userSvc, teamSvc, orgSvc}, 1, tt.users)

			// Test
			dbRoles, err := acStore.GetUsersBasicRoles(ctx, tt.userFilter, 1)
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

func TestAccessControlStore_SaveExternalServiceRole(t *testing.T) {
	tests := []struct {
		name    string
		cmds    []accesscontrol.SaveExternalServiceRoleCommand
		wantErr bool
	}{
		{
			name: "create app role",
			cmds: []accesscontrol.SaveExternalServiceRoleCommand{{
				ExternalServiceID: "app1",
				Global:            true,
				ServiceAccountID:  1,
				Permissions: []accesscontrol.Permission{
					{Action: "users:read", Scope: "users:id:1"},
					{Action: "users:read", Scope: "users:id:2"},
				},
			}},
			wantErr: false,
		},
		{
			name: "update app role",
			cmds: []accesscontrol.SaveExternalServiceRoleCommand{
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:write", Scope: "users:id:2"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "allow switching role from local to global and back",
			cmds: []accesscontrol.SaveExternalServiceRoleCommand{
				{
					ExternalServiceID: "app1",
					OrgID:             1,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			s := &AccessControlStore{
				sql: db.InitTestDB(t),
			}

			for i := range tt.cmds {
				err := s.SaveExternalServiceRole(ctx, tt.cmds[i])
				if tt.wantErr {
					require.Error(t, err)
					continue
				}
				require.NoError(t, err)

				s.sql.WithDbSession(ctx, func(sess *db.Session) error {
					storedRole, err := getRoleByUID(ctx, sess, fmt.Sprintf("externalservice_%s_permissions", tt.cmds[i].ExternalServiceID))
					require.NoError(t, err)
					require.NotNil(t, storedRole)
					require.Equal(t, tt.cmds[i].Global, storedRole.Global(), "Incorrect global state of the role")
					require.Equal(t, tt.cmds[i].OrgID, storedRole.OrgID, "Incorrect OrgID of the role")

					storedPerm, err := getRolePermissions(ctx, sess, storedRole.ID)
					require.NoError(t, err)
					for i := range storedPerm {
						storedPerm[i] = accesscontrol.Permission{Action: storedPerm[i].Action, Scope: storedPerm[i].Scope}
					}
					require.ElementsMatch(t, tt.cmds[i].Permissions, storedPerm)

					var assignment accesscontrol.UserRole
					has, err := sess.Where("role_id = ? AND user_id = ?", storedRole.ID, tt.cmds[i].ServiceAccountID).Get(&assignment)
					require.NoError(t, err)
					require.True(t, has)
					require.Equal(t, tt.cmds[i].Global, assignment.OrgID == accesscontrol.GlobalOrgID, "Incorrect global state of the assignment")
					require.Equal(t, tt.cmds[i].OrgID, assignment.OrgID, "Incorrect OrgID for the role assignment")

					return nil
				})
			}
		})
	}
}
