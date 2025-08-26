package acimpl

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupTestEnv(t testing.TB) *Service {
	t.Helper()
	cfg := setting.NewCfg()

	ac := &Service{
		cache:          localcache.ProvideService(),
		cfg:            cfg,
		features:       featuremgmt.WithFeatures(),
		log:            log.New("accesscontrol"),
		registrations:  accesscontrol.RegistrationList{},
		roles:          accesscontrol.BuildBasicRoleDefinitions(),
		store:          database.ProvideService(db.InitTestDB(t)),
		permRegistry:   permreg.ProvidePermissionRegistry(),
		actionResolver: resourcepermissions.NewActionSetService(),
	}
	require.NoError(t, ac.RegisterFixedRoles(context.Background()))
	return ac
}

func TestIntegrationUsageMetrics(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests := []struct {
		name          string
		expectedValue int
	}{
		{
			name:          "Expecting metric with value 1",
			expectedValue: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()

			s := ProvideOSSService(
				cfg,
				database.ProvideService(db.InitTestDB(t)),
				&resourcepermissions.FakeActionSetSvc{},
				localcache.ProvideService(),
				featuremgmt.WithFeatures(),
				tracing.InitializeTracerForTest(),
				nil,
				permreg.ProvidePermissionRegistry(),
				nil,
			)
			assert.Equal(t, tt.expectedValue, s.GetUsageStats(context.Background())["stats.oss.accesscontrol.enabled.count"])
		})
	}
}

func TestIntegrationService_DeclareFixedRoles(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests := []struct {
		name          string
		registrations []accesscontrol.RoleRegistration
		wantErr       bool
		err           error
	}{
		{
			name:    "should work with empty list",
			wantErr: false,
		},
		{
			name: "should add registration",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role:   accesscontrol.RoleDTO{Name: "fixed:test:test"},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
		{
			name: "should fail registration invalid role name",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role:   accesscontrol.RoleDTO{Name: "custom:test:test"},
					Grants: []string{"Admin"},
				},
			},
			wantErr: true,
			err:     accesscontrol.ErrFixedRolePrefixMissing,
		},
		{
			name: "should fail registration invalid basic role assignment",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role:   accesscontrol.RoleDTO{Name: "fixed:test:test"},
					Grants: []string{"WrongAdmin"},
				},
			},
			wantErr: true,
			err:     accesscontrol.ErrInvalidBuiltinRole.Build(accesscontrol.ErrInvalidBuiltinRoleData("WrongAdmin")),
		},
		{
			name: "should add multiple registrations at once",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role:   accesscontrol.RoleDTO{Name: "fixed:test:test"},
					Grants: []string{"Admin"},
				},
				{
					Role:   accesscontrol.RoleDTO{Name: "fixed:test2:test2"},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ac := setupTestEnv(t)

			// Reset the registations
			ac.registrations = accesscontrol.RegistrationList{}

			// Test
			err := ac.DeclareFixedRoles(tt.registrations...)
			if tt.wantErr {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.err)
				return
			}
			require.NoError(t, err)

			registrationCnt := 0
			ac.registrations.Range(func(registration accesscontrol.RoleRegistration) bool {
				registrationCnt++
				return true
			})
			assert.Equal(t, len(tt.registrations), registrationCnt,
				"expected service registration list to contain all test registrations")
		})
	}
}

