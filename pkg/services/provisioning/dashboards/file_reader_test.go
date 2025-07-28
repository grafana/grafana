package dashboards

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

const (
	defaultDashboards         = "testdata/test-dashboards/folder-one"
	brokenDashboards          = "testdata/test-dashboards/broken-dashboards"
	oneDashboard              = "testdata/test-dashboards/one-dashboard"
	containingID              = "testdata/test-dashboards/containing-id"
	unprovision               = "testdata/test-dashboards/unprovision"
	foldersFromFilesStructure = "testdata/test-dashboards/folders-from-files-structure"
	configName                = "default"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestCreatingNewDashboardFileReader(t *testing.T) {
	setup := func() *config {
		return &config{
			Name:    "Default",
			Type:    "file",
			OrgID:   1,
			Folder:  "",
			Options: map[string]any{},
		}
	}

	t.Run("using path parameter", func(t *testing.T) {
		cfg := setup()
		cfg.Options["path"] = defaultDashboards
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil, nil, nil)
		require.NoError(t, err)
		require.NotEqual(t, reader.Path, "")
	})

	t.Run("using folder as options", func(t *testing.T) {
		cfg := setup()
		cfg.Options["folder"] = defaultDashboards
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil, nil, nil)
		require.NoError(t, err)
		require.NotEqual(t, reader.Path, "")
	})

	t.Run("using foldersFromFilesStructure as options", func(t *testing.T) {
		cfg := setup()
		cfg.Options["path"] = foldersFromFilesStructure
		cfg.Options["foldersFromFilesStructure"] = true
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil, nil, nil)
		require.NoError(t, err)
		require.NotEqual(t, reader.Path, "")
	})

	t.Run("using full path", func(t *testing.T) {
		cfg := setup()
		fullPath := "/var/lib/grafana/dashboards"
		if runtime.GOOS == "windows" {
			fullPath = `c:\var\lib\grafana`
		}

		cfg.Options["folder"] = fullPath
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil, nil, nil)
		require.NoError(t, err)

		require.Equal(t, reader.Path, fullPath)
		require.True(t, filepath.IsAbs(reader.Path))
	})

	t.Run("using relative path", func(t *testing.T) {
		cfg := setup()
		cfg.Options["folder"] = defaultDashboards
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil, nil, nil)
		require.NoError(t, err)

		resolvedPath := reader.resolvedPath()
		require.True(t, filepath.IsAbs(resolvedPath))
	})
}

