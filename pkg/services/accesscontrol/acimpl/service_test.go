package acimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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
		store:         database.ProvideService(sqlstore.InitTestDB(t)),
		roles:         accesscontrol.BuildBasicRoleDefinitions(),
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
				database.ProvideService(sqlstore.InitTestDB(t)),
				routing.NewRouteRegister(),
				localcache.ProvideService(),
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
					Role: accesscontrol.RoleDTO{
						Name: "fixed:test:test",
					},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
		{
			name: "should fail registration invalid role name",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role: accesscontrol.RoleDTO{
						Name: "custom:test:test",
					},
					Grants: []string{"Admin"},
				},
			},
			wantErr: true,
			err:     accesscontrol.ErrFixedRolePrefixMissing,
		},
		{
			name: "should fail registration invalid builtin role assignment",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role: accesscontrol.RoleDTO{
						Name: "fixed:test:test",
					},
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
					Role: accesscontrol.RoleDTO{
						Name: "fixed:test:test",
					},
					Grants: []string{"Admin"},
				},
				{
					Role: accesscontrol.RoleDTO{
						Name: "fixed:test2:test2",
					},
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
