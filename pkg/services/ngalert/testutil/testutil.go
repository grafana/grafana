package testutil

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func SetupFolderService(tb testing.TB, cfg *setting.Cfg, db db.DB, dashboardStore dashboards.Store, folderStore *folderimpl.DashboardFolderStoreImpl, bus *bus.InProcBus, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl) folder.Service {
	tb.Helper()
	fStore := folderimpl.ProvideStore(db)
	return folderimpl.ProvideService(fStore, ac, bus, dashboardStore, folderStore, db,
		features, supportbundlestest.NewFakeBundleService(), nil, tracing.InitializeTracerForTest())
}

func SetupDashboardService(tb testing.TB, sqlStore db.DB, fs *folderimpl.DashboardFolderStoreImpl, cfg *setting.Cfg) (*dashboardservice.DashboardServiceImpl, dashboards.Store) {
	tb.Helper()

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
		CanSaveValue:  true,
		CanViewValue:  true,
		CanAdminValue: true,
	})
	tb.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	ac := acmock.New()
	dashboardPermissions := acmock.NewMockedPermissionsService()
	folderPermissions := acmock.NewMockedPermissionsService()
	folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

	features := featuremgmt.WithFeatures()
	quotaService := quotatest.New(false, nil)

	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore))
	require.NoError(tb, err)

	dashboardService, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg, dashboardStore, fs,
		features, folderPermissions, dashboardPermissions, ac,
		foldertest.NewFakeService(), folder.NewFakeStore(),
		nil, zanzana.NewNoopClient(), nil, nil, nil, quotaService, nil,
	)
	require.NoError(tb, err)

	return dashboardService, dashboardStore
}