func TestIntegrationDashboardFileReader(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	logger := log.New("test-logger")
	cfg := &config{}

	fakeService := &dashboards.FakeDashboardProvisioning{}
	defer fakeService.AssertExpectations(t)
	fakeStore := &fakeDashboardStore{}
	setup := func() {
		cfg = &config{
			Name:    configName,
			Type:    "file",
			OrgID:   1,
			Folder:  "",
			Options: map[string]any{},
		}
	}

	sql, cfgT := db.InitTestDBWithCfg(t)
	features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)
	fStore := folderimpl.ProvideStore(sql)
	tagService := tagimpl.ProvideService(sql)
	dashStore, err := database.ProvideDashboardStore(sql, cfgT, features, tagService)
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sql)
	folderSvc := folderimpl.ProvideService(fStore, actest.FakeAccessControl{}, bus.ProvideBus(tracing.InitializeTracerForTest()),
		dashStore, folderStore, nil, sql, featuremgmt.WithFeatures(),
		supportbundlestest.NewFakeBundleService(), nil, cfgT, nil, tracing.InitializeTracerForTest(), nil, dualwrite.ProvideTestService(), sort.ProvideService(), apiserver.WithoutRestConfig)

	t.Run("Reading dashboards from disk", func(t *testing.T) {
		t.Run("Can read default dashboard", func(t *testing.T) {
			setup()
			cfg.Options["path"] = defaultDashboards
			cfg.Folder = "Team A"

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(nil, nil).Once()
			fakeService.On("SaveFolderForProvisionedDashboards", mock.Anything, mock.Anything).Return(&folder.Folder{ID: 1}, nil).Once()
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{ID: 2}, nil).Times(2)
			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})

		t.Run("Can read default dashboard and replace old version in database", func(t *testing.T) {
			setup()
			cfg.Options["path"] = oneDashboard

			inserted := 0
			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(nil, nil).Once()
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).
				Return(&dashboards.Dashboard{}, nil).Once().
				Run(func(args mock.Arguments) {
					inserted++
				})

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)

			assert.Equal(t, inserted, 1)
		})

		t.Run("Dashboard with older timestamp and the same checksum will not replace imported dashboard", func(t *testing.T) {
			setup()
			cfg.Options["path"] = oneDashboard
			absPath, err := filepath.Abs(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)
			stat, err := os.Stat(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)
			file, err := os.Open(filepath.Clean(absPath))
			require.NoError(t, err)
			t.Cleanup(func() {
				_ = file.Close()
			})

			checksum, err := util.Md5Sum(file)
			require.NoError(t, err)

			provisionedDashboard := []*dashboards.DashboardProvisioning{
				{
					Name:       "Default",
					ExternalID: absPath,
					Updated:    stat.ModTime().AddDate(0, 0, +1).Unix(),
					CheckSum:   checksum,
				},
			}

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(provisionedDashboard, nil).Once()

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})

		t.Run("Dashboard with older timestamp and different checksum will replace imported dashboard", func(t *testing.T) {
			setup()
			cfg.Options["path"] = oneDashboard
			absPath, err := filepath.Abs(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)
			stat, err := os.Stat(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)

			provisionedDashboard := []*dashboards.DashboardProvisioning{
				{
					Name:       "Default",
					ExternalID: absPath,
					Updated:    stat.ModTime().AddDate(0, 0, +1).Unix(),
					CheckSum:   "fakechecksum",
				},
			}

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(provisionedDashboard, nil).Once()
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Once()

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})

		t.Run("Dashboard with newer timestamp and the same checksum will not replace imported dashboard", func(t *testing.T) {
			setup()
			cfg.Options["path"] = oneDashboard
			absPath, err := filepath.Abs(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)
			stat, err := os.Stat(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)
			file, err := os.Open(filepath.Clean(absPath))
			require.NoError(t, err)
			t.Cleanup(func() {
				_ = file.Close()
			})

			checksum, err := util.Md5Sum(file)
			require.NoError(t, err)

			provisionedDashboard := []*dashboards.DashboardProvisioning{
				{
					Name:       "Default",
					ExternalID: absPath,
					Updated:    stat.ModTime().AddDate(0, 0, -1).Unix(),
					CheckSum:   checksum,
				},
			}

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(provisionedDashboard, nil).Once()

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})

		t.Run("Dashboard with newer timestamp and different checksum should replace imported dashboard", func(t *testing.T) {
			setup()
			cfg.Options["path"] = oneDashboard
			absPath, err := filepath.Abs(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)
			stat, err := os.Stat(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)

			provisionedDashboard := []*dashboards.DashboardProvisioning{
				{
					Name:       "Default",
					ExternalID: absPath,
					Updated:    stat.ModTime().AddDate(0, 0, -1).Unix(),
					CheckSum:   "fakechecksum",
				},
			}

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(provisionedDashboard, nil).Once()
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Once()

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})

		t.Run("Overrides id from dashboard.json files", func(t *testing.T) {
			setup()
			cfg.Options["path"] = containingID

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(nil, nil).Once()
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Once()

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})

		t.Run("Get folder from files structure", func(t *testing.T) {
			setup()
			cfg.Options["path"] = foldersFromFilesStructure
			cfg.Options["foldersFromFilesStructure"] = true

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(nil, nil).Once()
			fakeService.On("SaveFolderForProvisionedDashboards", mock.Anything, mock.Anything).Return(&folder.Folder{}, nil).Times(2)
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Times(3)

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})

		t.Run("Invalid configuration should return error", func(t *testing.T) {
			setup()
			cfg := &config{
				Name:   "Default",
				Type:   "file",
				OrgID:  1,
				Folder: "",
			}

			_, err := NewDashboardFileReader(cfg, logger, nil, nil, folderSvc)
			require.NotNil(t, err)
		})

		t.Run("Broken dashboards should not cause error", func(t *testing.T) {
			setup()
			cfg.Options["path"] = brokenDashboards

			_, err := NewDashboardFileReader(cfg, logger, nil, nil, folderSvc)
			require.NoError(t, err)
		})

		t.Run("Two dashboard providers should be able to provisioned the same dashboard without uid", func(t *testing.T) {
			setup()
			cfg1 := &config{Name: "1", Type: "file", OrgID: 1, Folder: "f1", Options: map[string]any{"path": containingID}}
			cfg2 := &config{Name: "2", Type: "file", OrgID: 1, Folder: "f2", Options: map[string]any{"path": containingID}}

			fakeService.On("GetProvisionedDashboardData", mock.Anything, mock.AnythingOfType("string")).Return(nil, nil).Times(2)
			fakeService.On("SaveFolderForProvisionedDashboards", mock.Anything, mock.Anything).Return(&folder.Folder{}, nil).Times(2)
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Times(2)

			reader1, err := NewDashboardFileReader(cfg1, logger, nil, fakeStore, folderSvc)
			reader1.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader1.walkDisk(context.Background())
			require.NoError(t, err)

			reader2, err := NewDashboardFileReader(cfg2, logger, nil, fakeStore, folderSvc)
			reader2.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader2.walkDisk(context.Background())
			require.NoError(t, err)
		})
	})

	t.Run("Should not create new folder if folder name is missing", func(t *testing.T) {
		setup()
		cfg := &config{
			Name:   "Default",
			Type:   "file",
			OrgID:  1,
			Folder: "",
			Options: map[string]any{
				"folder": defaultDashboards,
			},
		}
		r, err := NewDashboardFileReader(cfg, logger, nil, nil, folderSvc)
		require.NoError(t, err)

		_, _, err = r.getOrCreateFolder(context.Background(), cfg, fakeService, cfg.Folder)
		require.Equal(t, err, ErrFolderNameMissing)
	})

	t.Run("can get or Create dashboard folder", func(t *testing.T) {
		setup()
		cfg := &config{
			Name:   "Default",
			Type:   "file",
			OrgID:  1,
			Folder: "TEAM A",
			Options: map[string]any{
				"folder": defaultDashboards,
			},
		}
		fakeService.On("SaveFolderForProvisionedDashboards", mock.Anything, mock.Anything).Return(&folder.Folder{ID: 1}, nil).Once()

		r, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
		require.NoError(t, err)

		ctx := context.Background()
		ctx, _ = identity.WithServiceIdentity(ctx, 1)
		_, _, err = r.getOrCreateFolder(ctx, cfg, fakeService, cfg.Folder)
		require.NoError(t, err)
	})

	t.Run("should not create dashboard folder with uid general", func(t *testing.T) {
		setup()
		cfg := &config{
			Name:      "DefaultB",
			Type:      "file",
			OrgID:     1,
			Folder:    "TEAM B",
			FolderUID: "general",
			Options: map[string]any{
				"folder": defaultDashboards,
			},
		}

		r, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
		require.NoError(t, err)

		ctx := context.Background()
		ctx, _ = identity.WithServiceIdentity(ctx, 1)
		_, _, err = r.getOrCreateFolder(ctx, cfg, fakeService, cfg.Folder)
		require.ErrorIs(t, err, dashboards.ErrFolderInvalidUID)
	})

	t.Run("Walking the folder with dashboards", func(t *testing.T) {
		setup()
		noFiles := map[string]os.FileInfo{}

		t.Run("should skip dirs that starts with .", func(t *testing.T) {
			shouldSkip := createWalkFn(noFiles)("path", &FakeFileInfo{isDirectory: true, name: ".folder"}, nil)
			require.Equal(t, shouldSkip, filepath.SkipDir)
		})

		t.Run("should keep walking if file is not .json", func(t *testing.T) {
			shouldSkip := createWalkFn(noFiles)("path", &FakeFileInfo{isDirectory: true, name: "folder"}, nil)
			require.Nil(t, shouldSkip)
		})
	})

	t.Run("Should resolve relative ExternalID paths to absolute paths", func(t *testing.T) {
		setup()
		cfg.Options["path"] = defaultDashboards
		provisionedDashboard := []*dashboards.DashboardProvisioning{
			{
				Name:       configName,
				ExternalID: "dashboard1.json",
			},
		}

		fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(provisionedDashboard, nil).Once()
		reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
		reader.dashboardProvisioningService = fakeService
		require.NoError(t, err)
		resolvedPath := reader.resolvedPath()
		dashboards, err := reader.getProvisionedDashboardsByPath(context.Background(), fakeService, configName)
		require.NoError(t, err)
		expectedPath := filepath.Join(resolvedPath, "dashboard1.json")
		require.Equal(t, expectedPath, dashboards[expectedPath].ExternalID)
	})

	t.Run("Given missing dashboard file", func(t *testing.T) {
		absPath1, err := filepath.Abs(unprovision + "/dashboard1.json")
		require.NoError(t, err)
		// This one does not exist on disk, simulating a deleted file
		absPath2, err := filepath.Abs(unprovision + "/dashboard2.json")
		require.NoError(t, err)

		provisionedDashboard := []*dashboards.DashboardProvisioning{
			{DashboardID: 1, Name: "Default", ExternalID: absPath1},
			{DashboardID: 2, Name: "Default", ExternalID: absPath2},
		}

		setupFakeService := func() {
			setup()
			cfg = &config{
				Name:  configName,
				Type:  "file",
				OrgID: 1,
				Options: map[string]any{
					"folder": unprovision,
				},
			}
		}

		t.Run("Missing dashboard should be unprovisioned if DisableDeletion = true", func(t *testing.T) {
			setupFakeService()

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(provisionedDashboard, nil).Once()
			fakeService.On("UnprovisionDashboard", mock.Anything, mock.Anything).Return(nil).Once()
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Once()

			cfg.DisableDeletion = true

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			require.NoError(t, err)
			reader.dashboardProvisioningService = fakeService

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})

		t.Run("Missing dashboard should be deleted if DisableDeletion = false", func(t *testing.T) {
			setupFakeService()

			fakeService.On("GetProvisionedDashboardData", mock.Anything, configName).Return(provisionedDashboard, nil).Once()
			fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Once()
			fakeService.On("DeleteProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

			reader, err := NewDashboardFileReader(cfg, logger, nil, fakeStore, folderSvc)
			reader.dashboardProvisioningService = fakeService
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
		})
	})
}

type FakeFileInfo struct {
	isDirectory bool
	name        string
}

func (ffi *FakeFileInfo) IsDir() bool {
	return ffi.isDirectory
}

func (ffi FakeFileInfo) Size() int64 {
	return 1
}

func (ffi FakeFileInfo) Mode() os.FileMode {
	return 0777
}

func (ffi FakeFileInfo) Name() string {
	return ffi.name
}

func (ffi FakeFileInfo) ModTime() time.Time {
	return time.Time{}
}

func (ffi FakeFileInfo) Sys() any {
	return nil
}

type fakeDashboardStore struct{}

func (fds *fakeDashboardStore) GetDashboard(_ context.Context, _ *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	return nil, dashboards.ErrDashboardNotFound
}
