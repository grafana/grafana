package quotaimpl

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardStore "github.com/grafana/grafana/pkg/services/dashboards/database"
	dsservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngalerttests "github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	storesrv "github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
)

func TestQuotaService(t *testing.T) {
	quotaStore := &quotatest.FakeQuotaStore{}
	quotaService := Service{
		store: quotaStore,
	}

	t.Run("delete quota", func(t *testing.T) {
		err := quotaService.DeleteByUser(context.Background(), 1)
		require.NoError(t, err)
	})
}

func TestIntegrationQuotaCommandsAndQueries(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := sqlstore.InitTestDB(t)
	sqlStore.Cfg.QuotaEnabled = true

	b := bus.ProvideBus(tracing.InitializeTracerForTest())
	quotaService := ProvideService(sqlStore, sqlStore.Cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	userService, err := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, quotaService)
	require.NoError(t, err)
	setupEnv(t, sqlStore, b, quotaService)

	u, err := userService.Create(context.Background(), &user.CreateUserCommand{
		Name:         "TestUser",
		SkipOrgSetup: true,
	})
	require.NoError(t, err)

	o, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{
		Name:   "TestOrg",
		UserID: u.ID,
	})
	require.NoError(t, err)

	// fetch global default limit/usage
	defaultGlobalLimits := make(map[quota.Tag]int64)
	existingGlobalUsage := make(map[quota.Tag]int64)
	result, err := quotaService.Get(context.Background(), string(quota.OrgScope), o.ID)
	require.NoError(t, err)
	for _, r := range result {
		tag, err := quota.NewTag(quota.TargetSrv(r.Service), quota.Target(r.Target), quota.OrgScope)
		require.NoError(t, err)
		defaultGlobalLimits[tag] = r.Limit
		existingGlobalUsage[tag] = r.Used
	}

	// fetch default limit/usage for org
	defaultOrgLimits := make(map[quota.Tag]int64)
	existingOrgUsage := make(map[quota.Tag]int64)
	result, err = quotaService.Get(context.Background(), string(quota.OrgScope), o.ID)
	require.NoError(t, err)
	for _, r := range result {
		tag, err := quota.NewTag(quota.TargetSrv(r.Service), quota.Target(r.Target), quota.OrgScope)
		require.NoError(t, err)
		defaultOrgLimits[tag] = r.Limit
		existingOrgUsage[tag] = r.Used
	}

	// fetch default limit/usage for user
	defaultUserLimits := make(map[quota.Tag]int64)
	existingUserUsage := make(map[quota.Tag]int64)
	result, err = quotaService.Get(context.Background(), string(quota.UserScope), o.ID)
	require.NoError(t, err)
	for _, r := range result {
		tag, err := quota.NewTag(quota.TargetSrv(r.Service), quota.Target(r.Target), quota.OrgScope)
		require.NoError(t, err)
		defaultUserLimits[tag] = r.Limit
		existingUserUsage[tag] = r.Used
	}

	t.Run("Given saved org quota for users", func(t *testing.T) {
		// update quota for the created org and limit users to 1
		var customOrgUserLimit int64 = 1
		orgCmd := quota.UpdateQuotaCmd{
			OrgId:  o.ID,
			Target: org.OrgUserQuotaTarget,
			Limit:  customOrgUserLimit,
		}
		err := quotaService.Update(context.Background(), &orgCmd)
		require.NoError(t, err)

		t.Run("Should be able to get saved limit/usage for org users", func(t *testing.T) {
			q, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.OrgScope, &quota.ScopeParameters{OrgID: o.ID})
			require.NoError(t, err)

			require.Equal(t, customOrgUserLimit, q.Limit)
			require.Equal(t, int64(1), q.Used)
		})

		t.Run("Should be able to get default org users limit/usage for unknown org", func(t *testing.T) {
			unknownOrgID := -1
			q, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.OrgScope, &quota.ScopeParameters{OrgID: int64(unknownOrgID)})
			require.NoError(t, err)

			tag, err := quota.NewTag(quota.TargetSrv(q.Service), quota.Target(q.Target), quota.Scope(q.Scope))
			require.NoError(t, err)
			require.Equal(t, defaultOrgLimits[tag], q.Limit)
			require.Equal(t, int64(0), q.Used)
		})

		t.Run("Should be able to get zero used org alert quota when table does not exist (ngalert is not enabled - default case)", func(t *testing.T) {
			// disable Grafana Alerting
			cfg := *sqlStore.Cfg
			cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{Enabled: pointer.Bool(false)}

			quotaSrv := ProvideService(sqlStore, &cfg)
			q, err := getQuotaBySrvTargetScope(t, quotaSrv, ngalertmodels.QuotaTargetSrv, ngalertmodels.QuotaTarget, quota.OrgScope, &quota.ScopeParameters{OrgID: o.ID})

			require.NoError(t, err)
			require.Equal(t, int64(0), q.Limit)
		})

		t.Run("Should be able to quota list for org", func(t *testing.T) {
			result, err := quotaService.Get(context.Background(), string(quota.OrgScope), o.ID)
			require.NoError(t, err)
			//require.Len(t, result, 5)
			require.Len(t, result, 4)

			require.NoError(t, err)
			for _, res := range result {
				tag, err := quota.NewTag(quota.TargetSrv(res.Service), quota.Target(res.Target), quota.Scope(res.Scope))
				require.NoError(t, err)
				limit := defaultOrgLimits[tag]
				used := existingOrgUsage[tag]
				if res.Target == org.OrgUserQuotaTarget {
					limit = customOrgUserLimit
					used = 1 // one user in the created org
				}
				require.Equal(t, limit, res.Limit)
				require.Equal(t, used, res.Used)
			}
		})
	})

	t.Run("Given saved org quota for dashboards", func(t *testing.T) {
		// update quota for the created org and limit dashboards to 1
		var customOrgDashboardLimit int64 = 1
		orgCmd := quota.UpdateQuotaCmd{
			OrgId:  o.ID,
			Target: string(dashboards.QuotaTarget),
			Limit:  customOrgDashboardLimit,
		}
		err := quotaService.Update(context.Background(), &orgCmd)
		require.NoError(t, err)

		t.Run("Should be able to get saved quota by org id and target", func(t *testing.T) {
			q, err := getQuotaBySrvTargetScope(t, quotaService, dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.OrgScope, &quota.ScopeParameters{OrgID: o.ID})
			require.NoError(t, err)

			tag, err := quota.NewTag(quota.TargetSrv(q.Service), quota.Target(q.Target), quota.Scope(q.Scope))
			require.NoError(t, err)
			require.Equal(t, customOrgDashboardLimit, q.Limit)
			require.Equal(t, existingOrgUsage[tag], q.Used)
		})
	})

	t.Run("Given saved user quota for org", func(t *testing.T) {
		// update quota for the created user and limit orgs to 1
		var customUserOrgsLimit int64 = 1
		userQuotaCmd := quota.UpdateQuotaCmd{
			UserId: u.ID,
			Target: org.OrgUserQuotaTarget,
			Limit:  customUserOrgsLimit,
		}
		err := quotaService.Update(context.Background(), &userQuotaCmd)
		require.NoError(t, err)

		t.Run("Should be able to get saved limit/usage for user orgs", func(t *testing.T) {
			q, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.UserScope, &quota.ScopeParameters{UserID: u.ID})
			require.NoError(t, err)

			require.Equal(t, customUserOrgsLimit, q.Limit)
			require.Equal(t, int64(1), q.Used)
		})

		t.Run("Should be able to get default user orgs limit/usage for unknown user", func(t *testing.T) {
			var unknownUserID int64 = -1
			q, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.UserScope, &quota.ScopeParameters{UserID: unknownUserID})
			require.NoError(t, err)

			tag, err := quota.NewTag(quota.TargetSrv(q.Service), quota.Target(q.Target), quota.Scope(q.Scope))
			require.NoError(t, err)
			require.Equal(t, defaultUserLimits[tag], q.Limit)
			require.Equal(t, int64(0), q.Used)
		})

		t.Run("Should be able to quota list for user", func(t *testing.T) {
			result, err = quotaService.Get(context.Background(), string(quota.UserScope), u.ID)
			require.NoError(t, err)

			result, err := quotaService.Get(context.Background(), string(quota.OrgScope), o.ID)
			require.NoError(t, err)
			require.Len(t, result, 5)
			for _, res := range result {
				tag, err := quota.NewTag(quota.TargetSrv(res.Service), quota.Target(res.Target), quota.Scope(res.Scope))
				require.NoError(t, err)
				limit := defaultUserLimits[tag]
				used := existingUserUsage[tag]
				if res.Target == org.OrgUserQuotaTarget {
					limit = customUserOrgsLimit // customized quota limit.
					used = 1                    // one user in the created org
				}
				require.Equal(t, limit, res.Limit)
				require.Equal(t, used, res.Used)
			}
		})
	})

	t.Run("Should be able to global user quota", func(t *testing.T) {
		q, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(user.QuotaTargetSrv), quota.Target(user.QuotaTarget), quota.GlobalScope, &quota.ScopeParameters{})
		require.NoError(t, err)

		tag, err := quota.NewTag(quota.TargetSrv(q.Service), quota.Target(q.Target), quota.Scope(q.Scope))
		require.NoError(t, err)
		require.Equal(t, defaultUserLimits[tag], q.Limit)
		require.Equal(t, int64(1), q.Used)
	})

	t.Run("Should be able to global org quota", func(t *testing.T) {
		q, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgQuotaTarget), quota.GlobalScope, &quota.ScopeParameters{})
		require.NoError(t, err)

		tag, err := quota.NewTag(quota.TargetSrv(q.Service), quota.Target(q.Target), quota.Scope(q.Scope))
		require.NoError(t, err)
		require.Equal(t, defaultGlobalLimits[tag], q.Limit)
		require.Equal(t, int64(1), q.Used)
	})

	t.Run("Should be able to get zero used global alert quota when table does not exist (ngalert is not enabled - default case)", func(t *testing.T) {
		q, err := getQuotaBySrvTargetScope(t, quotaService, ngalertmodels.QuotaTargetSrv, ngalertmodels.QuotaTarget, quota.GlobalScope, &quota.ScopeParameters{})
		require.NoError(t, err)

		tag, err := quota.NewTag(quota.TargetSrv(q.Service), quota.Target(q.Target), quota.Scope(q.Scope))
		require.NoError(t, err)
		require.Equal(t, defaultGlobalLimits[tag], q.Limit)
		require.Equal(t, int64(0), q.Used)
	})

	t.Run("Should be able to global dashboard quota", func(t *testing.T) {
		q, err := getQuotaBySrvTargetScope(t, quotaService, dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.GlobalScope, &quota.ScopeParameters{})
		require.NoError(t, err)

		tag, err := quota.NewTag(quota.TargetSrv(q.Service), quota.Target(q.Target), quota.Scope(q.Scope))
		require.NoError(t, err)
		require.Equal(t, defaultGlobalLimits[tag], q.Limit)
		require.Equal(t, int64(0), q.Used)
	})

	// related: https://github.com/grafana/grafana/issues/14342
	t.Run("Should org quota updating is successful even if it called multiple time", func(t *testing.T) {
		// update quota for the created org and limit users to 1
		var customOrgUserLimit int64 = 1
		orgCmd := quota.UpdateQuotaCmd{
			OrgId:  o.ID,
			Target: org.OrgUserQuotaTarget,
			Limit:  customOrgUserLimit,
		}
		err := quotaService.Update(context.Background(), &orgCmd)
		require.NoError(t, err)

		query, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.OrgScope, &quota.ScopeParameters{OrgID: o.ID})
		require.NoError(t, err)
		require.Equal(t, customOrgUserLimit, query.Limit)

		// XXX: resolution of `Updated` column is 1sec, so this makes delay
		time.Sleep(1 * time.Second)

		customOrgUserLimit = 2
		orgCmd = quota.UpdateQuotaCmd{
			OrgId:  o.ID,
			Target: org.OrgUserQuotaTarget,
			Limit:  customOrgUserLimit,
		}
		err = quotaService.Update(context.Background(), &orgCmd)
		require.NoError(t, err)

		query, err = getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.OrgScope, &quota.ScopeParameters{OrgID: o.ID})
		require.NoError(t, err)
		require.Equal(t, customOrgUserLimit, query.Limit)
	})

	// related: https://github.com/grafana/grafana/issues/14342
	t.Run("Should user quota updating is successful even if it called multiple time", func(t *testing.T) {
		// update quota for the created org and limit users to 1
		var customUserOrgLimit int64 = 1
		userQuotaCmd := quota.UpdateQuotaCmd{
			UserId: u.ID,
			Target: org.OrgUserQuotaTarget,
			Limit:  customUserOrgLimit,
		}
		err := quotaService.Update(context.Background(), &userQuotaCmd)
		require.NoError(t, err)

		query, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.UserScope, &quota.ScopeParameters{UserID: u.ID})
		require.NoError(t, err)
		require.Equal(t, customUserOrgLimit, query.Limit)

		// XXX: resolution of `Updated` column is 1sec, so this makes delay
		time.Sleep(1 * time.Second)

		customUserOrgLimit = 10
		userQuotaCmd = quota.UpdateQuotaCmd{
			UserId: u.ID,
			Target: org.OrgUserQuotaTarget,
			Limit:  customUserOrgLimit,
		}
		err = quotaService.Update(context.Background(), &userQuotaCmd)
		require.NoError(t, err)

		query, err = getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.UserScope, &quota.ScopeParameters{UserID: u.ID})
		require.NoError(t, err)
		require.Equal(t, customUserOrgLimit, query.Limit)
	})

	// TODO data_source, file
}

