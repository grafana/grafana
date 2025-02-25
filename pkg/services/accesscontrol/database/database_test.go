package database_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	rs "github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

// run tests with cleanup
func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type getUserPermissionsTestCase struct {
	desc               string
	anonymousUser      bool
	orgID              int64
	role               string
	userPermissions    []string
	teamPermissions    []string
	builtinPermissions []string
	expected           int
	policyCount        int
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
			policyCount:        7,
		},
		{
			desc:               "Should not get admin roles",
			orgID:              1,
			role:               "Viewer",
			userPermissions:    []string{"1", "2", "10"},
			teamPermissions:    []string{"100", "2"},
			builtinPermissions: []string{"5", "6"},
			expected:           5,
			policyCount:        7,
		},
		{
			desc:               "Should work without org role",
			orgID:              1,
			role:               "",
			userPermissions:    []string{"1", "2", "10"},
			teamPermissions:    []string{"100", "2"},
			builtinPermissions: []string{"5", "6"},
			expected:           5,
			policyCount:        7,
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
			policyCount:        7,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store, permissionStore, usrSvc, teamSvc, _, sql := setupTestEnv(t)

			user, team := createUserAndTeam(t, sql, usrSvc, teamSvc, tt.orgID)

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

type getTeamsPermissionsTestCase struct {
	desc             string
	orgID            int64
	teamsPermissions [][]string
	teamsToQuery     []int
	expected         int
}

func TestAccessControlStore_GetTeamsPermissions(t *testing.T) {
	tests := []getTeamsPermissionsTestCase{
		{
			desc:  "should successfully get team permissions",
			orgID: 1,
			teamsPermissions: [][]string{
				{"100", "2"},
				{"101", "3"},
			},
			teamsToQuery: []int{0, 1},
			expected:     4,
		},
		{
			desc:  "Should not get permissions for teams not listed in the query",
			orgID: 1,
			teamsPermissions: [][]string{
				{"100", "2"},
				{"101", "3"},
			},
			teamsToQuery: []int{0},
			expected:     2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store, permissionStore, _, teamSvc, _, _ := setupTestEnv(t)

			teams := make([]team.Team, 0)
			for i := 0; i < len(tt.teamsPermissions); i++ {
				team, err := teamSvc.CreateTeam(context.Background(), fmt.Sprintf("team-%v", i), "", tt.orgID)
				require.NoError(t, err)
				teams = append(teams, team)
			}

			for teamIDx, teamPermissions := range tt.teamsPermissions {
				for _, id := range teamPermissions {
					team := teams[teamIDx]
					_, err := permissionStore.SetTeamResourcePermission(context.Background(), tt.orgID, team.ID, rs.SetResourcePermissionCommand{
						Actions:    []string{"dashboards:read"},
						Resource:   "dashboards",
						ResourceID: id,
					}, nil)
					require.NoError(t, err)
				}
			}

			teamIDs := make([]int64, 0)
			for _, teamIDx := range tt.teamsToQuery {
				if teamIDx < len(teams) {
					teamIDs = append(teamIDs, teams[teamIDx].ID)
				}
			}

			teamsPermissions, err := store.GetTeamsPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
				TeamIDs: teamIDs,
				OrgID:   tt.orgID,
			})
			require.NoError(t, err)

			permissions := make([]accesscontrol.Permission, 0)
			for _, teamPermissions := range teamsPermissions {
				permissions = append(permissions, teamPermissions...)
			}
			assert.Len(t, permissions, tt.expected)
		})
	}
}

func TestAccessControlStore_DeleteUserPermissions(t *testing.T) {
	t.Run("expect permissions in all orgs to be deleted", func(t *testing.T) {
		store, permissionsStore, usrSvc, teamSvc, _, sql := setupTestEnv(t)
		user, _ := createUserAndTeam(t, sql, usrSvc, teamSvc, 1)

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
		store, permissionsStore, usrSvc, teamSvc, _, sql := setupTestEnv(t)
		user, _ := createUserAndTeam(t, sql, usrSvc, teamSvc, 1)

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

func TestAccessControlStore_DeleteTeamPermissions(t *testing.T) {
	t.Run("expect permissions related to team to be deleted", func(t *testing.T) {
		store, permissionsStore, usrSvc, teamSvc, _, sql := setupTestEnv(t)
		user, team := createUserAndTeam(t, sql, usrSvc, teamSvc, 1)

		// grant permission to the team
		_, err := permissionsStore.SetTeamResourcePermission(context.Background(), 1, team.ID, rs.SetResourcePermissionCommand{
			Actions:           []string{"dashboards:write"},
			Resource:          "dashboards",
			ResourceAttribute: "uid",
			ResourceID:        "xxYYzz",
		}, nil)
		require.NoError(t, err)

		// generate permissions scoped to the team
		_, err = permissionsStore.SetUserResourcePermission(context.Background(), 1, accesscontrol.User{ID: user.ID}, rs.SetResourcePermissionCommand{
			Actions:           []string{"team:read"},
			Resource:          "teams",
			ResourceAttribute: "id",
			ResourceID:        fmt.Sprintf("%d", team.ID),
		}, nil)
		require.NoError(t, err)

		err = store.DeleteTeamPermissions(context.Background(), 1, team.ID)
		require.NoError(t, err)

		permissions, err := store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
			OrgID:   1,
			UserID:  user.ID,
			Roles:   []string{"Admin"},
			TeamIDs: []int64{team.ID},
		})
		require.NoError(t, err)
		assert.Len(t, permissions, 0)
	})
	t.Run("expect permissions not related to team to be kept", func(t *testing.T) {
		store, permissionsStore, usrSvc, teamSvc, _, sql := setupTestEnv(t)
		user, team := createUserAndTeam(t, sql, usrSvc, teamSvc, 1)

		// grant permission to the team
		_, err := permissionsStore.SetTeamResourcePermission(context.Background(), 1, team.ID, rs.SetResourcePermissionCommand{
			Actions:           []string{"dashboards:write"},
			Resource:          "dashboards",
			ResourceAttribute: "uid",
			ResourceID:        "xxYYzz",
		}, nil)
		require.NoError(t, err)

		// generate permissions scoped to another team
		_, err = permissionsStore.SetUserResourcePermission(context.Background(), 1, accesscontrol.User{ID: user.ID}, rs.SetResourcePermissionCommand{
			Actions:           []string{"team:read"},
			Resource:          "teams",
			ResourceAttribute: "id",
			ResourceID:        fmt.Sprintf("%d", team.ID+1),
		}, nil)
		require.NoError(t, err)

		err = store.DeleteTeamPermissions(context.Background(), 1, team.ID)
		require.NoError(t, err)

		permissions, err := store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
			OrgID:   1,
			UserID:  user.ID,
			Roles:   []string{"Admin"},
			TeamIDs: []int64{team.ID},
		})
		require.NoError(t, err)
		assert.Len(t, permissions, 1)
	})
}

