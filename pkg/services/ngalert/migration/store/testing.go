package store

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	legacyalerting "github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	datasourceGuardian "github.com/grafana/grafana/pkg/services/datasources/guardian"
	datasourceService "github.com/grafana/grafana/pkg/services/datasources/service"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func NewTestMigrationStore(t testing.TB, sqlStore *sqlstore.SQLStore, cfg *setting.Cfg) *migrationStore {
	if cfg.UnifiedAlerting.BaseInterval == 0 {
		cfg.UnifiedAlerting.BaseInterval = time.Second * 10
	}
	features := featuremgmt.WithFeatures()
	cfg.IsFeatureToggleEnabled = features.IsEnabledGlobally
	alertingStore := store.DBstore{
		SQLStore: sqlStore,
		Cfg:      cfg.UnifiedAlerting,
		Logger:   &logtest.Fake{},
	}
	bus := bus.ProvideBus(tracing.InitializeTracerForTest())
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)

	cache := localcache.ProvideService()
	quotaService := &quotatest.FakeQuotaService{}
	ac := acimpl.ProvideAccessControl(cfg)
	routeRegister := routing.ProvideRegister()

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()
	teamSvc, err := teamimpl.ProvideService(sqlStore, cfg)
	require.NoError(t, err)
	orgService, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	require.NoError(t, err)
	userSvc, err := userimpl.ProvideService(sqlStore, orgService, cfg, teamSvc, cache, quotaService, bundleregistry.ProvideService())
	require.NoError(t, err)

	acSvc, err := acimpl.ProvideService(cfg, sqlStore, routing.ProvideRegister(), cache, ac, features)
	require.NoError(t, err)

	dashboardStore, err := database.ProvideDashboardStore(sqlStore, sqlStore.Cfg, features, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)
	folderService := folderimpl.ProvideService(ac, bus, cfg, dashboardStore, folderStore, sqlStore, features, nil)

	err = folderService.RegisterService(alertingStore)
	require.NoError(t, err)

	folderPermissions, err := ossaccesscontrol.ProvideFolderPermissions(
		cfg, features, routeRegister, sqlStore, ac, license, dashboardStore, folderService, acSvc, teamSvc, userSvc)
	require.NoError(t, err)
	dashboardPermissions, err := ossaccesscontrol.ProvideDashboardPermissions(
		cfg, features, routeRegister, sqlStore, ac, license, dashboardStore, folderService, acSvc, teamSvc, userSvc)
	require.NoError(t, err)

	dashboardService, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore, nil,
		features, folderPermissions, dashboardPermissions, ac,
		folderService,
		nil,
	)
	require.NoError(t, err)
	guardian.InitAccessControlGuardian(setting.NewCfg(), ac, dashboardService)

	err = acSvc.RegisterFixedRoles(context.Background())
	require.NoError(t, err)

	return &migrationStore{
		log:                            &logtest.Fake{},
		cfg:                            cfg,
		store:                          sqlStore,
		kv:                             kvstore.ProvideService(sqlStore),
		alertingStore:                  &alertingStore,
		dashboardService:               dashboardService,
		folderService:                  folderService,
		dataSourceCache:                datasourceService.ProvideCacheService(cache, sqlStore, datasourceGuardian.ProvideGuardian()),
		folderPermissions:              folderPermissions,
		dashboardPermissions:           dashboardPermissions,
		orgService:                     orgService,
		legacyAlertNotificationService: legacyalerting.ProvideService(cfg, sqlStore, encryptionservice.SetupTestService(t), nil),
	}
}
