package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	rs "github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
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
			store, permissionStore, sql := setupTestEnv(t)

			user, team := createUserAndTeam(t, sql, tt.orgID)

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
		store, permissionsStore, sql := setupTestEnv(t)
		user, _ := createUserAndTeam(t, sql, 1)

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
		store, permissionsStore, sql := setupTestEnv(t)
		user, _ := createUserAndTeam(t, sql, 1)

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

func createUserAndTeam(t *testing.T, sql *sqlstore.SQLStore, orgID int64) (*user.User, models.Team) {
	t.Helper()

	user, err := sql.CreateUser(context.Background(), user.CreateUserCommand{
		Login: "user",
		OrgID: orgID,
	})
	require.NoError(t, err)

	team, err := sql.CreateTeam("team", "", orgID)
	require.NoError(t, err)

	err = sql.AddTeamMember(user.ID, orgID, team.Id, false, models.PERMISSION_VIEW)
	require.NoError(t, err)

	return user, team
}

func setupTestEnv(t testing.TB) (*AccessControlStore, rs.Store, *sqlstore.SQLStore) {
	sql := sqlstore.InitTestDB(t)
	acstore := ProvideService(sql)
	permissionStore := rs.NewStore(sql)
	return acstore, permissionStore, sql
}