func createUserAndTeam(t *testing.T, store db.DB, userSrv user.Service, teamSvc team.Service, orgID int64) (*user.User, team.Team) {
	t.Helper()

	user, err := userSrv.Create(context.Background(), &user.CreateUserCommand{
		Login: "user",
		OrgID: orgID,
	})
	require.NoError(t, err)

	createdTeam, err := teamSvc.CreateTeam(context.Background(), "team", "", orgID)
	require.NoError(t, err)

	err = store.WithDbSession(context.Background(), func(sess *db.Session) error {
		return teamimpl.AddOrUpdateTeamMemberHook(sess, user.ID, orgID, createdTeam.ID, false, team.PermissionTypeMember)
	})
	require.NoError(t, err)

	return user, createdTeam
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

func createUsersAndTeams(t *testing.T, store db.DB, svcs helperServices, orgID int64, users []testUser) []dbUser {
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

		createdTeam, err := svcs.teamSvc.CreateTeam(context.Background(), fmt.Sprintf("team%v", i+1), "", orgID)
		require.NoError(t, err)

		err = store.WithDbSession(context.Background(), func(sess *db.Session) error {
			return teamimpl.AddOrUpdateTeamMemberHook(sess, user.ID, orgID, createdTeam.ID, false, team.PermissionTypeMember)
		})
		require.NoError(t, err)

		err = svcs.orgSvc.UpdateOrgUser(context.Background(),
			&org.UpdateOrgUserCommand{Role: users[i].orgRole, OrgID: orgID, UserID: user.ID})
		require.NoError(t, err)

		res = append(res, dbUser{userID: user.ID, teamID: createdTeam.ID})
	}

	return res
}

func setupTestEnv(t testing.TB) (*database.AccessControlStore, rs.Store, user.Service, team.Service, org.Service, *sqlstore.SQLStore) {
	sql, cfg := db.InitTestDBWithCfg(t)
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgRole = "Viewer"
	cfg.AutoAssignOrgId = 1
	acstore := database.ProvideService(sql)
	permissionStore := rs.NewStore(cfg, sql, featuremgmt.WithFeatures())
	teamService, err := teamimpl.ProvideService(sql, cfg, tracing.InitializeTracerForTest())
	require.NoError(t, err)
	orgService, err := orgimpl.ProvideService(sql, cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	orgID, err := orgService.GetOrCreate(context.Background(), "test")
	require.Equal(t, int64(1), orgID)
	require.NoError(t, err)

	userService, err := userimpl.ProvideService(
		sql, orgService, cfg, teamService, localcache.ProvideService(), tracing.InitializeTracerForTest(),
		quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)
	return acstore, permissionStore, userService, teamService, orgService, sql
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
			name:  "user assignment by scope",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("*")}, // hack to have a global permission
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: writeTeamPerm("1")},
			},
			options: accesscontrol.SearchOptions{Scope: "teams:id:1"},
			wantPerm: map[int64][]accesscontrol.Permission{1: {
				{Action: "teams:read", Scope: "teams:id:*"},
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
		{
			name:  "user assignment by role prefixes",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
			},
			options:  accesscontrol.SearchOptions{RolePrefixes: []string{accesscontrol.ManagedRolePrefix}},
			wantPerm: map[int64][]accesscontrol.Permission{1: {{Action: "teams:read", Scope: "teams:id:1"}}},
		},
		{
			name:  "filter out permissions by role prefix",
			users: []testUser{{orgRole: org.RoleAdmin, isAdmin: false}},
			permCmds: []rs.SetResourcePermissionsCommand{
				{User: accesscontrol.User{ID: 1, IsExternal: false}, SetResourcePermissionCommand: readTeamPerm("1")},
			},
			options:  accesscontrol.SearchOptions{RolePrefixes: []string{accesscontrol.BasicRolePrefix}},
			wantPerm: map[int64][]accesscontrol.Permission{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			acStore, permissionsStore, userSvc, teamSvc, orgSvc, sql := setupTestEnv(t)
			dbUsers := createUsersAndTeams(t, sql, helperServices{userSvc, teamSvc, orgSvc}, 1, tt.users)

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
			acStore, _, userSvc, teamSvc, orgSvc, sql := setupTestEnv(t)
			dbUsers := createUsersAndTeams(t, sql, helperServices{userSvc, teamSvc, orgSvc}, 1, tt.users)

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
