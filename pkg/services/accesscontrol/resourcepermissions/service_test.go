package resourcepermissions

import (
	"context"
	"errors"
	"strconv"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/routing"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var openfeatureTestMutex sync.Mutex

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
					actionSetName := tt.options.GetActionSetName(permission)
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
		{
			desc:     "should support routes",
			pluginID: "test-app",
			coreActionSets: []ActionSet{
				{
					Action:  accesscontrol.AlertingRoutesKind + ":view",
					Actions: []string{accesscontrol.ActionAlertingManagedRoutesRead},
				},
				{
					Action: accesscontrol.AlertingRoutesKind + ":edit",
					Actions: []string{
						accesscontrol.ActionAlertingManagedRoutesRead,
						accesscontrol.ActionAlertingManagedRoutesWrite,
						accesscontrol.ActionAlertingManagedRoutesDelete,
					},
				},
			},
			expectedActionSets: []ActionSet{
				{
					Action:  accesscontrol.AlertingRoutesKind + ":view",
					Actions: []string{accesscontrol.ActionAlertingManagedRoutesRead},
				},
				{
					Action: accesscontrol.AlertingRoutesKind + ":edit",
					Actions: []string{
						accesscontrol.ActionAlertingManagedRoutesRead,
						accesscontrol.ActionAlertingManagedRoutesWrite,
						accesscontrol.ActionAlertingManagedRoutesDelete,
					},
				},
			},
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

func TestService_K8sActionFormat(t *testing.T) {
	tests := []struct {
		name                  string
		opts                  Options
		expectErr             bool
		expectedAction        string
		expectedScope         string
		expectedRoleName      string
		expectedActionSetName string
	}{
		{
			name: "legacy format",
			opts: Options{
				Resource:        "dashboards",
				APIGroup:        "",
				K8sActionFormat: false,
			},
			expectErr:             false,
			expectedAction:        "dashboards.permissions:read",
			expectedScope:         "dashboards:uid:abc123",
			expectedRoleName:      "fixed:dashboards.permissions:reader",
			expectedActionSetName: "dashboards:view",
		},
		{
			name: "k8s format",
			opts: Options{
				Resource:        "dashboards",
				APIGroup:        "dashboard.grafana.app",
				K8sActionFormat: true,
			},
			expectErr:             false,
			expectedAction:        "dashboard.grafana.app/dashboards:get_permissions",
			expectedScope:         "dashboard.grafana.app/dashboards:uid:abc123",
			expectedRoleName:      "fixed:dashboard.grafana.app:dashboards.permissions:reader",
			expectedActionSetName: "dashboard.grafana.app/dashboards:view",
		},
		{
			name: "k8s format without api group should fail",
			opts: Options{
				Resource:        "dashboards",
				APIGroup:        "",
				K8sActionFormat: true,
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql := db.InitTestDB(t)
			cfg := setting.NewCfg()
			license := licensingtest.NewFakeLicensing()
			license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()
			acService := &actest.FakeService{}
			features := featuremgmt.WithFeatures()
			ac := acimpl.ProvideAccessControl(features)

			service, err := New(
				cfg, tt.opts, features, routing.NewRouteRegister(), license,
				ac, acService, sql, nil, nil, NewActionSetService(),
			)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)

			// Test Options.GetAction
			action := service.options.GetAction("read")
			assert.Equal(t, tt.expectedAction, action)

			// Test Options.GetScope
			scope := service.options.GetScope("uid", "abc123")
			assert.Equal(t, tt.expectedScope, scope)

			// Test Options.GetRoleName
			roleName := service.options.GetRoleName("reader")
			assert.Equal(t, tt.expectedRoleName, roleName)

			// Test Options.GetActionSetName
			actionSetName := service.options.GetActionSetName("View")
			assert.Equal(t, tt.expectedActionSetName, actionSetName)
		})
	}
}

// enableRedirectFlags installs a global OpenFeature provider where both K8s
// resource-permission redirect flags resolve to true, restoring the noop provider
// on cleanup. Mirrors how the flags are read in production (via OpenFeature).
func enableRedirectFlags(t *testing.T) {
	t.Helper()
	openfeatureTestMutex.Lock()
	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesAuthZResourcePermissionsRedirect: setting.NewInMemoryFlag(featuremgmt.FlagKubernetesAuthZResourcePermissionsRedirect, true),
		featuremgmt.FlagKubernetesAuthzResourcePermissionApis:      setting.NewInMemoryFlag(featuremgmt.FlagKubernetesAuthzResourcePermissionApis, true),
	})
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}