func TestIntegrationService_DeclarePluginRoles(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests := []struct {
		name          string
		pluginID      string
		registrations []plugins.RoleRegistration
		wantErr       bool
		err           error
	}{
		{
			name:    "should work with empty list",
			wantErr: false,
		},
		{
			name:     "should add registration",
			pluginID: "test-app",
			registrations: []plugins.RoleRegistration{
				{
					Role:   plugins.Role{Name: "Tester"},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
		{
			name:     "should add registration with valid permissions",
			pluginID: "test-app",
			registrations: []plugins.RoleRegistration{
				{
					Role: plugins.Role{
						Name: "Tester",
						Permissions: []plugins.Permission{
							{Action: "plugins.app:access", Scope: "plugins:id:test-app"},
							{Action: "test-app:read"},
							{Action: "test-app.resource:read"},
						},
					},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
		{
			name:     "should fail registration invalid permission action",
			pluginID: "test-app",
			registrations: []plugins.RoleRegistration{
				{
					Role: plugins.Role{
						Name: "Tester",
						Permissions: []plugins.Permission{
							{Action: "invalid.test-app.resource:read"},
						},
					},
					Grants: []string{"Admin"},
				},
			},
			wantErr: true,
			err:     &accesscontrol.ErrorInvalidRole{},
		},
		{
			name:     "should fail registration invalid basic role assignment",
			pluginID: "test-app",
			registrations: []plugins.RoleRegistration{
				{
					Role:   plugins.Role{Name: "Tester"},
					Grants: []string{"WrongAdmin"},
				},
			},
			wantErr: true,
			err:     accesscontrol.ErrInvalidBuiltinRole.Build(accesscontrol.ErrInvalidBuiltinRoleData("WrongAdmin")),
		},
		{
			name:     "should add multiple registrations at once",
			pluginID: "test-app",
			registrations: []plugins.RoleRegistration{
				{
					Role:   plugins.Role{Name: "Tester"},
					Grants: []string{"Admin"},
				},
				{
					Role:   plugins.Role{Name: "Tester2"},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ac := setupTestEnv(t)

			// Reset the registations
			ac.registrations = accesscontrol.RegistrationList{}

			// Test
			err := ac.DeclarePluginRoles(context.Background(), tt.pluginID, tt.pluginID, tt.registrations)
			if tt.wantErr {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.err)
				return
			}
			require.NoError(t, err)

			registrationCnt := 0
			ac.registrations.Range(func(registration accesscontrol.RoleRegistration) bool {
				registrationCnt++
				return true
			})
			assert.Equal(t, len(tt.registrations), registrationCnt,
				"expected service registration list to contain all test registrations")
		})
	}
}

func TestIntegrationService_RegisterFixedRoles(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests := []struct {
		name          string
		token         licensing.Licensing
		registrations []accesscontrol.RoleRegistration
		wantErr       bool
	}{
		{
			name: "should work with empty list",
		},
		{
			name: "should register and assign role",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role: accesscontrol.RoleDTO{
						Name:        "fixed:test:test",
						Permissions: []accesscontrol.Permission{{Action: "test:test"}},
					},
					Grants: []string{"Editor"},
				},
			},
			wantErr: false,
		},
		{
			name: "should register and assign multiple roles",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role: accesscontrol.RoleDTO{
						Name:        "fixed:test:test",
						Permissions: []accesscontrol.Permission{{Action: "test:test"}},
					},
					Grants: []string{"Editor"},
				},
				{
					Role: accesscontrol.RoleDTO{
						Name: "fixed:test2:test2",
						Permissions: []accesscontrol.Permission{
							{Action: "test:test2"},
							{Action: "test:test3", Scope: "test:*"},
						},
					},
					Grants: []string{"Viewer"},
				},
			},
			wantErr: false,
		},
		{
			name: "should register and assign fixed and plugins roles",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role: accesscontrol.RoleDTO{
						Name:        accesscontrol.PluginRolePrefix + "test-app:tester",
						DisplayName: "Tester",
						Permissions: []accesscontrol.Permission{{Action: "test-app:test"}},
					},
					Grants: []string{"Editor"},
				},
				{
					Role: accesscontrol.RoleDTO{
						Name: "fixed:test2:test2",
						Permissions: []accesscontrol.Permission{
							{Action: "test:test2"},
							{Action: "test:test3", Scope: "test:*"},
						},
					},
					Grants: []string{"Viewer"},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ac := setupTestEnv(t)

			ac.registrations.Append(tt.registrations...)

			// Test
			err := ac.RegisterFixedRoles(context.Background())
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			// Check
			for _, registration := range tt.registrations {
				// Check builtin roles (parents included) have been granted with the permissions
				for br := range accesscontrol.BuiltInRolesWithParents(registration.Grants) {
					builtinRole, ok := ac.roles[br]
					assert.True(t, ok)
					for _, expectedPermission := range registration.Role.Permissions {
						expectedPermission.Kind, expectedPermission.Attribute, expectedPermission.Identifier = accesscontrol.SplitScope(expectedPermission.Scope)
						assert.Contains(t, builtinRole.Permissions, expectedPermission)
					}
				}
			}
		})
	}
}

func TestIntegrationService_SearchUsersPermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	searchOption := accesscontrol.SearchOptions{ActionPrefix: "teams"}
	ctx := context.Background()
	listAllPerms := map[string][]string{accesscontrol.ActionUsersPermissionsRead: {"users:*"}}
	listSomePerms := map[string][]string{accesscontrol.ActionUsersPermissionsRead: {"users:id:2"}}
	tests := []struct {
		name           string
		siuPermissions map[string][]string
		searchOption   accesscontrol.SearchOptions
		ramRoles       map[string]*accesscontrol.RoleDTO    // BasicRole => RBAC BasicRole
		storedPerms    map[int64][]accesscontrol.Permission // UserID => Permissions
		storedRoles    map[int64][]string                   // UserID => Roles
		want           map[int64][]accesscontrol.Permission
		wantErr        bool
	}{
		{
			name:           "ram only",
			siuPermissions: listAllPerms,
			searchOption:   searchOption,
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleAdmin): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				}},
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {string(identity.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
			},
			want: map[int64][]accesscontrol.Permission{
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"}},
			},
		},
		{
			name:           "stored only",
			siuPermissions: listAllPerms,
			searchOption:   searchOption,
			storedPerms: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}},
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {string(identity.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
			},
			want: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}},
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"}},
			},
		},
		{
			name:           "ram and stored",
			siuPermissions: listAllPerms,
			searchOption:   searchOption,
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleAdmin): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				}},
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedPerms: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}},
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:1"}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {string(identity.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
			},
			want: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}},
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"}},
			},
		},
		{
			name:           "ram only search on scope",
			siuPermissions: listAllPerms,
			searchOption:   accesscontrol.SearchOptions{Scope: "teams:id:2"},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleAdmin): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {string(identity.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
			},
			want: map[int64][]accesscontrol.Permission{
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"}},
			},
		},
		{
			name:           "view permission on subset of users only",
			siuPermissions: listSomePerms,
			searchOption:   searchOption,
			ramRoles: map[string]*accesscontrol.RoleDTO{
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedPerms: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}},
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:1"}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {accesscontrol.RoleGrafanaAdmin},
			},
			want: map[int64][]accesscontrol.Permission{
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"}},
			},
		},
		{
			name:           "check action filter on RAM permissions works correctly",
			siuPermissions: listAllPerms,
			searchOption:   searchOption,
			ramRoles: map[string]*accesscontrol.RoleDTO{
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionUsersCreate},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedRoles: map[int64][]string{1: {accesscontrol.RoleGrafanaAdmin}},
			want: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"}},
			},
		},
		{
			name:           "check empty action filter on RAM permissions works correctly",
			siuPermissions: listAllPerms,
			searchOption:   accesscontrol.SearchOptions{},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionUsersCreate},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionAnnotationsRead, Scope: "annotations:*"},
				}},
			},
			storedRoles: map[int64][]string{1: {accesscontrol.RoleGrafanaAdmin}},
			want: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionUsersCreate},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionAnnotationsRead, Scope: "annotations:*"},
				},
			},
		},
		{
			// This test is not exactly representative as normally the store would return
			// only the user's basic roles and the user's stored permissions
			name:           "check namespacedId filter works correctly",
			siuPermissions: listAllPerms,
			searchOption:   accesscontrol.SearchOptions{UserID: 1},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				}},
				string(identity.RoleAdmin): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:*"},
				}},
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedPerms: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}},
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:1"}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {string(identity.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
			},
			want: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}, {Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"}},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ac := setupTestEnv(t)

			ac.roles = tt.ramRoles
			ac.store = actest.FakeStore{
				ExpectedUsersPermissions: tt.storedPerms,
				ExpectedUsersRoles:       tt.storedRoles,
			}

			siu := &user.SignedInUser{OrgID: 2, Permissions: map[int64]map[string][]string{2: tt.siuPermissions}}
			got, err := ac.SearchUsersPermissions(ctx, siu, tt.searchOption)
			if tt.wantErr {
				require.NotNil(t, err)
				return
			}
			require.Nil(t, err)

			require.Len(t, got, len(tt.want), "expected more users permissions")
			for userID, wantPerm := range tt.want {
				gotPerm, ok := got[userID]
				require.True(t, ok, "expected permissions for user", userID)

				require.ElementsMatch(t, gotPerm, wantPerm)
			}
		})
	}
}

