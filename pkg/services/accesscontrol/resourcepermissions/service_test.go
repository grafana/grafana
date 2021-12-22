package resourcepermissions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type setUserPermissionTest struct {
	desc     string
	callHook bool
}

func TestService_SetUserPermission(t *testing.T) {
	tests := []setUserPermissionTest{
		{
			desc:     "should call hook when updating user permissions",
			callHook: true,
		},
		{
			desc:     "should not call hook when updating user permissions",
			callHook: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, sql := setupTestEnvironment(t, []*accesscontrol.Permission{}, Options{
				Resource:             "dashboards",
				Assignments:          Assignments{Users: true},
				PermissionsToActions: nil,
			})

			// seed user
			user, err := sql.CreateUser(context.Background(), models.CreateUserCommand{Login: "test", OrgId: 1})
			require.NoError(t, err)

			var hookCalled bool
			if tt.callHook {
				service.options.OnSetUser = func(ctx context.Context, orgID, userID int64, resourceID, permission string) error {
					hookCalled = true
					return nil
				}
			}

			_, err = service.SetUserPermission(context.Background(), user.OrgId, user.Id, "1", []string{})
			require.NoError(t, err)
			assert.Equal(t, tt.callHook, hookCalled)
		})
	}
}

type setTeamPermissionTest struct {
	desc     string
	callHook bool
}

func TestService_SetTeamPermission(t *testing.T) {
	tests := []setTeamPermissionTest{
		{
			desc:     "should call hook when updating user permissions",
			callHook: true,
		},
		{
			desc:     "should not call hook when updating user permissions",
			callHook: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, sql := setupTestEnvironment(t, []*accesscontrol.Permission{}, Options{
				Resource:             "dashboards",
				Assignments:          Assignments{Teams: true},
				PermissionsToActions: nil,
			})

			// seed team
			team, err := sql.CreateTeam("test", "test@test.com", 1)
			require.NoError(t, err)

			var hookCalled bool
			if tt.callHook {
				service.options.OnSetTeam = func(ctx context.Context, orgID, teamID int64, resourceID, permission string) error {
					hookCalled = true
					return nil
				}
			}

			_, err = service.SetTeamPermission(context.Background(), team.OrgId, team.Id, "1", []string{})
			require.NoError(t, err)
			assert.Equal(t, tt.callHook, hookCalled)
		})
	}
}

type setBuiltInRolePermissionTest struct {
	desc     string
	callHook bool
}

func TestService_SetBuiltInRolePermission(t *testing.T) {
	tests := []setBuiltInRolePermissionTest{
		{
			desc:     "should call hook when updating user permissions",
			callHook: true,
		},
		{
			desc:     "should not call hook when updating user permissions",
			callHook: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, _ := setupTestEnvironment(t, []*accesscontrol.Permission{}, Options{
				Resource:             "dashboards",
				Assignments:          Assignments{BuiltInRoles: true},
				PermissionsToActions: nil,
			})

			var hookCalled bool
			if tt.callHook {
				service.options.OnSetBuiltInRole = func(ctx context.Context, orgID int64, builtInRole, resourceID, permission string) error {
					hookCalled = true
					return nil
				}
			}

			_, err := service.SetBuiltInRolePermission(context.Background(), 1, "Viewer", "1", []string{})
			require.NoError(t, err)
			assert.Equal(t, tt.callHook, hookCalled)
		})
	}
}

func setupTestEnvironment(t *testing.T, permissions []*accesscontrol.Permission, ops Options) (*Service, *sqlstore.SQLStore) {
	t.Helper()

	sql := sqlstore.InitTestDB(t)
	store := database.ProvideService(sql)
	service, err := New(ops, routing.NewRouteRegister(), accesscontrolmock.New().WithPermissions(permissions), store)
	require.NoError(t, err)

	return service, sql
}