func TestRequiresAPIGroup(t *testing.T) {
	tests := []struct {
		name            string
		resource        string
		k8sActionFormat bool
		redirectFlags   bool
		want            bool
	}{
		{name: "nothing enabled", resource: "dashboards", want: false},
		{name: "k8sActionFormat always requires it", resource: "dashboards", k8sActionFormat: true, want: true},
		{name: "k8sActionFormat requires it even for exempt resource", resource: "teams", k8sActionFormat: true, want: true},
		{name: "redirect requires it for a regular resource", resource: "dashboards", redirectFlags: true, want: true},
		{name: "redirect requires it for receivers", resource: "receivers", redirectFlags: true, want: true},
		{name: "redirect exempts teams", resource: "teams", redirectFlags: true, want: false},
		{name: "redirect exempts datasources", resource: "datasources", redirectFlags: true, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.redirectFlags {
				enableRedirectFlags(t)
			}
			got := requiresAPIGroup(context.Background(), tt.resource, tt.k8sActionFormat)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestService_APIGroupRequiredWhenRedirectEnabled(t *testing.T) {
	tests := []struct {
		name          string
		resource      string
		apiGroup      string
		redirectFlags bool
		expectErr     bool
	}{
		{
			name:          "non-teams resource without APIGroup and redirect enabled fails",
			resource:      "dashboards",
			apiGroup:      "",
			redirectFlags: true,
			expectErr:     true,
		},
		{
			name:          "non-teams resource with APIGroup and redirect enabled succeeds",
			resource:      "dashboards",
			apiGroup:      "dashboard.grafana.app",
			redirectFlags: true,
			expectErr:     false,
		},
		{
			name:          "teams resource without APIGroup is exempt even when redirect enabled",
			resource:      "teams",
			apiGroup:      "",
			redirectFlags: true,
			expectErr:     false,
		},
		{
			name:          "datasources resource without APIGroup is exempt even when redirect enabled",
			resource:      "datasources",
			apiGroup:      "",
			redirectFlags: true,
			expectErr:     false,
		},
		{
			name:          "non-teams resource without APIGroup is fine when redirect disabled",
			resource:      "dashboards",
			apiGroup:      "",
			redirectFlags: false,
			expectErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.redirectFlags {
				enableRedirectFlags(t)
			}

			sql := db.InitTestDB(t)
			cfg := setting.NewCfg()
			license := licensingtest.NewFakeLicensing()
			license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()
			features := featuremgmt.WithFeatures()
			ac := acimpl.ProvideAccessControl(features)

			_, err := New(
				cfg, Options{Resource: tt.resource, APIGroup: tt.apiGroup}, features,
				routing.NewRouteRegister(), license, ac, &actest.FakeService{}, sql, nil, nil, NewActionSetService(),
			)

			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestGetActionSetName(t *testing.T) {
	tests := []struct {
		name       string
		k8sFormat  bool
		apiGroup   string
		resource   string
		permission string
		expected   string
	}{
		{
			name:       "legacy format",
			k8sFormat:  false,
			apiGroup:   "",
			resource:   "dashboards",
			permission: "View",
			expected:   "dashboards:view",
		},
		{
			name:       "k8s format",
			k8sFormat:  true,
			apiGroup:   "dashboard.grafana.app",
			resource:   "dashboards",
			permission: "View",
			expected:   "dashboard.grafana.app/dashboards:view",
		},
		{
			name:       "legacy format lowercase",
			k8sFormat:  false,
			apiGroup:   "",
			resource:   "Dashboards",
			permission: "View",
			expected:   "dashboards:view",
		},
		{
			name:       "k8s format lowercase",
			k8sFormat:  true,
			apiGroup:   "Dashboard.Grafana.App",
			resource:   "Dashboards",
			permission: "View",
			expected:   "dashboard.grafana.app/dashboards:view",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts := Options{
				Resource:        tt.resource,
				APIGroup:        tt.apiGroup,
				K8sActionFormat: tt.k8sFormat,
			}
			result := opts.GetActionSetName(tt.permission)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMapPermission_ServiceAccount(t *testing.T) {
	saOpts := Options{
		Resource: serviceaccounts.ScopeServiceAccountRoot,
		PermissionsToActions: map[string][]string{
			"Edit":  {serviceaccounts.ActionRead, serviceaccounts.ActionWrite},
			"Admin": {serviceaccounts.ActionRead, serviceaccounts.ActionWrite, serviceaccounts.ActionDelete},
		},
	}

	t.Run("flag off: emits action set token AND granular actions", func(t *testing.T) {
		svc := &Service{options: saOpts}
		actions, err := svc.mapPermission("Edit")
		require.NoError(t, err)
		assert.Contains(t, actions, saOpts.GetActionSetName("Edit"), "should include action set token")
		assert.Contains(t, actions, serviceaccounts.ActionRead, "should include granular read action")
		assert.Contains(t, actions, serviceaccounts.ActionWrite, "should include granular write action")
	})

	t.Run("flag on: emits only action set token", func(t *testing.T) {
		openfeatureTestMutex.Lock()
		defer func() {
			_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
			openfeatureTestMutex.Unlock()
		}()

		provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagOnlyStoreServiceAccountActionSets: setting.NewInMemoryFlag(featuremgmt.FlagOnlyStoreServiceAccountActionSets, true),
		})
		require.NoError(t, err)
		require.NoError(t, openfeature.SetProviderAndWait(provider))

		svc := &Service{options: saOpts}
		actions, err := svc.mapPermission("Edit")
		require.NoError(t, err)
		require.Len(t, actions, 1)
		assert.Equal(t, saOpts.GetActionSetName("Edit"), actions[0])
	})

	t.Run("invalid level returns ErrInvalidPermission", func(t *testing.T) {
		svc := &Service{options: saOpts}
		_, err := svc.mapPermission("View")
		require.Error(t, err)
		require.ErrorIs(t, err, ErrInvalidPermission)
	})
}

func TestIsActionSetEnabledResource_ServiceAccount(t *testing.T) {
	t.Run("serviceaccounts actions are enabled", func(t *testing.T) {
		assert.True(t, isActionSetEnabledResource(serviceaccounts.ScopeServiceAccountRoot+":edit"))
		assert.True(t, isActionSetEnabledResource(serviceaccounts.ScopeServiceAccountRoot+":admin"))
	})
}

func setupTestEnvironment(t *testing.T, ops Options) (*Service, user.Service, team.Service) {
	t.Helper()
	service, userSvc, teamSvc, _ := setupTestEnvironmentWithCfg(t, ops, featuremgmt.WithFeatures())
	return service, userSvc, teamSvc
}

// setupTestEnvironmentWithCfg is like setupTestEnvironment but lets the caller pass feature
// toggles and returns the *setting.Cfg so tests can tweak it (e.g. the dual-writer mode).
func setupTestEnvironmentWithCfg(t *testing.T, ops Options, features featuremgmt.FeatureToggles) (*Service, user.Service, team.Service, *setting.Cfg) {
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
	ac := acimpl.ProvideAccessControl(features)
	service, err := New(
		cfg, ops, features, routing.NewRouteRegister(), license,
		ac, acService, sql, teamSvc, userSvc, NewActionSetService(),
	)
	require.NoError(t, err)

	return service, userSvc, teamSvc, cfg
}

func TestMapPermission_Datasource(t *testing.T) {
	dsOpts := Options{
		Resource: datasources.ScopeRoot,
		PermissionsToActions: map[string][]string{
			"Query": {datasources.ActionRead, datasources.ActionQuery},
			"Edit":  {datasources.ActionRead, datasources.ActionQuery, datasources.ActionWrite, datasources.ActionDelete},
			"Admin": {datasources.ActionRead, datasources.ActionQuery, datasources.ActionWrite, datasources.ActionDelete, datasources.ActionPermissionsRead, datasources.ActionPermissionsWrite},
		},
	}

	t.Run("flag off: Edit emits action set token AND granular actions", func(t *testing.T) {
		svc := &Service{options: dsOpts}
		actions, err := svc.mapPermission("Edit")
		require.NoError(t, err)
		assert.Contains(t, actions, dsOpts.GetActionSetName("Edit")) // datasources:edit
		assert.Contains(t, actions, datasources.ActionWrite)
		assert.Contains(t, actions, datasources.ActionDelete)
	})

	t.Run("flag off: Query token collides with the granular query action", func(t *testing.T) {
		svc := &Service{options: dsOpts}
		actions, err := svc.mapPermission("Query")
		require.NoError(t, err)
		// GetActionSetName("Query") == datasources:query == datasources.ActionQuery
		assert.Equal(t, dsOpts.GetActionSetName("Query"), datasources.ActionQuery)
		assert.Contains(t, actions, datasources.ActionRead)
		assert.Contains(t, actions, datasources.ActionQuery)
	})

	t.Run("flag on: emits only action set token", func(t *testing.T) {
		openfeatureTestMutex.Lock()
		defer func() {
			_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
			openfeatureTestMutex.Unlock()
		}()

		provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagIamOnlyStoreDatasourceActionSets: setting.NewInMemoryFlag(featuremgmt.FlagIamOnlyStoreDatasourceActionSets, true),
		})
		require.NoError(t, err)
		require.NoError(t, openfeature.SetProviderAndWait(provider))

		svc := &Service{options: dsOpts}
		actions, err := svc.mapPermission("Edit")
		require.NoError(t, err)
		require.Len(t, actions, 1)
		assert.Equal(t, dsOpts.GetActionSetName("Edit"), actions[0])
	})
}

func TestIsActionSetEnabledResource_Datasource(t *testing.T) {
	assert.True(t, isActionSetEnabledResource(datasources.ScopeRoot+":query"))
	assert.True(t, isActionSetEnabledResource(datasources.ScopeRoot+":edit"))
	assert.True(t, isActionSetEnabledResource(datasources.ScopeRoot+":admin"))
}

// TestIntegrationService_SetUserPermissionForTeams_Redirect exercises the teams
// membership redirect on the service methods directly (not the HTTP handlers) —
// the path a direct in-process caller takes. When kubernetesTeamsRedirect is on,
// membership must be written to Team.Spec.Members via the K8s API; in
// unified-authoritative modes the legacy team_member table has no row, so a K8s
// failure must surface instead of silently falling back, whereas dual-write modes
// fall back to legacy.
func TestIntegrationService_SetUserPermissionForTeams_Redirect(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name            string
		mode            grafanarest.DualWriterMode
		expectErr       bool
		expectHookCalls bool // legacy fallback runs the OnSetUser hook; the k8s path does not
	}{
		{name: "Mode3 falls back to legacy", mode: grafanarest.Mode3, expectErr: false, expectHookCalls: true},
		{name: "Mode5 does not fall back", mode: grafanarest.Mode5, expectErr: true, expectHookCalls: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// The teams redirect is gated on the kubernetesTeamsRedirect toggle.
			setOpenFeatureFlag(t, featuremgmt.FlagKubernetesTeamsRedirect, true)

			service, usrSvc, teamSvc, cfg := setupTestEnvironmentWithCfg(t, testOptionsForTeams, featuremgmt.WithFeatures())
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				iamv0.TeamResourceInfo.GroupResource().String(): {DualWriterMode: tt.mode},
			}

			var hookCalled bool
			service.options.OnSetUser = func(_ *db.Session, _ int64, _ accesscontrol.User, _, _ string) error {
				hookCalled = true
				return nil
			}

			createdUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)
			createdTeam, err := teamSvc.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "test", Email: "test@test.com", OrgID: 1})
			require.NoError(t, err)

			// The redirect builds its K8s client from the ReqContext the contexthandler
			// middleware stores on ctx (as an in-process request carries). No rest config
			// provider is wired in the test, so the K8s write fails with
			// ErrRestConfigNotAvailable — which is exactly what distinguishes the two modes.
			ctx := ctxkey.Set(context.Background(), makeReqCtx())

			_, err = service.SetUserPermission(ctx, 1, accesscontrol.User{ID: createdUser.ID}, strconv.FormatInt(createdTeam.ID, 10), "Member")
			if tt.expectErr {
				require.ErrorIs(t, err, ErrRestConfigNotAvailable)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.expectHookCalls, hookCalled)
		})
	}
}

