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
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
							{Action: "plugins.app:access"},
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
		token         models.Licensing
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