func TestIntegrationService_SearchUserPermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	tests := []struct {
		name           string
		searchOption   accesscontrol.SearchOptions
		withActionSets bool
		actionSets     map[string][]string
		ramRoles       map[string]*accesscontrol.RoleDTO    // BasicRole => RBAC BasicRole
		storedPerms    map[int64][]accesscontrol.Permission // UserID => Permissions
		storedRoles    map[int64][]string                   // UserID => Roles
		want           []accesscontrol.Permission
		wantErr        bool
	}{
		{
			name: "ram only",
			searchOption: accesscontrol.SearchOptions{
				ActionPrefix: "teams",
				UserID:       2,
			},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsCreate},
				}},
				string(identity.RoleAdmin): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				}},
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {string(identity.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
			},
			want: []accesscontrol.Permission{
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"}},
		},
		{
			name: "stored only",
			searchOption: accesscontrol.SearchOptions{
				ActionPrefix: "teams",
				UserID:       2,
			},
			storedPerms: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}},
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {string(identity.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
			},
			want: []accesscontrol.Permission{
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
			},
		},
		{
			name: "ram and stored",
			searchOption: accesscontrol.SearchOptions{
				ActionPrefix: "teams",
				UserID:       2,
			},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleAdmin): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				}},
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedPerms: map[int64][]accesscontrol.Permission{
				1: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}},
				2: {{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:1"}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
				2: {string(identity.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
			},
			want: []accesscontrol.Permission{
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
				{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
			},
		},
		{
			name: "check action prefix filter works correctly",
			searchOption: accesscontrol.SearchOptions{
				ActionPrefix: "teams",
				UserID:       1,
			},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionUsersCreate},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionAnnotationsRead, Scope: "annotations:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
			},
			want: []accesscontrol.Permission{
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
			},
		},
		{
			name: "check action filter works correctly",
			searchOption: accesscontrol.SearchOptions{
				Action: accesscontrol.ActionTeamsRead,
				UserID: 1,
			},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionUsersCreate},
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionAnnotationsRead, Scope: "annotations:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
			},
			want: []accesscontrol.Permission{
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
			},
		},
		{
			name: "check action sets are correctly included if an action is specified",
			searchOption: accesscontrol.SearchOptions{
				Action: "dashboards:read",
				UserID: 1,
			},
			withActionSets: true,
			actionSets: map[string][]string{
				"dashboards:view": {"dashboards:read"},
				"dashboards:edit": {"dashboards:read", "dashboards:write", "dashboards:read-advanced"},
			},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: "dashboards:read", Scope: "dashboards:uid:ram"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
			},
			storedPerms: map[int64][]accesscontrol.Permission{
				1: {
					{Action: "dashboards:read", Scope: "dashboards:uid:stored"},
					{Action: "dashboards:edit", Scope: "dashboards:uid:stored2"},
					{Action: "dashboards:view", Scope: "dashboards:uid:stored3"},
				},
			},
			want: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:ram"},
				{Action: "dashboards:read", Scope: "dashboards:uid:stored"},
				{Action: "dashboards:read", Scope: "dashboards:uid:stored2"},
				{Action: "dashboards:read", Scope: "dashboards:uid:stored3"},
			},
		},
		{
			name: "check action sets are correctly included if an action prefix is specified",
			searchOption: accesscontrol.SearchOptions{
				ActionPrefix: "dashboards",
				UserID:       1,
			},
			withActionSets: true,
			actionSets: map[string][]string{
				"dashboards:view": {"dashboards:read"},
				"folders:view":    {"dashboards:read", "folders:read"},
				"dashboards:edit": {"dashboards:read", "dashboards:write"},
			},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(identity.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: "dashboards:read", Scope: "dashboards:uid:ram"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(identity.RoleEditor)},
			},
			storedPerms: map[int64][]accesscontrol.Permission{
				1: {
					{Action: "dashboards:read", Scope: "dashboards:uid:stored"},
					{Action: "folders:view", Scope: "folders:uid:stored2"},
					{Action: "dashboards:edit", Scope: "dashboards:uid:stored3"},
				},
			},
			want: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:ram"},
				{Action: "dashboards:read", Scope: "dashboards:uid:stored"},
				{Action: "dashboards:read", Scope: "folders:uid:stored2"},
				{Action: "dashboards:read", Scope: "dashboards:uid:stored3"},
				{Action: "dashboards:write", Scope: "dashboards:uid:stored3"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ac := setupTestEnv(t)
			if tt.withActionSets {
				actionSetSvc := resourcepermissions.NewActionSetService()
				for set, actions := range tt.actionSets {
					actionSetName := resourcepermissions.GetActionSetName(strings.Split(set, ":")[0], strings.Split(set, ":")[1])
					actionSetSvc.StoreActionSet(actionSetName, actions)
				}
				ac.actionResolver = actionSetSvc
			}

			ac.roles = tt.ramRoles
			ac.store = actest.FakeStore{
				ExpectedUsersPermissions: tt.storedPerms,
				ExpectedUsersRoles:       tt.storedRoles,
			}

			got, err := ac.searchUserPermissions(ctx, 1, tt.searchOption)
			if tt.wantErr {
				require.NotNil(t, err)
				return
			}
			require.Nil(t, err)

			assert.ElementsMatch(t, got, tt.want)
		})
	}
}