// TestIntegrationService_SetPermissionsForTeams_Redirect is the batch counterpart
// of TestIntegrationService_SetUserPermissionForTeams_Redirect — a bulk membership
// reconcile goes through SetPermissions.
func TestIntegrationService_SetPermissionsForTeams_Redirect(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name            string
		mode            grafanarest.DualWriterMode
		expectErr       bool
		expectHookCalls bool
	}{
		{name: "Mode3 falls back to legacy", mode: grafanarest.Mode3, expectErr: false, expectHookCalls: true},
		{name: "Mode5 does not fall back", mode: grafanarest.Mode5, expectErr: true, expectHookCalls: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setOpenFeatureFlag(t, featuremgmt.FlagKubernetesTeamsRedirect, true)

			service, usrSvc, teamSvc, cfg := setupTestEnvironmentWithCfg(t, testOptionsForTeams, featuremgmt.WithFeatures())
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				iamv0.TeamResourceInfo.GroupResource().String(): {DualWriterMode: tt.mode},
			}

			var hookCalled bool
			service.options.OnSetUser = func(_ *db.Session, _ int64, _ accesscontrol.User, _, _ string) error {
				hookCalled = true
				return nil
			}

			createdUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)
			createdTeam, err := teamSvc.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "test", Email: "test@test.com", OrgID: 1})
			require.NoError(t, err)

			ctx := ctxkey.Set(context.Background(), makeReqCtx())

			_, err = service.SetPermissions(ctx, 1, strconv.FormatInt(createdTeam.ID, 10), accesscontrol.SetResourcePermissionCommand{
				UserID:     createdUser.ID,
				Permission: "Member",
			})
			if tt.expectErr {
				require.ErrorIs(t, err, ErrRestConfigNotAvailable)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.expectHookCalls, hookCalled)
		})
	}
}

