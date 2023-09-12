package store

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	datasourceService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/testutil"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func NewTestMigrationStore(t *testing.T, sqlStore *sqlstore.SQLStore, cfg *setting.Cfg) *migrationStore {
	//if cfg == nil {
	//	cfg = setting.NewCfg()
	//}
	if cfg.UnifiedAlerting.BaseInterval == 0 {
		cfg.UnifiedAlerting.BaseInterval = time.Second * 10
	}
	alertingStore := store.DBstore{
		SQLStore: sqlStore,
		Cfg:      cfg.UnifiedAlerting,
	}
	bus := bus.ProvideBus(tracing.InitializeTracerForTest())
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	dashboardService, dashboardStore := testutil.SetupDashboardService(t, sqlStore, folderStore, cfg)
	folderService := testutil.SetupFolderService(t, cfg, sqlStore, dashboardStore, folderStore, bus)

	cache := localcache.ProvideService()
	return &migrationStore{
		log:              &logtest.Fake{},
		cfg:              cfg,
		store:            sqlStore,
		kv:               fakes.NewFakeKVStore(t),
		alertingStore:    &alertingStore,
		dashboardService: dashboardService,
		folderService:    folderService,
		dataSourceCache:  datasourceService.ProvideCacheService(cache, sqlStore, guardian.ProvideGuardian()),
	}
}
