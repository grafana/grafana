package ossaccesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

func setupTestEnv(t testing.TB) *OSSAccessControlService {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

	ac := &OSSAccessControlService{
		Cfg:           cfg,
		UsageStats:    &usagestats.UsageStatsMock{T: t},
		Log:           log.New("accesscontrol"),
		registrations: accesscontrol.RegistrationList{},
		scopeResolver: accesscontrol.NewScopeResolver(),
	}
	return ac
}

func removeRoleHelper(role string) {
	delete(accesscontrol.FixedRoles, role)

	// Compute new grants removing any appearance of the role in the list
	replaceGrants := map[string][]string{}

	for builtInRole, grants := range accesscontrol.FixedRoleGrants {
		newGrants := make([]string, len(grants))
		for _, r := range grants {
			if r != role {
				newGrants = append(newGrants, r)
			}
		}
		replaceGrants[builtInRole] = newGrants
	}

	// Replace grants
	for br, grants := range replaceGrants {
		accesscontrol.FixedRoleGrants[br] = grants
	}
}

// extractRawPermissionsHelper extracts action and scope fields only from a permission slice
func extractRawPermissionsHelper(perms []*accesscontrol.Permission) []*accesscontrol.Permission {
	res := make([]*accesscontrol.Permission, len(perms))
	for i, p := range perms {
		res[i] = &accesscontrol.Permission{Action: p.Action, Scope: p.Scope}
	}
	return res
}

type evaluatingPermissionsTestCase struct {
	desc       string
	user       userTestCase
	endpoints  []endpointTestCase
	evalResult bool
}

type userTestCase struct {
	name           string
	orgRole        models.RoleType
	isGrafanaAdmin bool
}

type endpointTestCase struct {
	evaluator accesscontrol.Evaluator
}

func TestEvaluatingPermissions(t *testing.T) {
	testCases := []evaluatingPermissionsTestCase{
		{
			desc: "should successfully evaluate access to the endpoint",
			user: userTestCase{
				name:           "testuser",
				orgRole:        models.ROLE_VIEWER,
				isGrafanaAdmin: true,
			},
			endpoints: []endpointTestCase{
				{evaluator: accesscontrol.EvalPermission(accesscontrol.ActionUsersDisable, accesscontrol.ScopeGlobalUsersAll)},
				{evaluator: accesscontrol.EvalPermission(accesscontrol.ActionUsersEnable, accesscontrol.ScopeGlobalUsersAll)},
			},
			evalResult: true,
		},
		{
			desc: "should restrict access to the unauthorized endpoints",
			user: userTestCase{
				name:           "testuser",
				orgRole:        models.ROLE_VIEWER,
				isGrafanaAdmin: false,
			},
			endpoints: []endpointTestCase{
				{evaluator: accesscontrol.EvalPermission(accesscontrol.ActionUsersCreate, accesscontrol.ScopeGlobalUsersAll)},
			},
			evalResult: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)

			user := &models.SignedInUser{
				UserId:         1,
				OrgId:          1,
				Name:           tc.user.name,
				OrgRole:        tc.user.orgRole,
				IsGrafanaAdmin: tc.user.isGrafanaAdmin,
			}

			for _, endpoint := range tc.endpoints {
				result, err := ac.Evaluate(context.Background(), user, endpoint.evaluator)
				require.NoError(t, err)
				assert.Equal(t, tc.evalResult, result)
			}
		})
	}
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
			if tt.enabled {
				cfg.FeatureToggles = map[string]bool{"accesscontrol": true}
			}

			s := ProvideService(cfg, &usagestats.UsageStatsMock{T: t})
			report, err := s.UsageStats.GetUsageReport(context.Background())
			assert.Nil(t, err)

			assert.Equal(t, tt.expectedValue, report.Metrics["stats.oss.accesscontrol.enabled.count"])
		})
	}
}

type assignmentTestCase struct {
	role         accesscontrol.RoleDTO
	builtInRoles []string
}