// TestIntegrationService_SetUserPermissionForTeams_RedirectWrites covers the
// outcomes of the K8s membership write itself (stubbed): in unified-authoritative
// modes the K8s result is final and the legacy store is never touched, while in
// dual-write modes the legacy write still runs — including the case where the
// redirect already removed the member so the legacy removal finds nothing.
func TestIntegrationService_SetUserPermissionForTeams_RedirectWrites(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	errK8sUnavailable := errors.New("k8s api unavailable")

	tests := []struct {
		name           string
		mode           grafanarest.DualWriterMode
		permission     string
		k8sRemoved     bool
		k8sErr         error
		hookErr        error
		expectErr      error
		expectHookCall bool
	}{
		{
			name:       "Mode5 writes to k8s only",
			mode:       grafanarest.Mode5,
			permission: "Member",
		},
		{
			name:       "Mode5 surfaces k8s errors",
			mode:       grafanarest.Mode5,
			permission: "Member",
			k8sErr:     errK8sUnavailable,
			expectErr:  errK8sUnavailable,
		},
		{
			name:       "externally-synced members are never mutated",
			mode:       grafanarest.Mode3,
			permission: "Member",
			k8sErr:     ErrExternalTeamMember.Errorf("user %q is externally-synced", "test"),
			expectErr:  ErrExternalTeamMember,
		},
		{
			name:           "Mode3 dual-writes to legacy after k8s",
			mode:           grafanarest.Mode3,
			permission:     "Member",
			expectHookCall: true,
		},
		{
			name:           "Mode3 tolerates a member already removed by the redirect",
			mode:           grafanarest.Mode3,
			permission:     "",
			k8sRemoved:     true,
			hookErr:        team.ErrTeamMemberNotFound,
			expectHookCall: true,
		},
		{
			name:           "Mode3 surfaces not-found when the redirect removed nothing",
			mode:           grafanarest.Mode3,
			permission:     "",
			hookErr:        team.ErrTeamMemberNotFound,
			expectErr:      team.ErrTeamMemberNotFound,
			expectHookCall: true,
		},
	}

	origSetTeamMembership := setTeamMembership
	t.Cleanup(func() { setTeamMembership = origSetTeamMembership })

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setOpenFeatureFlag(t, featuremgmt.FlagKubernetesTeamsRedirect, true)

			service, usrSvc, teamSvc, cfg := setupTestEnvironmentWithCfg(t, testOptionsForTeams, featuremgmt.WithFeatures())
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				iamv0.TeamResourceInfo.GroupResource().String(): {DualWriterMode: tt.mode},
			}

			var hookCalled bool
			service.options.OnSetUser = func(_ *db.Session, _ int64, _ accesscontrol.User, _, _ string) error {
				hookCalled = true
				return tt.hookErr
			}

			var k8sCalls int
			setTeamMembership = func(_ *Service, _ context.Context, _ int64, _ string, _ int64, _ string) (bool, error) {
				k8sCalls++
				return tt.k8sRemoved, tt.k8sErr
			}

			createdUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)
			createdTeam, err := teamSvc.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "test", Email: "test@test.com", OrgID: 1})
			require.NoError(t, err)

			_, err = service.SetUserPermission(context.Background(), 1, accesscontrol.User{ID: createdUser.ID}, strconv.FormatInt(createdTeam.ID, 10), tt.permission)
			if tt.expectErr != nil {
				require.ErrorIs(t, err, tt.expectErr)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, 1, k8sCalls)
			assert.Equal(t, tt.expectHookCall, hookCalled)
		})
	}
}

