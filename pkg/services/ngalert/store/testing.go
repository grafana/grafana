package store

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

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
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func NewFakeImageStore(t *testing.T) *FakeImageStore {
	return &FakeImageStore{
		t:      t,
		images: make(map[string]*models.Image),
	}
}

type FakeImageStore struct {
	t      *testing.T
	mtx    sync.Mutex
	images map[string]*models.Image
}

func (s *FakeImageStore) GetImage(_ context.Context, url string) (*models.Image, error) {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	if image, ok := s.images[url]; ok {
		return image, nil
	}
	return nil, models.ErrImageNotFound
}

func (s *FakeImageStore) GetImages(_ context.Context, urls []string) ([]models.Image, []string, error) {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	images := make([]models.Image, 0, len(urls))
	for _, url := range urls {
		if image, ok := s.images[url]; ok {
			images = append(images, *image)
		}
	}
	if len(images) < len(urls) {
		return images, unmatchedURLs(urls, images), models.ErrImageNotFound
	}
	return images, nil, nil
}

func (s *FakeImageStore) SaveImage(_ context.Context, image *models.Image) error {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	if image.ID == 0 {
		image.ID = int64(len(s.images)) + 1
	}
	s.images[image.URL] = image

	return nil
}

func NewFakeAdminConfigStore(t *testing.T) *FakeAdminConfigStore {
	t.Helper()
	return &FakeAdminConfigStore{Configs: map[int64]*models.AdminConfiguration{}}
}

type FakeAdminConfigStore struct {
	mtx     sync.Mutex
	Configs map[int64]*models.AdminConfiguration
}

func (f *FakeAdminConfigStore) GetAdminConfiguration(orgID int64) (*models.AdminConfiguration, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	return f.Configs[orgID], nil
}

func (f *FakeAdminConfigStore) GetAdminConfigurations() ([]*models.AdminConfiguration, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	acs := make([]*models.AdminConfiguration, 0, len(f.Configs))
	for _, ac := range f.Configs {
		acs = append(acs, ac)
	}

	return acs, nil
}

func (f *FakeAdminConfigStore) DeleteAdminConfiguration(orgID int64) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	delete(f.Configs, orgID)
	return nil
}
func (f *FakeAdminConfigStore) UpdateAdminConfiguration(cmd UpdateAdminConfigurationCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.Configs[cmd.AdminConfiguration.OrgID] = cmd.AdminConfiguration

	return nil
}

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
