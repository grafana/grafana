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

func TestService_RouteActionSets(t *testing.T) {
	t.Run("should register and resolve route action sets", func(t *testing.T) {
		actionSets := NewActionSetService()

		viewActions := []string{"alert.notifications.routes.managed:read"}
		editActions := []string{
			"alert.notifications.routes.managed:read",
			"alert.notifications.routes.managed:write",
			"alert.notifications.routes.managed:delete",
		}
		adminActions := append(editActions,
			"alert.notifications.routes.permissions:read",
			"alert.notifications.routes.permissions:write",
		)

		actionSets.StoreActionSet("alert.notifications.routes:view", viewActions)
		actionSets.StoreActionSet("alert.notifications.routes:edit", editActions)
		actionSets.StoreActionSet("alert.notifications.routes:admin", adminActions)

		resolved := actionSets.ResolveActionSet("alert.notifications.routes:view")
		assert.ElementsMatch(t, viewActions, resolved)

		resolved = actionSets.ResolveActionSet("alert.notifications.routes:edit")
		assert.ElementsMatch(t, editActions, resolved)

		resolved = actionSets.ResolveActionSet("alert.notifications.routes:admin")
		assert.ElementsMatch(t, adminActions, resolved)
	})

	t.Run("ResolveAction should return route action sets", func(t *testing.T) {
		actionSets := NewActionSetService()
		actionSets.StoreActionSet("alert.notifications.routes:view", []string{"alert.notifications.routes.managed:read"})
		actionSets.StoreActionSet("alert.notifications.routes:edit", []string{
			"alert.notifications.routes.managed:read",
			"alert.notifications.routes.managed:write",
			"alert.notifications.routes.managed:delete",
		})

		sets := actionSets.ResolveAction("alert.notifications.routes.managed:read")
		assert.Contains(t, sets, "alert.notifications.routes:view")
		assert.Contains(t, sets, "alert.notifications.routes:edit")

		sets = actionSets.ResolveAction("alert.notifications.routes.managed:write")
		assert.Contains(t, sets, "alert.notifications.routes:edit")
		assert.NotContains(t, sets, "alert.notifications.routes:view")
	})
}

func TestIntegrationService_RouteActionSetRegistration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	routeOptions := Options{
		Resource:          "alert.notifications.routes",
		ResourceAttribute: "uid",
		PermissionsToActions: map[string][]string{
			"View": {"alert.notifications.routes.managed:read"},
			"Edit": {
				"alert.notifications.routes.managed:read",
				"alert.notifications.routes.managed:write",
				"alert.notifications.routes.managed:delete",
			},
			"Admin": {
				"alert.notifications.routes.managed:read",
				"alert.notifications.routes.managed:write",
				"alert.notifications.routes.managed:delete",
				"alert.notifications.routes.permissions:read",
				"alert.notifications.routes.permissions:write",
			},
		},
		Assignments:    Assignments{Users: true, Teams: true, BuiltInRoles: true},
		ReaderRoleName: "Alerting route permission reader",
		WriterRoleName: "Alerting route permission writer",
		RoleGroup:      "Alerting",
	}

	features := featuremgmt.WithFeatures()
	ac := acimpl.ProvideAccessControl(features)
	actionSets := NewActionSetService()
	_, err := New(
		setting.NewCfg(), routeOptions, features, routing.NewRouteRegister(), licensingtest.NewFakeLicensing(),
		ac, &actest.FakeService{}, db.InitTestDB(t), nil, nil, actionSets,
	)
	require.NoError(t, err)

	t.Run("action sets are registered on creation", func(t *testing.T) {
		resolved := actionSets.ResolveActionSet("alert.notifications.routes:view")
		assert.ElementsMatch(t, []string{"alert.notifications.routes.managed:read"}, resolved)

		resolved = actionSets.ResolveActionSet("alert.notifications.routes:edit")
		assert.ElementsMatch(t, []string{
			"alert.notifications.routes.managed:read",
			"alert.notifications.routes.managed:write",
			"alert.notifications.routes.managed:delete",
		}, resolved)

		resolved = actionSets.ResolveActionSet("alert.notifications.routes:admin")
		assert.ElementsMatch(t, []string{
			"alert.notifications.routes.managed:read",
			"alert.notifications.routes.managed:write",
			"alert.notifications.routes.managed:delete",
			"alert.notifications.routes.permissions:read",
			"alert.notifications.routes.permissions:write",
		}, resolved)
	})

	t.Run("mapPermission returns only the action set token for routes", func(t *testing.T) {
		svc := &Service{
			options:  routeOptions,
			features: features,
		}

		actions, err := svc.mapPermission("View")
		require.NoError(t, err)
		assert.Equal(t, []string{"alert.notifications.routes:view"}, actions)

		actions, err = svc.mapPermission("Edit")
		require.NoError(t, err)
		assert.Equal(t, []string{"alert.notifications.routes:edit"}, actions)

		actions, err = svc.mapPermission("Admin")
		require.NoError(t, err)
		assert.Equal(t, []string{"alert.notifications.routes:admin"}, actions)
	})

	t.Run("mapPermission returns empty slice for empty permission", func(t *testing.T) {
		svc := &Service{
			options:  routeOptions,
			features: features,
		}

		actions, err := svc.mapPermission("")
		require.NoError(t, err)
		assert.Empty(t, actions)
	})
}

func setupTestEnvironment(t *testing.T, ops Options) (*Service, user.Service, team.Service) {
	t.Helper()

	sql := db.InitTestDB(t)
	cfg := setting.NewCfg()
	tracer := tracing.InitializeTracerForTest()

	teamSvc, err := teamimpl.ProvideService(sql, cfg, tracer, nil)
	require.NoError(t, err)

	orgSvc, err := orgimpl.ProvideService(sql, cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	userSvc, err := userimpl.ProvideService(
		sql, orgSvc, cfg, teamSvc, nil, tracer,
		quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(), nil,
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