func TestOSSAccessControlService_RegisterFixedRole(t *testing.T) {
	tests := []struct {
		name string
		runs []assignmentTestCase
	}{
		{
			name: "Successfully register role no assignments",
			runs: []assignmentTestCase{
				{
					role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test:test",
					},
				},
			},
		},
		{
			name: "Successfully ignore overwriting existing role",
			runs: []assignmentTestCase{
				{
					role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test:test",
					},
				},
				{
					role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test:test",
					},
				},
			},
		},
		{
			name: "Successfully register and assign role",
			runs: []assignmentTestCase{
				{
					role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test:test",
					},
					builtInRoles: []string{"Viewer", "Editor", "Admin"},
				},
			},
		},
		{
			name: "Successfully ignore unchanged assignment",
			runs: []assignmentTestCase{
				{
					role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test:test",
					},
					builtInRoles: []string{"Viewer"},
				},
				{
					role: accesscontrol.RoleDTO{
						Version: 2,
						Name:    "fixed:test:test",
					},
					builtInRoles: []string{"Viewer"},
				},
			},
		},
		{
			name: "Successfully add a new assignment",
			runs: []assignmentTestCase{
				{
					role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test:test",
					},
					builtInRoles: []string{"Viewer"},
				},
				{
					role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test:test",
					},
					builtInRoles: []string{"Editor"},
				},
			},
		},
	}

	// Check all runs performed so far to get the number of assignments seeder
	// should have recorded
	getTotalAssignCount := func(curRunIdx int, runs []assignmentTestCase) int {
		builtIns := map[string]struct{}{}
		for i := 0; i < curRunIdx+1; i++ {
			for _, br := range runs[i].builtInRoles {
				builtIns[br] = struct{}{}
			}
		}
		return len(builtIns)
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ac := &OSSAccessControlService{
				Cfg:        setting.NewCfg(),
				UsageStats: &usagestats.UsageStatsMock{T: t},
				Log:        log.New("accesscontrol-test"),
			}

			for i, run := range tc.runs {
				// Remove any inserted role after the test case has been run
				t.Cleanup(func() { removeRoleHelper(run.role.Name) })

				ac.registerFixedRole(run.role, run.builtInRoles)

				// Check role has been registered
				storedRole, ok := accesscontrol.FixedRoles[run.role.Name]
				assert.True(t, ok, "role should have been registered")

				// Check registered role has not been altered
				assert.Equal(t, run.role, storedRole, "role should not have been altered")

				// Check assignments
				// Count number of times the role has been assigned
				assignCnt := 0
				for _, grants := range accesscontrol.FixedRoleGrants {
					for _, r := range grants {
						if r == run.role.Name {
							assignCnt++
						}
					}
				}
				assert.Equal(t, getTotalAssignCount(i, tc.runs), assignCnt,
					"assignments should only be added, never removed")

				for _, br := range run.builtInRoles {
					assigns, ok := accesscontrol.FixedRoleGrants[br]
					assert.True(t, ok,
						fmt.Sprintf("role %s should have been assigned to %s", run.role.Name, br))
					assert.Contains(t, assigns, run.role.Name,
						fmt.Sprintf("role %s should have been assigned to %s", run.role.Name, br))
				}
			}
		})
	}
}

func TestOSSAccessControlService_DeclareFixedRoles(t *testing.T) {
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
						Version: 1,
						Name:    "fixed:test:test",
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
						Version: 1,
						Name:    "custom:test:test",
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
						Version: 1,
						Name:    "fixed:test:test",
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
						Version: 1,
						Name:    "fixed:test:test",
					},
					Grants: []string{"Admin"},
				},
				{
					Role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test2:test2",
					},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ac := &OSSAccessControlService{
				Cfg:           setting.NewCfg(),
				UsageStats:    &usagestats.UsageStatsMock{T: t},
				Log:           log.New("accesscontrol-test"),
				registrations: accesscontrol.RegistrationList{},
			}
			ac.Cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

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