func TestIntegrationService_SaveExternalServiceRole(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type run struct {
		cmd     accesscontrol.SaveExternalServiceRoleCommand
		wantErr bool
	}
	tests := []struct {
		name string
		runs []run
	}{
		{
			name: "can create a role",
			runs: []run{
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						AssignmentOrgID:   2,
						ServiceAccountID:  2,
						ExternalServiceID: "App 1",
						Permissions:       []accesscontrol.Permission{{Action: "users:read", Scope: "users:id:1"}},
					},
					wantErr: false,
				},
			},
		},
		{
			name: "can update a role",
			runs: []run{
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						AssignmentOrgID:   1,
						ServiceAccountID:  2,
						ExternalServiceID: "App 1",
						Permissions:       []accesscontrol.Permission{{Action: "users:read", Scope: "users:id:1"}},
					},
					wantErr: false,
				},
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						AssignmentOrgID:   1,
						ServiceAccountID:  2,
						ExternalServiceID: "App 1",
						Permissions: []accesscontrol.Permission{
							{Action: "users:write", Scope: "users:id:1"},
							{Action: "users:write", Scope: "users:id:2"},
						},
					},
					wantErr: false,
				},
			},
		},
		{
			name: "test command validity - no service account ID",
			runs: []run{
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						AssignmentOrgID:   2,
						ExternalServiceID: "App 1",
						Permissions:       []accesscontrol.Permission{{Action: "users:read", Scope: "users:id:1"}},
					},
					wantErr: true,
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			ac := setupTestEnv(t)
			ac.cfg.ManagedServiceAccountsEnabled = true
			ac.features = featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAccounts)
			for _, r := range tt.runs {
				err := ac.SaveExternalServiceRole(ctx, r.cmd)
				if r.wantErr {
					require.Error(t, err)
					continue
				}
				require.NoError(t, err)

				// Check that the permissions and assignment are stored correctly
				perms, errGetPerms := ac.getUserPermissions(ctx, &user.SignedInUser{OrgID: r.cmd.AssignmentOrgID, UserID: 2}, accesscontrol.Options{})
				require.NoError(t, errGetPerms)
				// shared with me is added by default for all users in pkg/services/accesscontrol/acimpl/service.go
				assert.Equal(t, append([]accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:sharedwithme"}}, r.cmd.Permissions...), perms)
			}
		})
	}
}

