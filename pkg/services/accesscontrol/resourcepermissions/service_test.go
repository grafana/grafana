package resourcepermissions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type setUserPermissionTest struct {
	desc     string
	callHook bool
}

func TestIntegrationService_SetUserPermission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			service, usrSvc, _ := setupTestEnvironment(t, Options{
				Resource:             "dashboards",
				Assignments:          Assignments{Users: true},
				PermissionsToActions: nil,
			})

			// seed user
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

func TestIntegrationService_SetTeamPermission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			service, _, teamSvc := setupTestEnvironment(t, Options{
				Resource:             "dashboards",
				Assignments:          Assignments{Teams: true},
				PermissionsToActions: nil,
			})

			// seed team
			teamCmd := team.CreateTeamCommand{
				Name:  "test",
				Email: "test@test.com",
				OrgID: 1,
			}
			team, err := teamSvc.CreateTeam(context.Background(), &teamCmd)
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

func TestIntegrationService_SetBuiltInRolePermission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			service, _, _ := setupTestEnvironment(t, Options{
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

func TestIntegrationService_SetPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			service, usrSvc, teamSvc := setupTestEnvironment(t, tt.options)

			// seed user
			_, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "user", OrgID: 1})
			require.NoError(t, err)

			teamCmd := team.CreateTeamCommand{
				Name:  "test",
				OrgID: 1,
			}
			_, err = teamSvc.CreateTeam(context.Background(), &teamCmd)
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

func TestIntegrationService_RegisterActionSets(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type registerActionSetsTest struct {
		desc               string
		options            Options
		expectedActionSets []ActionSet
	}

	tests := []registerActionSetsTest{
		{
			desc: "should register folder action sets if action sets are enabled",
			options: Options{
				Resource: "folders",
				PermissionsToActions: map[string][]string{
					"View": {"folders:read", "dashboards:read"},
					"Edit": {"folders:read", "dashboards:read", "folders:write", "dashboards:write"},
				},
			},
			expectedActionSets: []ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"folders:read", "dashboards:read"},
				},
				{
					Action:  "folders:edit",
					Actions: []string{"folders:read", "dashboards:read", "folders:write", "dashboards:write", "folders:create"},
				},
			},
		},
		{
			desc: "should register dashboard action set if action sets are enabled",
			options: Options{
				Resource: "dashboards",
				PermissionsToActions: map[string][]string{
					"View": {"dashboards:read"},
				},
			},
			expectedActionSets: []ActionSet{
				{
					Action:  "dashboards:view",
					Actions: []string{"dashboards:read"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			features := featuremgmt.WithFeatures()
			ac := acimpl.ProvideAccessControl(features)
			actionSets := NewActionSetService()
			_, err := New(
				setting.NewCfg(), tt.options, features, routing.NewRouteRegister(), licensingtest.NewFakeLicensing(),
				ac, &actest.FakeService{}, db.InitTestDB(t), nil, nil, actionSets,
			)
			require.NoError(t, err)

			if len(tt.expectedActionSets) > 0 {
				for _, expectedActionSet := range tt.expectedActionSets {
					actionSet := actionSets.ResolveActionSet(expectedActionSet.Action)
					assert.ElementsMatch(t, expectedActionSet.Actions, actionSet)
				}
			} else {
				// Check that action sets have not been registered
				for permission := range tt.options.PermissionsToActions {
					actionSetName := GetActionSetName(tt.options.Resource, permission)
					assert.Nil(t, actionSets.ResolveActionSet(actionSetName))
				}
			}
		})
	}
}

