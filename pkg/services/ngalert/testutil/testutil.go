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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func SetupFolderService(tb testing.TB, cfg *setting.Cfg, db db.DB, bus *bus.InProcBus, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl) folder.Service {
	tb.Helper()
	searchMock := resource.NewMockResourceClient(tb)
	searchMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{TotalHits: 0}, nil).Maybe()
	searchMock.On("GetStats", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceStatsResponse{}, nil).Maybe()
	return folderimpl.ProvideService(ac, nil,
		features, supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), searchMock, sort.ProvideService(), apiserver.WithoutRestConfig)
}

func SetupDashboardService(tb testing.TB, sqlStore db.DB, cfg *setting.Cfg) *dashboardservice.DashboardServiceImpl {
	tb.Helper()

	ac := acmock.New()
	dashboardPermissions := acmock.NewMockedPermissionsService()
	folderPermissions := acmock.NewMockedPermissionsService()
	folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

	features := featuremgmt.WithFeatures()
	quotaService := quotatest.New(false, nil)

	dashboardService, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg,
		sqlStore,
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
			nil,
			func() resource.ResourceClient {
				m := resource.NewMockResourceClient(tb)
				m.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{TotalHits: 0}, nil).Maybe()
				m.On("GetStats", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceStatsResponse{}, nil).Maybe()
				return m
			}(),
			sort.ProvideService(),
			dualwrite.ProvideTestService(),
			nil,
			features,
		),
	)
	require.NoError(tb, err)
	dashboardService.RegisterDashboardPermissions(dashboardPermissions)

	return dashboardService
}

func SetupOrgService(tb testing.TB, sqlStore db.DB, cfg *setting.Cfg) (org.Service, error) {
	tb.Helper()
	quotaService := quotatest.New(false, nil)
	return orgimpl.ProvideService(sqlStore, cfg, quotaService)
}