func getQuotaBySrvTargetScope(t *testing.T, quotaService quota.Service, srv quota.TargetSrv, target quota.Target, scope quota.Scope, scopeParams *quota.ScopeParameters) (quota.QuotaDTO, error) {
	t.Helper()

	var id int64 = 0
	switch {
	case scope == quota.OrgScope:
		id = scopeParams.OrgID
	case scope == quota.UserScope:
		id = scopeParams.UserID
	}

	result, err := quotaService.Get(context.Background(), string(scope), id)
	require.NoError(t, err)
	for _, r := range result {
		if r.Target != string(target) {
			continue
		}
		require.Equal(t, r.OrgId, scopeParams.OrgID)
		require.Equal(t, r.UserId, scopeParams.UserID)
		return r, nil
	}
	return quota.QuotaDTO{}, err
}

func setupEnv(t *testing.T, sqlStore *sqlstore.SQLStore, b bus.Bus, quotaService quota.Service) {
	_, err := apikeyimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	_, err = auth.ProvideActiveAuthTokenService(sqlStore.Cfg, sqlStore, quotaService)
	require.NoError(t, err)
	_, err = dashboardStore.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
	require.NoError(t, err)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	_, err = dsservice.ProvideService(sqlStore, secretsService, secretsStore, sqlStore.Cfg, featuremgmt.WithFeatures(), acmock.New().WithDisabled(), acmock.NewMockedPermissionsService(), quotaService)
	require.NoError(t, err)
	m := metrics.NewNGAlert(prometheus.NewRegistry())
	_, err = ngalert.ProvideService(
		sqlStore.Cfg, &ngalerttests.FakeFeatures{}, nil, nil, routing.NewRouteRegister(), sqlStore, nil, nil, nil, quotaService,
		secretsService, nil, m, &foldertest.FakeService{}, &acmock.Mock{}, &dashboards.FakeDashboardService{}, nil, b, &acmock.Mock{}, annotationstest.NewFakeAnnotationsRepo(),
	)
	require.NoError(t, err)
	_, err = storesrv.ProvideService(sqlStore, featuremgmt.WithFeatures(), sqlStore.Cfg, quotaService)
	require.NoError(t, err)
}
