package acimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func setupTestEnv(t testing.TB) *Service {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.RBACEnabled = true

	ac := &Service{
		cfg:           cfg,
		log:           log.New("accesscontrol"),
		registrations: accesscontrol.RegistrationList{},
		store:         database.ProvideService(db.InitTestDB(t)),
		roles:         accesscontrol.BuildBasicRoleDefinitions(),
		features:      featuremgmt.WithFeatures(),
	}
	require.NoError(t, ac.RegisterFixedRoles(context.Background()))
	return ac
}

func TestUsageMetrics(t *testing.T) {
	tests := []struct {
		name          string
		enabled       bool
		expectedValue int
	}{
		{
			name:          "Expecting metric with value 0",
			enabled:       false,
			expectedValue: 0,
		},
		{
			name:          "Expecting metric with value 1",
			enabled:       true,
			expectedValue: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBACEnabled = tt.enabled

			s, errInitAc := ProvideService(
				cfg,
				db.InitTestDB(t),
				routing.NewRouteRegister(),
				localcache.ProvideService(),
				actest.FakeAccessControl{},
				featuremgmt.WithFeatures(),
			)
			require.NoError(t, errInitAc)
			assert.Equal(t, tt.expectedValue, s.GetUsageStats(context.Background())["stats.oss.accesscontrol.enabled.count"])
		})
	}
}

func TestService_DeclareFixedRoles(t *testing.T) {
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
			err:     accesscontrol.ErrInvalidBuiltinRole,
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

func TestService_DeclarePluginRoles(t *testing.T) {
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
			err:     accesscontrol.ErrInvalidBuiltinRole,
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
			ac.features = featuremgmt.WithFeatures(featuremgmt.FlagAccessControlOnCall)

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

func TestService_RegisterFixedRoles(t *testing.T) {
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
						assert.Contains(t, builtinRole.Permissions, expectedPermission)
					}
				}
			}
		})
	}
}

func TestService_SearchUsersPermissions(t *testing.T) {
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
				string(roletype.RoleAdmin): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				}},
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(roletype.RoleEditor)},
				2: {string(roletype.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
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
				1: {string(roletype.RoleEditor)},
				2: {string(roletype.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
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
				string(roletype.RoleAdmin): {Permissions: []accesscontrol.Permission{
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
				1: {string(roletype.RoleEditor)},
				2: {string(roletype.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
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
				1: {string(roletype.RoleEditor)},
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
			got, err := ac.SearchUsersPermissions(ctx, siu, 2, tt.searchOption)
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

func TestService_SearchUserPermissions(t *testing.T) {
	ctx := context.Background()
	tests := []struct {
		name         string
		searchOption accesscontrol.SearchOptions
		ramRoles     map[string]*accesscontrol.RoleDTO    // BasicRole => RBAC BasicRole
		storedPerms  map[int64][]accesscontrol.Permission // UserID => Permissions
		storedRoles  map[int64][]string                   // UserID => Roles
		want         []accesscontrol.Permission
		wantErr      bool
	}{
		{
			name: "ram only",
			searchOption: accesscontrol.SearchOptions{
				ActionPrefix: "teams",
				UserID:       2,
			},
			ramRoles: map[string]*accesscontrol.RoleDTO{
				string(roletype.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsCreate},
				}},
				string(roletype.RoleAdmin): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
				}},
				accesscontrol.RoleGrafanaAdmin: {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(roletype.RoleEditor)},
				2: {string(roletype.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
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
				1: {string(roletype.RoleEditor)},
				2: {string(roletype.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
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
				string(roletype.RoleAdmin): {Permissions: []accesscontrol.Permission{
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
				1: {string(roletype.RoleEditor)},
				2: {string(roletype.RoleAdmin), accesscontrol.RoleGrafanaAdmin},
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
				string(roletype.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionUsersCreate},
					{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionAnnotationsRead, Scope: "annotations:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(roletype.RoleEditor)},
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
				string(roletype.RoleEditor): {Permissions: []accesscontrol.Permission{
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
					{Action: accesscontrol.ActionUsersCreate},
					{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
					{Action: accesscontrol.ActionAnnotationsRead, Scope: "annotations:*"},
				}},
			},
			storedRoles: map[int64][]string{
				1: {string(roletype.RoleEditor)},
			},
			want: []accesscontrol.Permission{
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: "teams:*"},
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

func TestPermissionCacheKey(t *testing.T) {
	testcases := []struct {
		name         string
		signedInUser *user.SignedInUser
		expected     string
		expectedErr  error
	}{
		{
			name: "should return correct key for user",
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			expected:    "rbac-permissions-1-user-1",
			expectedErr: nil,
		},
		{
			name: "should return correct key for api key",
			signedInUser: &user.SignedInUser{
				OrgID:            1,
				ApiKeyID:         1,
				IsServiceAccount: false,
			},
			expected:    "rbac-permissions-1-apikey-1",
			expectedErr: nil,
		},
		{
			name: "should return correct key for service account",
			signedInUser: &user.SignedInUser{
				OrgID:            1,
				UserID:           1,
				IsServiceAccount: true,
			},
			expected:    "rbac-permissions-1-service-1",
			expectedErr: nil,
		},
		{
			name: "should return correct key for matching a service account with userId -1",
			signedInUser: &user.SignedInUser{
				OrgID:            1,
				UserID:           -1,
				IsServiceAccount: true,
			},
			expected:    "rbac-permissions-1-service--1",
			expectedErr: nil,
		},
		{
			name: "should return error if not matching any",
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: -1,
			},
			expected:    "",
			expectedErr: user.ErrNoUniqueID,
		},
	}
	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			str, err := permissionCacheKey(tc.signedInUser)
			require.Equal(t, tc.expectedErr, err)
			assert.Equal(t, tc.expected, str)
		})
	}
}

func TestService_SaveExternalServiceRole(t *testing.T) {
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
						OrgID:             2,
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
						Global:            true,
						ServiceAccountID:  2,
						ExternalServiceID: "App 1",
						Permissions:       []accesscontrol.Permission{{Action: "users:read", Scope: "users:id:1"}},
					},
					wantErr: false,
				},
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						Global:            true,
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
						OrgID:             2,
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
			ac.features = featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAuth)
			for _, r := range tt.runs {
				err := ac.SaveExternalServiceRole(ctx, r.cmd)
				if r.wantErr {
					require.Error(t, err)
					continue
				}
				require.NoError(t, err)

				// Check that the permissions and assignment are stored correctly
				perms, errGetPerms := ac.getUserPermissions(ctx, &user.SignedInUser{OrgID: r.cmd.OrgID, UserID: 2}, accesscontrol.Options{})
				require.NoError(t, errGetPerms)
				assert.ElementsMatch(t, r.cmd.Permissions, perms)
			}
		})
	}
}

func TestService_DeleteExternalServiceRole(t *testing.T) {
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
				Global:            true,
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
			ac.features = featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAuth)

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
				perms, errGetPerms := ac.getUserPermissions(ctx, &user.SignedInUser{OrgID: tt.initCmd.OrgID, UserID: 2}, accesscontrol.Options{})
				require.NoError(t, errGetPerms)
				assert.Empty(t, perms)
			}
		})
	}
}