func TestIntegrationService_DeleteExternalServiceRole(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests := []struct {
		name              string
		initCmd           *accesscontrol.SaveExternalServiceRoleCommand
		externalServiceID string
		wantErr           bool
	}{
		{
			name:              "handles deleting role that doesn't exist",
			externalServiceID: "App 1",
			wantErr:           false,
		},
		{
			name: "handles deleting role that exists",
			initCmd: &accesscontrol.SaveExternalServiceRoleCommand{
				AssignmentOrgID:   1,
				ServiceAccountID:  2,
				ExternalServiceID: "App 1",
				Permissions:       []accesscontrol.Permission{{Action: "users:read", Scope: "users:id:1"}},
			},
			externalServiceID: "App 1",
			wantErr:           false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			ac := setupTestEnv(t)
			ac.cfg.ManagedServiceAccountsEnabled = true
			ac.features = featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAccounts)

			if tt.initCmd != nil {
				err := ac.SaveExternalServiceRole(ctx, *tt.initCmd)
				require.NoError(t, err)
			}

			err := ac.DeleteExternalServiceRole(ctx, tt.externalServiceID)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			if tt.initCmd != nil {
				// Check that the permissions and assignment are removed correctly
				perms, errGetPerms := ac.getUserPermissions(ctx, &user.SignedInUser{OrgID: tt.initCmd.AssignmentOrgID, UserID: 2}, accesscontrol.Options{})
				require.NoError(t, errGetPerms)
				// shared with me is added by default for all users in pkg/services/accesscontrol/acimpl/service.go
				assert.Equal(t, []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:sharedwithme"}}, perms)
			}
		})
	}
}

func TestIntegrationService_GetRoleByName(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	t.Parallel()

	ctx := context.Background()

	t.Run("when the role does not exists, it returns an error", func(t *testing.T) {
		t.Parallel()

		ac := setupTestEnv(t)
		ac.registrations = accesscontrol.RegistrationList{}

		role, err := ac.GetRoleByName(ctx, 0, "not-found-role")
		require.ErrorIs(t, err, accesscontrol.ErrRoleNotFound)
		require.Nil(t, role)
	})

	t.Run("when the role exists, it is returned", func(t *testing.T) {
		t.Parallel()

		roleName := "fixed:test:test"

		ac := setupTestEnv(t)
		ac.registrations = accesscontrol.RegistrationList{}
		ac.registrations.Append(accesscontrol.RoleRegistration{
			Role:   accesscontrol.RoleDTO{Name: roleName},
			Grants: []string{"Admin"},
		})

		role, err := ac.GetRoleByName(ctx, 0, roleName)
		require.NoError(t, err)
		require.NotNil(t, role)
		require.Equal(t, roleName, role.Name)
	})
}
