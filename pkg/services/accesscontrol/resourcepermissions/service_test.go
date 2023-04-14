package resourcepermissions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
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
			service, sql, _ := setupTestEnvironment(t, []accesscontrol.Permission{}, Options{
				Resource:             "dashboards",
				Assignments:          Assignments{Users: true},
				PermissionsToActions: nil,
			})

			// seed user
			orgSvc, err := orgimpl.ProvideService(sql, sql.Cfg, quotatest.New(false, nil))
			require.NoError(t, err)
			usrSvc, err := userimpl.ProvideService(sql, orgSvc, sql.Cfg, nil, nil, &quotatest.FakeQuotaService{}, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
			require.NoError(t, err)
			user, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)

			var hookCalled bool
			if tt.callHook {
				service.options.OnSetUser = func(session *db.Session, orgID int64, user accesscontrol.User, resourceID, permission string) error {
					hookCalled = true
					return nil
				}
			}

			_, err = service.SetUserPermission(context.Background(), user.OrgID, accesscontrol.User{ID: user.ID}, "1", "")
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
			service, _, teamSvc := setupTestEnvironment(t, []accesscontrol.Permission{}, Options{
				Resource:             "dashboards",
				Assignments:          Assignments{Teams: true},
				PermissionsToActions: nil,
			})

			// seed team
			team, err := teamSvc.CreateTeam("test", "test@test.com", 1)
			require.NoError(t, err)

			var hookCalled bool
			if tt.callHook {
				service.options.OnSetTeam = func(session *db.Session, orgID, teamID int64, resourceID, permission string) error {
					hookCalled = true
					return nil
				}
			}

			_, err = service.SetTeamPermission(context.Background(), team.OrgID, team.ID, "1", "")
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
			service, _, _ := setupTestEnvironment(t, []accesscontrol.Permission{}, Options{
				Resource:             "dashboards",
				Assignments:          Assignments{BuiltInRoles: true},
				PermissionsToActions: nil,
			})

			var hookCalled bool
			if tt.callHook {
				service.options.OnSetBuiltInRole = func(session *db.Session, orgID int64, builtInRole, resourceID, permission string) error {
					hookCalled = true
					return nil
				}
			}

			_, err := service.SetBuiltInRolePermission(context.Background(), 1, "Viewer", "1", "")
			require.NoError(t, err)
			assert.Equal(t, tt.callHook, hookCalled)
		})
	}
}

type setPermissionsTest struct {
	desc      string
	options   Options
	commands  []accesscontrol.SetResourcePermissionCommand
	expectErr bool
}

func TestService_SetPermissions(t *testing.T) {
	tests := []setPermissionsTest{
		{
			desc: "should set all permissions",
			options: Options{
				Resource: "dashboards",
				Assignments: Assignments{
					Users:        true,
					Teams:        true,
					BuiltInRoles: true,
				},
				PermissionsToActions: map[string][]string{
					"View": {"dashboards:read"},
				},
			},
			commands: []accesscontrol.SetResourcePermissionCommand{
				{UserID: 1, Permission: "View"},
				{TeamID: 1, Permission: "View"},
				{BuiltinRole: "Editor", Permission: "View"},
			},
		},
		{
			desc: "should return error for invalid permission",
			options: Options{
				Resource: "dashboards",
				Assignments: Assignments{
					Users:        true,
					Teams:        true,
					BuiltInRoles: true,
				},
				PermissionsToActions: map[string][]string{
					"View": {"dashboards:read"},
				},
			},
			commands: []accesscontrol.SetResourcePermissionCommand{
				{UserID: 1, Permission: "View"},
				{TeamID: 1, Permission: "View"},
				{BuiltinRole: "Editor", Permission: "Not real permission"},
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, sql, teamSvc := setupTestEnvironment(t, []accesscontrol.Permission{}, tt.options)

			// seed user
			orgSvc, err := orgimpl.ProvideService(sql, sql.Cfg, quotatest.New(false, nil))
			require.NoError(t, err)
			usrSvc, err := userimpl.ProvideService(sql, orgSvc, sql.Cfg, nil, nil, &quotatest.FakeQuotaService{}, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
			require.NoError(t, err)
			_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "user", OrgID: 1})
			require.NoError(t, err)
			_, err = teamSvc.CreateTeam("team", "", 1)
			require.NoError(t, err)

			permissions, err := service.SetPermissions(context.Background(), 1, "1", tt.commands...)
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Len(t, permissions, len(tt.commands))
			}
		})
	}
}

func setupTestEnvironment(t *testing.T, permissions []accesscontrol.Permission, ops Options) (*Service, *sqlstore.SQLStore, team.Service) {
	t.Helper()

	sql := db.InitTestDB(t)
	cfg := setting.NewCfg()
	teamSvc := teamimpl.ProvideService(sql, cfg)
	userSvc, err := userimpl.ProvideService(sql, nil, cfg, teamimpl.ProvideService(sql, cfg), nil, quotatest.New(false, nil), &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)
	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()
	mock := accesscontrolmock.New().WithPermissions(permissions)
	service, err := New(
		ops, cfg, routing.NewRouteRegister(), license,
		accesscontrolmock.New().WithPermissions(permissions), mock, sql, teamSvc, userSvc,
	)
	require.NoError(t, err)

	return service, sql, teamSvc
}