func TestOSSAccessControlService_RegisterFixedRoles(t *testing.T) {
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
						Version: 1,
						Name:    "fixed:test:test",
					},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
		{
			name: "should register and assign multiple roles",
			registrations: []accesscontrol.RoleRegistration{
				{
					Role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test:test",
					},
					Grants: []string{"Admin"},
				},
				{
					Role: accesscontrol.RoleDTO{
						Version: 1,
						Name:    "fixed:test2:test2",
					},
					Grants: []string{"Admin"},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		cfg := setting.NewCfg()
		cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

		t.Run(tt.name, func(t *testing.T) {
			// Remove any inserted role after the test case has been run
			t.Cleanup(func() {
				for _, registration := range tt.registrations {
					removeRoleHelper(registration.Role.Name)
				}
			})

			// Setup
			ac := &OSSAccessControlService{
				Cfg:           setting.NewCfg(),
				UsageStats:    &usagestats.UsageStatsMock{T: t},
				Log:           log.New("accesscontrol-test"),
				registrations: accesscontrol.RegistrationList{},
			}
			ac.Cfg.FeatureToggles = map[string]bool{"accesscontrol": true}
			ac.registrations.Append(tt.registrations...)

			// Test
			err := ac.RegisterFixedRoles()
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			// Check
			for _, registration := range tt.registrations {
				role, ok := accesscontrol.FixedRoles[registration.Role.Name]
				assert.True(t, ok,
					fmt.Sprintf("role %s should have been registered", registration.Role.Name))
				assert.NotNil(t, role,
					fmt.Sprintf("role %s should have been registered", registration.Role.Name))

				for _, br := range registration.Grants {
					rolesWithGrant, ok := accesscontrol.FixedRoleGrants[br]
					assert.True(t, ok,
						fmt.Sprintf("role %s should have been assigned to %s", registration.Role.Name, br))
					assert.Contains(t, rolesWithGrant, registration.Role.Name,
						fmt.Sprintf("role %s should have been assigned to %s", registration.Role.Name, br))
				}
			}
		})
	}
}

func TestOSSAccessControlService_GetUserPermissions(t *testing.T) {
	testUser := models.SignedInUser{
		UserId:  2,
		OrgId:   3,
		OrgName: "TestOrg",
		OrgRole: models.ROLE_VIEWER,
		Login:   "testUser",
		Name:    "Test User",
		Email:   "testuser@example.org",
	}
	registration := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     1,
			UID:         "fixed:test:test",
			Name:        "fixed:test:test",
			Description: "Test role",
			Permissions: []accesscontrol.Permission{},
		},
		Grants: []string{"Viewer"},
	}
	tests := []struct {
		name     string
		user     models.SignedInUser
		rawPerm  accesscontrol.Permission
		wantPerm accesscontrol.Permission
		wantErr  bool
	}{
		{
			name:     "Translate users:self",
			user:     testUser,
			rawPerm:  accesscontrol.Permission{Action: "users:read", Scope: "users:self"},
			wantPerm: accesscontrol.Permission{Action: "users:read", Scope: "users:id:2"},
			wantErr:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Remove any inserted role after the test case has been run
			t.Cleanup(func() {
				removeRoleHelper(registration.Role.Name)
			})

			// Setup
			ac := setupTestEnv(t)
			ac.Cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

			registration.Role.Permissions = []accesscontrol.Permission{tt.rawPerm}
			err := ac.DeclareFixedRoles(registration)
			require.NoError(t, err)

			err = ac.RegisterFixedRoles()
			require.NoError(t, err)

			// Test
			userPerms, err := ac.GetUserPermissions(context.TODO(), &tt.user)
			if tt.wantErr {
				assert.Error(t, err, "Expected an error with GetUserPermissions.")
				return
			}
			require.NoError(t, err, "Did not expect an error with GetUserPermissions.")

			rawUserPerms := extractRawPermissionsHelper(userPerms)

			assert.Contains(t, rawUserPerms, &tt.wantPerm, "Expected resolution of raw permission")
			assert.NotContains(t, rawUserPerms, &tt.rawPerm, "Expected raw permission to have been resolved")
		})
	}
}
