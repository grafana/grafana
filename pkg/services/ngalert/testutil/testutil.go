package testutil

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func SetupFolderService(tb testing.TB, cfg *setting.Cfg, dashboardStore dashboards.Store, folderStore *folderimpl.DashboardFolderStoreImpl, bus *bus.InProcBus) folder.Service {
	tb.Helper()

	ac := acmock.New()
	features := featuremgmt.WithFeatures()

	return folderimpl.ProvideService(ac, bus, cfg, dashboardStore, folderStore, nil, features)
}

func SetupDashboardService(tb testing.TB, sqlStore *sqlstore.SQLStore, fs *folderimpl.DashboardFolderStoreImpl, cfg *setting.Cfg) (*dashboardservice.DashboardServiceImpl, dashboards.Store) {
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

	dashboardStore, err := database.ProvideDashboardStore(sqlStore, sqlStore.Cfg, features, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
	require.NoError(tb, err)

	dashboardService, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg, dashboardStore, fs, nil,
		features, folderPermissions, dashboardPermissions, ac,
		foldertest.NewFakeService(),
	)
	require.NoError(tb, err)

	return dashboardService, dashboardStore
}