func TestStore_RegisterActionSet(t *testing.T) {
	type actionSetTest struct {
		desc               string
		pluginID           string
		pluginActions      []plugins.ActionSet
		coreActionSets     []ActionSet
		expectedErr        bool
		expectedActionSets []ActionSet
	}

	tests := []actionSetTest{
		{
			desc:     "should be able to register a plugin action set",
			pluginID: "test-app",
			pluginActions: []plugins.ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"test-app.resource:read"},
				},
			},
			expectedActionSets: []ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"test-app.resource:read"},
				},
			},
		},
		{
			desc:     "should be able to register multiple plugin action sets",
			pluginID: "test-app",
			pluginActions: []plugins.ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"test-app.resource:read"},
				},
				{
					Action:  "folders:edit",
					Actions: []string{"test-app.resource:write", "test-app.resource:delete"},
				},
			},
			expectedActionSets: []ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"test-app.resource:read"},
				},
				{
					Action:  "folders:edit",
					Actions: []string{"test-app.resource:write", "test-app.resource:delete"},
				},
			},
		},
		{
			desc:     "action set actions should be added not replaced",
			pluginID: "test-app",
			pluginActions: []plugins.ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"test-app.resource:read"},
				},
				{
					Action:  "folders:edit",
					Actions: []string{"test-app.resource:write", "test-app.resource:delete"},
				},
			},
			coreActionSets: []ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"folders:read"},
				},
				{
					Action:  "folders:edit",
					Actions: []string{"folders:write", "folders:delete"},
				},
				{
					Action:  "folders:admin",
					Actions: []string{"folders.permissions:read"},
				},
			},
			expectedActionSets: []ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"folders:read", "test-app.resource:read"},
				},
				{
					Action:  "folders:edit",
					Actions: []string{"folders:write", "test-app.resource:write", "folders:delete", "test-app.resource:delete"},
				},
				{
					Action:  "folders:admin",
					Actions: []string{"folders.permissions:read"},
				},
			},
		},
		{
			desc:     "should not be able to register an action that doesn't have a plugin prefix",
			pluginID: "test-app",
			pluginActions: []plugins.ActionSet{
				{
					Action:  "folders:view",
					Actions: []string{"test-app.resource:read"},
				},
				{
					Action:  "folders:edit",
					Actions: []string{"users:read", "test-app.resource:delete"},
				},
			},
			expectedErr: true,
		},
		{
			desc:     "should not be able to register action set that is not in the allow list",
			pluginID: "test-app",
			pluginActions: []plugins.ActionSet{
				{
					Action:  "folders:super-admin",
					Actions: []string{"test-app.resource:read"},
				},
			},
			expectedErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			asService := NewActionSetService()

			err := asService.RegisterActionSets(context.Background(), tt.pluginID, tt.pluginActions)
			if tt.expectedErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			for _, set := range tt.coreActionSets {
				asService.StoreActionSet(set.Action, set.Actions)
			}

			for _, expected := range tt.expectedActionSets {
				actions := asService.ResolveActionSet(expected.Action)
				if expected.Action == "folders:edit" || expected.Action == "folders:admin" {
					expected.Actions = append(expected.Actions, "folders:create")
				}
				assert.ElementsMatch(t, expected.Actions, actions)
			}

			if len(tt.expectedActionSets) == 0 {
				for _, set := range tt.pluginActions {
					registeredActions := asService.ResolveActionSet(set.Action)
					assert.Empty(t, registeredActions, "no actions from plugin action sets should have been registered")
				}
			}
		})
	}
}

func setupTestEnvironment(t *testing.T, ops Options) (*Service, user.Service, team.Service) {
	t.Helper()

	sql := db.InitTestDB(t)
	cfg := setting.NewCfg()
	tracer := tracing.InitializeTracerForTest()

	teamSvc, err := teamimpl.ProvideService(sql, cfg, tracer)
	require.NoError(t, err)

	orgSvc, err := orgimpl.ProvideService(sql, cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	userSvc, err := userimpl.ProvideService(
		sql, orgSvc, cfg, teamSvc, nil, tracer,
		quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()
	acService := &actest.FakeService{}
	features := featuremgmt.WithFeatures()
	ac := acimpl.ProvideAccessControl(features)
	service, err := New(
		cfg, ops, features, routing.NewRouteRegister(), license,
		ac, acService, sql, teamSvc, userSvc, NewActionSetService(),
	)
	require.NoError(t, err)

	return service, userSvc, teamSvc
}
