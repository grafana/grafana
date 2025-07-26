package quotaimpl

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	pluginfakes "github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardStore "github.com/grafana/grafana/pkg/services/dashboards/database"
	dashService "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	ngalertfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	storesrv "github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
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
	sqlStore, cfg := db.InitTestDBWithCfg(t)
	cfg.Quota = setting.QuotaSettings{
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
	quotaService := ProvideService(sqlStore, cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	require.NoError(t, err)
	userService, err := userimpl.ProvideService(
		sqlStore, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)
	setupEnv(t, sqlStore, cfg, b, quotaService)

	u, err := userService.Create(context.Background(), &user.CreateUserCommand{
		Name:         "TestUser",
		Login:        "TestUser",
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
	require.Equal(t, cfg.Quota.Global.Org, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(quota.TargetSrv(user.QuotaTargetSrv), quota.Target(user.QuotaTarget), scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Global.User, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Global.Dashboard, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(datasources.QuotaTargetSrv, datasources.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Global.DataSource, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Global.ApiKey, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(auth.QuotaTargetSrv, auth.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Global.Session, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(ngalertmodels.QuotaTargetSrv, ngalertmodels.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Global.AlertRule, defaultGlobalLimits[tag])
	tag, err = quota.NewTag(storesrv.QuotaTargetSrv, storesrv.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Global.File, defaultGlobalLimits[tag])

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
	require.Equal(t, cfg.Quota.Org.User, defaultOrgLimits[tag])
	tag, err = quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Org.Dashboard, defaultOrgLimits[tag])
	tag, err = quota.NewTag(datasources.QuotaTargetSrv, datasources.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Org.DataSource, defaultOrgLimits[tag])
	tag, err = quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Org.ApiKey, defaultOrgLimits[tag])
	tag, err = quota.NewTag(ngalertmodels.QuotaTargetSrv, ngalertmodels.QuotaTarget, scope)
	require.NoError(t, err)
	require.Equal(t, cfg.Quota.Org.AlertRule, defaultOrgLimits[tag])

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
	require.Equal(t, cfg.Quota.User.Org, defaultUserLimits[tag])

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
			alertingCfg := cfg.UnifiedAlerting
			defer func() {
				cfg.UnifiedAlerting = alertingCfg
			}()
			cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{Enabled: util.Pointer(false)}

			quotaSrv := ProvideService(sqlStore, cfg)
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

	var id int64
	switch scope {
	case quota.GlobalScope:
		id = 0
	case quota.OrgScope:
		id = scopeParams.OrgID
	case quota.UserScope:
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

func setupEnv(t *testing.T, sqlStore db.DB, cfg *setting.Cfg, b bus.Bus, quotaService quota.Service) {
	tracer := tracing.InitializeTracerForTest()
	_, err := apikeyimpl.ProvideService(sqlStore, cfg, quotaService)
	require.NoError(t, err)
	_, err = authimpl.ProvideUserAuthTokenService(sqlStore, nil, quotaService, fakes.NewFakeSecretsService(), cfg, tracing.InitializeTracerForTest(), featuremgmt.WithFeatures())
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	fStore := folderimpl.ProvideStore(sqlStore)
	dashStore, err := dashboardStore.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
	require.NoError(t, err)
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	folderSvc := folderimpl.ProvideService(
		fStore, acmock.New(), bus.ProvideBus(tracing.InitializeTracerForTest()), dashStore, folderStore,
		nil, sqlStore, featuremgmt.WithFeatures(), supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), nil, dualwrite.ProvideTestService(), sort.ProvideService(), apiserver.WithoutRestConfig)
	orgService, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	require.NoError(t, err)
	dashService, err := dashService.ProvideDashboardServiceImpl(cfg, dashStore, folderStore, featuremgmt.WithFeatures(), acmock.NewMockedPermissionsService(),
		ac, actest.FakeService{}, folderSvc, nil, client.MockTestRestConfig{}, nil, quotaService, orgService, nil, nil, dualwrite.ProvideTestService(), sort.ProvideService(),
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore())
	require.NoError(t, err)
	dashService.RegisterDashboardPermissions(acmock.NewMockedPermissionsService())
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	_, err = dsservice.ProvideService(sqlStore, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(),
		quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, plugincontext.
			ProvideBaseService(cfg, pluginconfig.NewFakePluginRequestConfigProvider()))
	require.NoError(t, err)
	m := metrics.NewNGAlert(prometheus.NewRegistry())

	ruleStore, err := ngstore.ProvideDBStore(cfg, featuremgmt.WithFeatures(), sqlStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, b)
	require.NoError(t, err)
	cfg.UnifiedAlerting.InitializationTimeout = 30 * time.Second
	_, err = ngalert.ProvideService(
		cfg, featuremgmt.WithFeatures(), nil, nil, routing.NewRouteRegister(), sqlStore, ngalertfakes.NewFakeKVStore(t), nil, nil, quotaService,
		secretsService, nil, m, &foldertest.FakeService{}, &acmock.Mock{}, &dashboards.FakeDashboardService{}, nil, b, &acmock.Mock{},
		annotationstest.NewFakeAnnotationsRepo(), &pluginstore.FakePluginStore{}, tracer, ruleStore, httpclient.NewProvider(), nil, ngalertfakes.NewFakeReceiverPermissionsService(), usertest.NewUserServiceFake(),
	)
	require.NoError(t, err)
	_, err = storesrv.ProvideService(sqlStore, featuremgmt.WithFeatures(), cfg, quotaService, storesrv.ProvideSystemUsersService())
	require.NoError(t, err)
}
