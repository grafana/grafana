package testutil

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	dashclient "github.com/grafana/grafana/pkg/services/dashboards/service/client"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func SetupFolderService(tb testing.TB, cfg *setting.Cfg, db db.DB, dashboardStore dashboards.Store, bus *bus.InProcBus, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl) folder.Service {
	tb.Helper()
	fStore := folderimpl.ProvideStore(db)
	return folderimpl.ProvideService(fStore, ac, bus, dashboardStore, nil, db,
		features, supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), nil, dualwrite.ProvideTestService(), sort.ProvideService(), apiserver.WithoutRestConfig)
}

func SetupDashboardService(tb testing.TB, sqlStore db.DB, cfg *setting.Cfg) (*dashboardservice.DashboardServiceImpl, dashboards.Store) {
	tb.Helper()

	ac := acmock.New()
	dashboardPermissions := acmock.NewMockedPermissionsService()
	folderPermissions := acmock.NewMockedPermissionsService()
	folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

	features := featuremgmt.WithFeatures()
	quotaService := quotatest.New(false, nil)

	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore))
	require.NoError(tb, err)

	dashboardService, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg,
		dashboardStore,
		features,
		folderPermissions,
		ac,
		&actest.FakeService{},
		foldertest.NewFakeService(),
		nil,
		quotaService,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore(),
		dashclient.NewK8sClientWithFallback(
			cfg,
			client.MockTestRestConfig{},
			dashboardStore,
			nil,
			nil,
			sort.ProvideService(),
			dualwrite.ProvideTestService(),
			nil,
			features,
		),
	)
	require.NoError(tb, err)
	dashboardService.RegisterDashboardPermissions(dashboardPermissions)

	return dashboardService, dashboardStore
}

func SetupOrgService(tb testing.TB, sqlStore db.DB, cfg *setting.Cfg) (org.Service, error) {
	tb.Helper()
	quotaService := quotatest.New(false, nil)
	return orgimpl.ProvideService(sqlStore, cfg, quotaService)
}
