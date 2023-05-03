package quotaimpl

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardStore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	storesrv "github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestQuotaService(t *testing.T) {
	quotaStore := &quotatest.FakeQuotaStore{}
	quotaService := service{
		store: quotaStore,
	}

	t.Run("delete quota", func(t *testing.T) {
		err := quotaService.DeleteQuotaForUser(context.Background(), 1)
		require.NoError(t, err)
	})
}

func TestIntegrationQuotaCommandsAndQueries(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := sqlstore.InitTestDB(t)
	sqlStore.Cfg.Quota = setting.QuotaSettings{
		Enabled: true,

		Org: setting.OrgQuota{
			User:       2,
			Dashboard:  3,
			DataSource: 4,
			ApiKey:     5,
			AlertRule:  6,
		},
		User: setting.UserQuota{
			Org: 7,
		},
		Global: setting.GlobalQuota{
			Org:        8,
			User:       9,
			Dashboard:  10,
			DataSource: 11,
			ApiKey:     12,
			Session:    13,
			AlertRule:  14,
			File:       15,
		},
	}

	b := bus.ProvideBus(tracing.InitializeTracerForTest())
	quotaService := ProvideService(sqlStore, sqlStore.Cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	userService, err := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
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
	scope := quota.GlobalScope
	result, err := quotaService.GetQuotasByScope(context.Background(), scope, 0)
	require.NoError(t, err)
	for _, r := range result {
		tag, err := r.Tag()
		require.NoError(t, err)
		defaultGlobalLimits[tag] = r.Limit
		existingGlobalUsage[tag] = r.Used
	}
	tag, err := quota.NewTag(quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgQuotaTarget), scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Global.Org, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(quota.TargetSrv(user.QuotaTargetSrv), quota.Target(user.QuotaTarget), scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Global.User, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Global.Dashboard, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(datasources.QuotaTargetSrv, datasources.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Global.DataSource, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Global.ApiKey, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(auth.QuotaTargetSrv, auth.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Global.Session, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(ngalertmodels.QuotaTargetSrv, ngalertmodels.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Global.AlertRule, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(storesrv.QuotaTargetSrv, storesrv.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Global.File, defaultGlobalLimits[tag])

	// fetch default limit/usage for org
	defaultOrgLimits := make(map[quota.Tag]int64)
	existingOrgUsage := make(map[quota.Tag]int64)
	scope = quota.OrgScope
	result, err = quotaService.GetQuotasByScope(context.Background(), scope, o.ID)
	require.NoError(t, err)
	for _, r := range result {
		tag, err := r.Tag()
		require.NoError(t, err)
		defaultOrgLimits[tag] = r.Limit
		existingOrgUsage[tag] = r.Used
	}
	tag, err = quota.NewTag(quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Org.User, defaultOrgLimits[tag])
	tag, err = quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Org.Dashboard, defaultOrgLimits[tag])
	tag, err = quota.NewTag(datasources.QuotaTargetSrv, datasources.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Org.DataSource, defaultOrgLimits[tag])
	tag, err = quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Org.ApiKey, defaultOrgLimits[tag])
	tag, err = quota.NewTag(ngalertmodels.QuotaTargetSrv, ngalertmodels.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.Org.AlertRule, defaultOrgLimits[tag])

	// fetch default limit/usage for user
	defaultUserLimits := make(map[quota.Tag]int64)
	existingUserUsage := make(map[quota.Tag]int64)
	scope = quota.UserScope
	result, err = quotaService.GetQuotasByScope(context.Background(), scope, u.ID)
	require.NoError(t, err)
	for _, r := range result {
		tag, err := r.Tag()
		require.NoError(t, err)
		defaultUserLimits[tag] = r.Limit
		existingUserUsage[tag] = r.Used
	}
	tag, err = quota.NewTag(quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), scope)
	require.NoError(t, err)
	require.Equal(t, sqlStore.Cfg.Quota.User.Org, defaultUserLimits[tag])

	t.Run("Given saved org quota for users", func(t *testing.T) {
		// update quota for the created org and limit users to 1
		var customOrgUserLimit int64 = 1
		orgCmd := quota.UpdateQuotaCmd{
			OrgID:  o.ID,
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

			tag, err := q.Tag()
			require.NoError(t, err)
			require.Equal(t, defaultOrgLimits[tag], q.Limit)
			require.Equal(t, int64(0), q.Used)
		})

		t.Run("Should be able to get zero used org alert quota when table does not exist (ngalert is not enabled - default case)", func(t *testing.T) {
			// disable Grafana Alerting
			cfg := *sqlStore.Cfg
			cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{Enabled: util.Pointer(false)}

			quotaSrv := ProvideService(sqlStore, &cfg)
			q, err := getQuotaBySrvTargetScope(t, quotaSrv, ngalertmodels.QuotaTargetSrv, ngalertmodels.QuotaTarget, quota.OrgScope, &quota.ScopeParameters{OrgID: o.ID})

			require.NoError(t, err)
			require.Equal(t, int64(0), q.Limit)
		})

		t.Run("Should be able to quota list for org", func(t *testing.T) {
			result, err := quotaService.GetQuotasByScope(context.Background(), quota.OrgScope, o.ID)
			require.NoError(t, err)
			require.Len(t, result, 5)

			require.NoError(t, err)
			for _, res := range result {
				tag, err := res.Tag()
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
			OrgID:  o.ID,
			Target: string(dashboards.QuotaTarget),
			Limit:  customOrgDashboardLimit,
		}
		err := quotaService.Update(context.Background(), &orgCmd)
		require.NoError(t, err)

		t.Run("Should be able to get saved quota by org id and target", func(t *testing.T) {
			q, err := getQuotaBySrvTargetScope(t, quotaService, dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.OrgScope, &quota.ScopeParameters{OrgID: o.ID})
			require.NoError(t, err)

			tag, err := q.Tag()
			require.NoError(t, err)
			require.Equal(t, customOrgDashboardLimit, q.Limit)
			require.Equal(t, existingOrgUsage[tag], q.Used)
		})
	})

	t.Run("Given saved user quota for org", func(t *testing.T) {
		// update quota for the created user and limit orgs to 1
		var customUserOrgsLimit int64 = 1
		userQuotaCmd := quota.UpdateQuotaCmd{
			UserID: u.ID,
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

			tag, err := q.Tag()
			require.NoError(t, err)
			require.Equal(t, defaultUserLimits[tag], q.Limit)
			require.Equal(t, int64(0), q.Used)
		})

		t.Run("Should be able to quota list for user", func(t *testing.T) {
			result, err = quotaService.GetQuotasByScope(context.Background(), quota.UserScope, u.ID)
			require.NoError(t, err)
			require.Len(t, result, 1)
			for _, res := range result {
				tag, err := res.Tag()
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

		tag, err := q.Tag()
		require.NoError(t, err)
		require.Equal(t, defaultGlobalLimits[tag], q.Limit)
		require.Equal(t, int64(1), q.Used)
	})

	t.Run("Should be able to global org quota", func(t *testing.T) {
		q, err := getQuotaBySrvTargetScope(t, quotaService, quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgQuotaTarget), quota.GlobalScope, &quota.ScopeParameters{})
		require.NoError(t, err)

		tag, err := q.Tag()
		require.NoError(t, err)
		require.Equal(t, defaultGlobalLimits[tag], q.Limit)
		require.Equal(t, int64(1), q.Used)
	})

	t.Run("Should be able to get zero used global alert quota when table does not exist (ngalert is not enabled - default case)", func(t *testing.T) {
		q, err := getQuotaBySrvTargetScope(t, quotaService, ngalertmodels.QuotaTargetSrv, ngalertmodels.QuotaTarget, quota.GlobalScope, &quota.ScopeParameters{})
		require.NoError(t, err)

		tag, err := q.Tag()
		require.NoError(t, err)
		require.Equal(t, defaultGlobalLimits[tag], q.Limit)
		require.Equal(t, int64(0), q.Used)
	})

	t.Run("Should be able to global dashboard quota", func(t *testing.T) {
		q, err := getQuotaBySrvTargetScope(t, quotaService, dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.GlobalScope, &quota.ScopeParameters{})
		require.NoError(t, err)

		tag, err := q.Tag()
		require.NoError(t, err)
		require.Equal(t, defaultGlobalLimits[tag], q.Limit)
		require.Equal(t, int64(0), q.Used)
	})

	// related: https://github.com/grafana/grafana/issues/14342
	t.Run("Should org quota updating is successful even if it called multiple time", func(t *testing.T) {
		// update quota for the created org and limit users to 1
		var customOrgUserLimit int64 = 1
		orgCmd := quota.UpdateQuotaCmd{
			OrgID:  o.ID,
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
			OrgID:  o.ID,
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
			UserID: u.ID,
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
			UserID: u.ID,
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

	result, err := quotaService.GetQuotasByScope(context.Background(), scope, id)
	require.NoError(t, err)
	for _, r := range result {
		if r.Target != string(target) {
			continue
		}

		if r.Service != string(srv) {
			continue
		}

		if r.Scope != string(scope) {
			continue
		}

		require.Equal(t, r.OrgId, scopeParams.OrgID)
		require.Equal(t, r.UserId, scopeParams.UserID)
		return r, nil
	}
	return quota.QuotaDTO{}, err
}

func setupEnv(t *testing.T, sqlStore *sqlstore.SQLStore, b bus.Bus, quotaService quota.Service) {
	tracer := tracing.InitializeTracerForTest()
	_, err := apikeyimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	_, err = authimpl.ProvideUserAuthTokenService(sqlStore, nil, quotaService, sqlStore.Cfg)
	require.NoError(t, err)
	_, err = dashboardStore.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
	require.NoError(t, err)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	_, err = dsservice.ProvideService(sqlStore, secretsService, secretsStore, sqlStore.Cfg, featuremgmt.WithFeatures(), acmock.New().WithDisabled(), acmock.NewMockedPermissionsService(), quotaService)
	require.NoError(t, err)
	m := metrics.NewNGAlert(prometheus.NewRegistry())
	_, err = ngalert.ProvideService(
		sqlStore.Cfg, featuremgmt.WithFeatures(), nil, nil, routing.NewRouteRegister(), sqlStore, nil, nil, nil, quotaService,
		secretsService, nil, m, &foldertest.FakeService{}, &acmock.Mock{}, &dashboards.FakeDashboardService{}, nil, b, &acmock.Mock{}, annotationstest.NewFakeAnnotationsRepo(), &plugins.FakePluginStore{}, tracer,
	)
	require.NoError(t, err)
	_, err = storesrv.ProvideService(sqlStore, featuremgmt.WithFeatures(), sqlStore.Cfg, quotaService, storesrv.ProvideSystemUsersService())
	require.NoError(t, err)
}