// TestIntegrationService_SetPermissionsForTeams_RedirectWrites is the batch
// counterpart of TestIntegrationService_SetUserPermissionForTeams_RedirectWrites:
// every user command is reconciled through the K8s write individually.
func TestIntegrationService_SetPermissionsForTeams_RedirectWrites(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	errK8sUnavailable := errors.New("k8s api unavailable")

	tests := []struct {
		name           string
		mode           grafanarest.DualWriterMode
		permission     string
		k8sRemoved     bool
		k8sErr         error
		hookErr        error
		expectErr      error
		expectHookCall bool
	}{
		{
			name:       "Mode5 reconciles each user command via k8s only",
			mode:       grafanarest.Mode5,
			permission: "Member",
		},
		{
			name:       "externally-synced members abort the batch",
			mode:       grafanarest.Mode3,
			permission: "Member",
			k8sErr:     ErrExternalTeamMember.Errorf("user %q is externally-synced", "test"),
			expectErr:  ErrExternalTeamMember,
		},
		{
			name:           "Mode3 falls back to legacy when k8s fails",
			mode:           grafanarest.Mode3,
			permission:     "Member",
			k8sErr:         errK8sUnavailable,
			expectHookCall: true,
		},
		{
			name:           "Mode3 tolerates members already removed by the redirect",
			mode:           grafanarest.Mode3,
			permission:     "",
			k8sRemoved:     true,
			hookErr:        team.ErrTeamMemberNotFound,
			expectHookCall: true,
		},
	}

	origSetTeamMembership := setTeamMembership
	t.Cleanup(func() { setTeamMembership = origSetTeamMembership })

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setOpenFeatureFlag(t, featuremgmt.FlagKubernetesTeamsRedirect, true)

			service, usrSvc, teamSvc, cfg := setupTestEnvironmentWithCfg(t, testOptionsForTeams, featuremgmt.WithFeatures())
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				iamv0.TeamResourceInfo.GroupResource().String(): {DualWriterMode: tt.mode},
			}

			var hookCalled bool
			service.options.OnSetUser = func(_ *db.Session, _ int64, _ accesscontrol.User, _, _ string) error {
				hookCalled = true
				return tt.hookErr
			}

			var k8sCalls int
			setTeamMembership = func(_ *Service, _ context.Context, _ int64, _ string, _ int64, _ string) (bool, error) {
				k8sCalls++
				return tt.k8sRemoved, tt.k8sErr
			}

			firstUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test1", OrgID: 1})
			require.NoError(t, err)
			secondUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test2", OrgID: 1})
			require.NoError(t, err)
			createdTeam, err := teamSvc.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "test", Email: "test@test.com", OrgID: 1})
			require.NoError(t, err)

			_, err = service.SetPermissions(context.Background(), 1, strconv.FormatInt(createdTeam.ID, 10),
				accesscontrol.SetResourcePermissionCommand{UserID: firstUser.ID, Permission: tt.permission},
				accesscontrol.SetResourcePermissionCommand{UserID: secondUser.ID, Permission: tt.permission},
			)
			if tt.expectErr != nil {
				require.ErrorIs(t, err, tt.expectErr)
				// external members abort on the first command
				assert.Equal(t, 1, k8sCalls)
			} else {
				require.NoError(t, err)
				assert.Equal(t, 2, k8sCalls)
			}
			assert.Equal(t, tt.expectHookCall, hookCalled)
		})
	}
}
