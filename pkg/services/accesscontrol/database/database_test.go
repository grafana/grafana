package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type getUserPermissionsTestCase struct {
	desc               string
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
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store, sql := setupTestEnv(t)

			user, team := createUserAndTeam(t, sql, tt.orgID)

			for _, id := range tt.userPermissions {
				_, err := store.SetUserResourcePermissions(context.Background(), tt.orgID, user.Id, accesscontrol.SetResourcePermissionsCommand{
					Actions:    []string{"dashboards:read"},
					Resource:   "dashboards",
					ResourceID: id,
				})
				require.NoError(t, err)
			}

			for _, id := range tt.teamPermissions {
				_, err := store.SetTeamResourcePermissions(context.Background(), tt.orgID, team.Id, accesscontrol.SetResourcePermissionsCommand{
					Actions:    []string{"dashboards:read"},
					Resource:   "dashboards",
					ResourceID: id,
				})
				require.NoError(t, err)
			}

			for _, id := range tt.builtinPermissions {
				_, err := store.SetBuiltinResourcePermissions(context.Background(), tt.orgID, "Admin", accesscontrol.SetResourcePermissionsCommand{
					Actions:    []string{"dashboards:read"},
					Resource:   "dashboards",
					ResourceID: id,
				})
				require.NoError(t, err)
			}

			var roles []string
			role := models.RoleType(tt.role)

			if role.IsValid() {
				roles = append(roles, string(role))
				for _, c := range role.Children() {
					roles = append(roles, string(c))
				}
			}

			permissions, err := store.GetUserPermissions(context.Background(), accesscontrol.GetUserPermissionsQuery{
				OrgID:  tt.orgID,
				UserID: user.Id,
				Roles:  roles,
			})

			require.NoError(t, err)
			assert.Len(t, permissions, tt.expected)
		})
	}
}

func createUserAndTeam(t *testing.T, sql *sqlstore.SQLStore, orgID int64) (*models.User, models.Team) {
	t.Helper()

	user, err := sql.CreateUser(context.Background(), models.CreateUserCommand{
		Login: "user",
		OrgId: orgID,
	})
	require.NoError(t, err)

	team, err := sql.CreateTeam("team", "", orgID)
	require.NoError(t, err)

	err = sql.AddTeamMember(user.Id, orgID, team.Id, false, models.PERMISSION_VIEW)
	require.NoError(t, err)

	return user, team
}

func setupTestEnv(t testing.TB) (*AccessControlStore, *sqlstore.SQLStore) {
	store := sqlstore.InitTestDB(t)
	return ProvideService(store), store
}

type getUserResourcesPermissionsTestCase struct {
	desc             string
	orgID            int64
	role             models.RoleType
	userPermissions  accesscontrol.SetResourcePermissionsCommand
	teamPermissions  accesscontrol.SetResourcePermissionsCommand
	adminPermissions accesscontrol.SetResourcePermissionsCommand
	queryIds         []string
	expected         []*accesscontrol.Permission
}

func TestResourceStore_GetUserResourcePermissions(t *testing.T) {
	tests := []getUserResourcesPermissionsTestCase{
		{
			desc:             "Get resources metadata when user has no right",
			orgID:            2,
			role:             "Admin",
			userPermissions:  accesscontrol.SetResourcePermissionsCommand{},
			teamPermissions:  accesscontrol.SetResourcePermissionsCommand{},
			adminPermissions: accesscontrol.SetResourcePermissionsCommand{},
			queryIds:         []string{"1"},
			expected:         []*accesscontrol.Permission{},
		},
		{
			desc:  "Get resources metadata through team, user, builtin assignments",
			orgID: 2,
			role:  "Admin",
			userPermissions: accesscontrol.SetResourcePermissionsCommand{
				Actions:    []string{"resources:action1", "resources:action2"},
				Resource:   "resources",
				ResourceID: "1",
			},
			teamPermissions: accesscontrol.SetResourcePermissionsCommand{
				Actions:    []string{"resources:action1", "resources:action3"},
				Resource:   "resources",
				ResourceID: "2",
			},
			adminPermissions: accesscontrol.SetResourcePermissionsCommand{
				Actions:    []string{"resources:action1"},
				Resource:   "resources",
				ResourceID: "3",
			},
			queryIds: []string{"1", "2", "3"},
			expected: []*accesscontrol.Permission{
				{Action: "resources:action1", Scope: "resources:id:1"},
				{Action: "resources:action2", Scope: "resources:id:1"},
				{Action: "resources:action1", Scope: "resources:id:2"},
				{Action: "resources:action3", Scope: "resources:id:2"},
				{Action: "resources:action1", Scope: "resources:id:3"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store, sql := setupTestEnv(t)

			user, team := createUserAndTeam(t, sql, tt.orgID)

			_, err := store.SetUserResourcePermissions(context.Background(), tt.orgID, user.Id, tt.userPermissions)
			require.NoError(t, err)

			_, err = store.SetTeamResourcePermissions(context.Background(), tt.orgID, team.Id, tt.teamPermissions)
			require.NoError(t, err)

			_, err = store.SetBuiltinResourcePermissions(context.Background(), tt.orgID, "Admin", tt.adminPermissions)
			require.NoError(t, err)

			var roles []string
			role := models.RoleType(tt.role)

			if role.IsValid() {
				roles = append(roles, string(role))
				for _, c := range role.Children() {
					roles = append(roles, string(c))
				}
			}

			permissions, err := store.GetUserResourcePermissions(context.Background(), tt.orgID, user.Id, accesscontrol.GetUserResourcesPermissionsQuery{
				BuiltInRoles: roles,
				Resource:     "resources",
				ResourceIDs:  tt.queryIds,
			})
			assert.NoError(t, err)
			assert.EqualValues(t, tt.expected, permissions)
		})
	}
}
