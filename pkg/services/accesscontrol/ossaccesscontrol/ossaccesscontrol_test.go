package ossaccesscontrol

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestEnv(t testing.TB) *OSSAccessControlService {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

	ac := OSSAccessControlService{
		Cfg:        cfg,
		UsageStats: &usageStatsMock{metricsFuncs: make([]usagestats.MetricsFunc, 0)},
		Log:        log.New("accesscontrol-test"),
	}

	err := ac.Init()
	require.NoError(t, err)
	return &ac
}

type usageStatsMock struct {
	t            *testing.T
	metricsFuncs []usagestats.MetricsFunc
}

func (usm *usageStatsMock) RegisterMetricsFunc(fn usagestats.MetricsFunc) {
	usm.metricsFuncs = append(usm.metricsFuncs, fn)
}

func (usm *usageStatsMock) GetUsageReport(_ context.Context) (usagestats.UsageReport, error) {
	all := make(map[string]interface{})
	for _, fn := range usm.metricsFuncs {
		fnMetrics, err := fn()
		require.NoError(usm.t, err)

		for name, value := range fnMetrics {
			all[name] = value
		}
	}
	return usagestats.UsageReport{Metrics: all}, nil
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
	permission string
	scope      []string
}

func TestEvaluatingPermissions(t *testing.T) {
	testCases := []evaluatingPermissionsTestCase{
		{
			desc: "should successfully evaluate access to the endpoint",
			user: userTestCase{
				name:           "testuser",
				orgRole:        "Grafana Admin",
				isGrafanaAdmin: false,
			},
			endpoints: []endpointTestCase{
				{permission: accesscontrol.ActionUsersDisable, scope: []string{accesscontrol.ScopeGlobalUsersAll}},
				{permission: accesscontrol.ActionUsersEnable, scope: []string{accesscontrol.ScopeGlobalUsersAll}},
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
				{permission: accesscontrol.ActionUsersCreate, scope: []string{accesscontrol.ScopeGlobalUsersAll}},
			},
			evalResult: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			user := &models.SignedInUser{
				UserId:         1,
				OrgId:          1,
				Name:           tc.user.name,
				OrgRole:        tc.user.orgRole,
				IsGrafanaAdmin: tc.user.isGrafanaAdmin,
			}

			for _, endpoint := range tc.endpoints {
				result, err := ac.Evaluate(context.Background(), user, endpoint.permission, endpoint.scope...)
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

			s := &OSSAccessControlService{
				Cfg:        cfg,
				UsageStats: &usageStatsMock{t: t, metricsFuncs: make([]usagestats.MetricsFunc, 0)},
				Log:        log.New("accesscontrol-test"),
			}

			err := s.Init()
			assert.Nil(t, err)

			report, err := s.UsageStats.GetUsageReport(context.Background())
			assert.Nil(t, err)

			assert.Equal(t, tt.expectedValue, report.Metrics["stats.oss.accesscontrol.enabled.count"])
		})
	}
}

type assignmentTestCase struct {
	role         accesscontrol.RoleDTO
	builtInRoles []string
	wantErr      error
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
			name: "Fail to override existing role",
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
					wantErr: accesscontrol.ErrVersionLE,
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
			name: "Fail to assign role",
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
					wantErr:      accesscontrol.ErrBuiltinRoleAlreadyAdded,
				},
			},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ac := &OSSAccessControlService{
				Cfg:        setting.NewCfg(),
				UsageStats: &usageStatsMock{t: t, metricsFuncs: make([]usagestats.MetricsFunc, 0)},
				Log:        log.New("accesscontrol-test"),
			}

			for _, run := range tc.runs {
				err := ac.RegisterFixedRole(context.Background(), run.role, run.builtInRoles...)
				if run.wantErr != nil {
					assert.ErrorIs(t, err, run.wantErr)
					return
				}
				require.NoError(t, err)

				//Check role has been registered
				accesscontrol.FixedRolesMutex.RLock()
				storedRole, ok := accesscontrol.FixedRoles[run.role.Name]
				assert.True(t, ok)
				accesscontrol.FixedRolesMutex.RUnlock()

				//Check registered role has not been altered
				assert.Equal(t, run.role, storedRole)

				//Check assignments
				accesscontrol.FixedRoleGrantsMutex.RLock()
				for _, br := range run.builtInRoles {
					assigns, ok := accesscontrol.FixedRoleGrants[br]
					assert.True(t, ok)

					assert.Contains(t, assigns, run.role.Name)
				}
				accesscontrol.FixedRoleGrantsMutex.RUnlock()
			}
		})
	}
}
