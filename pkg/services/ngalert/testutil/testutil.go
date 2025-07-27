package testutil

import (
	"context"
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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func SetupFolderService(tb testing.TB, cfg *setting.Cfg, db db.DB, dashboardStore dashboards.Store, folderStore *folderimpl.DashboardFolderStoreImpl, bus *bus.InProcBus, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl) folder.Service {
	tb.Helper()
	fStore := folderimpl.ProvideStore(db)
	return folderimpl.ProvideService(fStore, ac, bus, dashboardStore, folderStore, nil, db,
		features, supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), nil, dualwrite.ProvideTestService(), sort.ProvideService(), apiserver.WithoutRestConfig)
}

func SetupTestFolderService(tb testing.TB, cfg *setting.Cfg, db db.DB, dashboardStore dashboards.Store, folderStore *folderimpl.DashboardFolderStoreImpl, bus *bus.InProcBus, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl) folder.Service {
	tb.Helper()
	fStore := folderimpl.ProvideStore(db)
	service := folderimpl.ProvideService(fStore, ac, bus, dashboardStore, folderStore, nil, db,
		features, supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), nil, dualwrite.ProvideTestService(), sort.ProvideService(), apiserver.WithoutRestConfig)
	return &testFolderServiceWrapper{service: service}
}

type testFolderServiceWrapper struct {
	service folder.Service
}

func (w *testFolderServiceWrapper) RegisterService(r folder.RegistryService) error {
	return w.service.RegisterService(r)
}

func (w *testFolderServiceWrapper) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.CreateLegacy(ctx, cmd)
	}
	return w.service.Create(ctx, cmd)
}

func (w *testFolderServiceWrapper) CreateLegacy(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	return w.service.CreateLegacy(ctx, cmd)
}

func (w *testFolderServiceWrapper) Get(ctx context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.GetLegacy(ctx, q)
	}
	return w.service.Get(ctx, q)
}

func (w *testFolderServiceWrapper) GetLegacy(ctx context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	return w.service.GetLegacy(ctx, q)
}

func (w *testFolderServiceWrapper) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.UpdateLegacy(ctx, cmd)
	}
	return w.service.Update(ctx, cmd)
}

func (w *testFolderServiceWrapper) UpdateLegacy(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	return w.service.UpdateLegacy(ctx, cmd)
}

func (w *testFolderServiceWrapper) Delete(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.DeleteLegacy(ctx, cmd)
	}
	return w.service.Delete(ctx, cmd)
}

func (w *testFolderServiceWrapper) DeleteLegacy(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	return w.service.DeleteLegacy(ctx, cmd)
}

func (w *testFolderServiceWrapper) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.MoveLegacy(ctx, cmd)
	}
	return w.service.Move(ctx, cmd)
}

func (w *testFolderServiceWrapper) MoveLegacy(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	return w.service.MoveLegacy(ctx, cmd)
}

func (w *testFolderServiceWrapper) GetFolders(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.GetFoldersLegacy(ctx, q)
	}
	return w.service.GetFolders(ctx, q)
}

func (w *testFolderServiceWrapper) GetFoldersLegacy(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	return w.service.GetFoldersLegacy(ctx, q)
}

func (w *testFolderServiceWrapper) GetChildren(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.GetChildrenLegacy(ctx, q)
	}
	return w.service.GetChildren(ctx, q)
}

func (w *testFolderServiceWrapper) GetChildrenLegacy(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	return w.service.GetChildrenLegacy(ctx, q)
}

func (w *testFolderServiceWrapper) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.GetParentsLegacy(ctx, q)
	}
	return w.service.GetParents(ctx, q)
}

func (w *testFolderServiceWrapper) GetParentsLegacy(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	return w.service.GetParentsLegacy(ctx, q)
}

func (w *testFolderServiceWrapper) GetDescendantCounts(ctx context.Context, q *folder.GetDescendantCountsQuery) (folder.DescendantCounts, error) {
	if s, ok := w.service.(*folderimpl.Service); ok {
		return s.GetDescendantCountsLegacy(ctx, q)
	}
	return w.service.GetDescendantCounts(ctx, q)
}

func (w *testFolderServiceWrapper) GetDescendantCountsLegacy(ctx context.Context, q *folder.GetDescendantCountsQuery) (folder.DescendantCounts, error) {
	return w.service.GetDescendantCountsLegacy(ctx, q)
}

func (w *testFolderServiceWrapper) SearchFolders(ctx context.Context, q folder.SearchFoldersQuery) (model.HitList, error) {
	return w.service.SearchFolders(ctx, q)
}

func (w *testFolderServiceWrapper) CountFoldersInOrg(ctx context.Context, orgID int64) (int64, error) {
	return w.service.CountFoldersInOrg(ctx, orgID)
}

func SetupDashboardService(tb testing.TB, sqlStore db.DB, fs *folderimpl.DashboardFolderStoreImpl, cfg *setting.Cfg) (*dashboardservice.DashboardServiceImpl, dashboards.Store) {
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
		cfg, dashboardStore, fs,
		features, folderPermissions, ac,
		&actest.FakeService{}, foldertest.NewFakeService(),
		nil, client.MockTestRestConfig{}, nil, quotaService, nil, nil, nil,
		dualwrite.ProvideTestService(), sort.ProvideService(),
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore(),
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
