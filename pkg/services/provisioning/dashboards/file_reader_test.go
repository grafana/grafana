package dashboards

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	dboards "github.com/grafana/grafana/pkg/dashboards"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/stretchr/testify/require"
)

const (
	defaultDashboards         = "testdata/test-dashboards/folder-one"
	brokenDashboards          = "testdata/test-dashboards/broken-dashboards"
	oneDashboard              = "testdata/test-dashboards/one-dashboard"
	containingID              = "testdata/test-dashboards/containing-id"
	unprovision               = "testdata/test-dashboards/unprovision"
	foldersFromFilesStructure = "testdata/test-dashboards/folders-from-files-structure"
)

var fakeService *fakeDashboardProvisioningService

func TestCreatingNewDashboardFileReader(t *testing.T) {
	setup := func() *config {
		return &config{
			Name:    "Default",
			Type:    "file",
			OrgID:   1,
			Folder:  "",
			Options: map[string]interface{}{},
		}
	}

	t.Run("using path parameter", func(t *testing.T) {
		cfg := setup()
		cfg.Options["path"] = defaultDashboards
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil)
		require.NoError(t, err)
		require.NotEqual(t, reader.Path, "")
	})

	t.Run("using folder as options", func(t *testing.T) {
		cfg := setup()
		cfg.Options["folder"] = defaultDashboards
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil)
		require.NoError(t, err)
		require.NotEqual(t, reader.Path, "")
	})

	t.Run("using foldersFromFilesStructure as options", func(t *testing.T) {
		cfg := setup()
		cfg.Options["path"] = foldersFromFilesStructure
		cfg.Options["foldersFromFilesStructure"] = true
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil)
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
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil)
		require.NoError(t, err)

		require.Equal(t, reader.Path, fullPath)
		require.True(t, filepath.IsAbs(reader.Path))
	})

	t.Run("using relative path", func(t *testing.T) {
		cfg := setup()
		cfg.Options["folder"] = defaultDashboards
		reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil)
		require.NoError(t, err)

		resolvedPath := reader.resolvedPath()
		require.True(t, filepath.IsAbs(resolvedPath))
	})
}

func TestDashboardFileReader(t *testing.T) {
	logger := log.New("test.logger")
	cfg := &config{}

	origNewDashboardProvisioningService := dashboards.NewProvisioningService
	defer func() {
		dashboards.NewProvisioningService = origNewDashboardProvisioningService
	}()

	setup := func() {
		bus.ClearBusHandlers()
		fakeService = mockDashboardProvisioningService()
		bus.AddHandler("test", mockGetDashboardQuery)
		cfg = &config{
			Name:    "Default",
			Type:    "file",
			OrgID:   1,
			Folder:  "",
			Options: map[string]interface{}{},
		}
	}

	t.Run("Reading dashboards from disk", func(t *testing.T) {
		t.Run("Can read default dashboard", func(t *testing.T) {
			setup()
			cfg.Options["path"] = defaultDashboards
			cfg.Folder = "Team A"

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)

			folders := 0
			dashboards := 0

			for _, i := range fakeService.inserted {
				if i.Dashboard.IsFolder {
					folders++
				} else {
					dashboards++
				}
			}

			require.Equal(t, folders, 1)
			require.Equal(t, dashboards, 2)
		})

		t.Run("Can read default dashboard and replace old version in database", func(t *testing.T) {
			setup()
			cfg.Options["path"] = oneDashboard

			stat, _ := os.Stat(oneDashboard + "/dashboard1.json")

			fakeService.getDashboard = append(fakeService.getDashboard, &models.Dashboard{
				Updated: stat.ModTime().AddDate(0, 0, -1),
				Slug:    "grafana",
			})

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)

			require.Equal(t, len(fakeService.inserted), 1)
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

			fakeService.provisioned = map[string][]*models.DashboardProvisioning{
				"Default": {
					{
						Name:       "Default",
						ExternalId: absPath,
						Updated:    stat.ModTime().AddDate(0, 0, +1).Unix(),
						CheckSum:   checksum,
					},
				},
			}

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
			require.Equal(t, len(fakeService.inserted), 0)
		})

		t.Run("Dashboard with older timestamp and different checksum will replace imported dashboard", func(t *testing.T) {
			setup()
			cfg.Options["path"] = oneDashboard
			absPath, err := filepath.Abs(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)
			stat, err := os.Stat(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)

			fakeService.provisioned = map[string][]*models.DashboardProvisioning{
				"Default": {
					{
						Name:       "Default",
						ExternalId: absPath,
						Updated:    stat.ModTime().AddDate(0, 0, +1).Unix(),
						CheckSum:   "fakechecksum",
					},
				},
			}

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
			require.Equal(t, len(fakeService.inserted), 1)
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

			fakeService.provisioned = map[string][]*models.DashboardProvisioning{
				"Default": {
					{
						Name:       "Default",
						ExternalId: absPath,
						Updated:    stat.ModTime().AddDate(0, 0, -1).Unix(),
						CheckSum:   checksum,
					},
				},
			}

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
			require.Equal(t, len(fakeService.inserted), 0)
		})

		t.Run("Dashboard with newer timestamp and different checksum should replace imported dashboard", func(t *testing.T) {
			setup()
			cfg.Options["path"] = oneDashboard
			absPath, err := filepath.Abs(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)
			stat, err := os.Stat(oneDashboard + "/dashboard1.json")
			require.NoError(t, err)

			fakeService.provisioned = map[string][]*models.DashboardProvisioning{
				"Default": {
					{
						Name:       "Default",
						ExternalId: absPath,
						Updated:    stat.ModTime().AddDate(0, 0, -1).Unix(),
						CheckSum:   "fakechecksum",
					},
				},
			}

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)
			require.Equal(t, len(fakeService.inserted), 1)
		})

		t.Run("Overrides id from dashboard.json files", func(t *testing.T) {
			setup()
			cfg.Options["path"] = containingID

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)

			require.Equal(t, len(fakeService.inserted), 1)
		})

		t.Run("Get folder from files structure", func(t *testing.T) {
			setup()
			cfg.Options["path"] = foldersFromFilesStructure
			cfg.Options["foldersFromFilesStructure"] = true

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)

			require.Equal(t, len(fakeService.inserted), 5)

			foldersCount := 0
			for _, d := range fakeService.inserted {
				if d.Dashboard.IsFolder {
					foldersCount++
				}
			}
			require.Equal(t, foldersCount, 2)

			foldersAndDashboards := make(map[string]struct{}, 5)
			for _, d := range fakeService.inserted {
				title := d.Dashboard.Title
				if _, ok := foldersAndDashboards[title]; ok {
					require.Nil(t, fmt.Errorf("dashboard title %q already exists", title))
				}

				switch title {
				case "folderOne", "folderTwo":
					require.True(t, d.Dashboard.IsFolder)
				case "Grafana1", "Grafana2", "RootDashboard":
					require.False(t, d.Dashboard.IsFolder)
				default:
					require.Nil(t, fmt.Errorf("unknown dashboard title %q", title))
				}

				foldersAndDashboards[title] = struct{}{}
			}
		})

		t.Run("Invalid configuration should return error", func(t *testing.T) {
			setup()
			cfg := &config{
				Name:   "Default",
				Type:   "file",
				OrgID:  1,
				Folder: "",
			}

			_, err := NewDashboardFileReader(cfg, logger, nil)
			require.NotNil(t, err)
		})

		t.Run("Broken dashboards should not cause error", func(t *testing.T) {
			setup()
			cfg.Options["path"] = brokenDashboards

			_, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)
		})

		t.Run("Two dashboard providers should be able to provisioned the same dashboard without uid", func(t *testing.T) {
			setup()
			cfg1 := &config{Name: "1", Type: "file", OrgID: 1, Folder: "f1", Options: map[string]interface{}{"path": containingID}}
			cfg2 := &config{Name: "2", Type: "file", OrgID: 1, Folder: "f2", Options: map[string]interface{}{"path": containingID}}

			reader1, err := NewDashboardFileReader(cfg1, logger, nil)
			require.NoError(t, err)

			err = reader1.walkDisk(context.Background())
			require.NoError(t, err)

			reader2, err := NewDashboardFileReader(cfg2, logger, nil)
			require.NoError(t, err)

			err = reader2.walkDisk(context.Background())
			require.NoError(t, err)

			var folderCount int
			var dashCount int
			for _, o := range fakeService.inserted {
				if o.Dashboard.IsFolder {
					folderCount++
				} else {
					dashCount++
				}
			}

			require.Equal(t, folderCount, 2)
			require.Equal(t, dashCount, 2)
		})
	})

	t.Run("Should not create new folder if folder name is missing", func(t *testing.T) {
		setup()
		cfg := &config{
			Name:   "Default",
			Type:   "file",
			OrgID:  1,
			Folder: "",
			Options: map[string]interface{}{
				"folder": defaultDashboards,
			},
		}

		_, err := getOrCreateFolderID(context.Background(), cfg, fakeService, cfg.Folder)
		require.Equal(t, err, ErrFolderNameMissing)
	})

	t.Run("can get or Create dashboard folder", func(t *testing.T) {
		setup()
		cfg := &config{
			Name:   "Default",
			Type:   "file",
			OrgID:  1,
			Folder: "TEAM A",
			Options: map[string]interface{}{
				"folder": defaultDashboards,
			},
		}

		folderID, err := getOrCreateFolderID(context.Background(), cfg, fakeService, cfg.Folder)
		require.NoError(t, err)
		inserted := false
		for _, d := range fakeService.inserted {
			if d.Dashboard.IsFolder && d.Dashboard.Id == folderID {
				inserted = true
			}
		}
		require.Equal(t, len(fakeService.inserted), 1)
		require.True(t, inserted)
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

	t.Run("Given missing dashboard file", func(t *testing.T) {
		absPath1, err := filepath.Abs(unprovision + "/dashboard1.json")
		require.NoError(t, err)
		// This one does not exist on disk, simulating a deleted file
		absPath2, err := filepath.Abs(unprovision + "/dashboard2.json")
		require.NoError(t, err)

		setupFakeService := func() {
			setup()
			cfg = &config{
				Name:  "Default",
				Type:  "file",
				OrgID: 1,
				Options: map[string]interface{}{
					"folder": unprovision,
				},
			}

			fakeService.inserted = []*dashboards.SaveDashboardDTO{
				{Dashboard: &models.Dashboard{Id: 1}},
				{Dashboard: &models.Dashboard{Id: 2}},
			}

			fakeService.provisioned = map[string][]*models.DashboardProvisioning{
				"Default": {
					{DashboardId: 1, Name: "Default", ExternalId: absPath1},
					{DashboardId: 2, Name: "Default", ExternalId: absPath2},
				},
			}
		}

		t.Run("Missing dashboard should be unprovisioned if DisableDeletion = true", func(t *testing.T) {
			setupFakeService()
			cfg.DisableDeletion = true

			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)

			require.Equal(t, len(fakeService.provisioned["Default"]), 1)
			require.Equal(t, fakeService.provisioned["Default"][0].ExternalId, absPath1)
		})

		t.Run("Missing dashboard should be deleted if DisableDeletion = false", func(t *testing.T) {
			setupFakeService()
			reader, err := NewDashboardFileReader(cfg, logger, nil)
			require.NoError(t, err)

			err = reader.walkDisk(context.Background())
			require.NoError(t, err)

			require.Equal(t, len(fakeService.provisioned["Default"]), 1)
			require.Equal(t, fakeService.provisioned["Default"][0].ExternalId, absPath1)
			require.Equal(t, len(fakeService.inserted), 1)
			require.Equal(t, fakeService.inserted[0].Dashboard.Id, int64(1))
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

func (ffi FakeFileInfo) Sys() interface{} {
	return nil
}

func mockDashboardProvisioningService() *fakeDashboardProvisioningService {
	mock := fakeDashboardProvisioningService{
		provisioned: map[string][]*models.DashboardProvisioning{},
	}
	dashboards.NewProvisioningService = func(dboards.Store) dashboards.DashboardProvisioningService {
		return &mock
	}
	return &mock
}

type fakeDashboardProvisioningService struct {
	dashboards.DashboardProvisioningService

	inserted     []*dashboards.SaveDashboardDTO
	provisioned  map[string][]*models.DashboardProvisioning
	getDashboard []*models.Dashboard
}

func (s *fakeDashboardProvisioningService) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	if _, ok := s.provisioned[name]; !ok {
		s.provisioned[name] = []*models.DashboardProvisioning{}
	}

	return s.provisioned[name], nil
}

func (s *fakeDashboardProvisioningService) SaveProvisionedDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	// Copy the structs as we need to change them but do not want to alter outside world.
	var copyProvisioning = &models.DashboardProvisioning{}
	*copyProvisioning = *provisioning

	var copyDto = &dashboards.SaveDashboardDTO{}
	*copyDto = *dto

	if copyDto.Dashboard.Id == 0 {
		copyDto.Dashboard.Id = rand.Int63n(1000000)
	} else {
		err := s.DeleteProvisionedDashboard(context.Background(), dto.Dashboard.Id, dto.Dashboard.OrgId)
		// Lets delete existing so we do not have duplicates
		if err != nil {
			return nil, err
		}
	}

	s.inserted = append(s.inserted, dto)

	if _, ok := s.provisioned[provisioning.Name]; !ok {
		s.provisioned[provisioning.Name] = []*models.DashboardProvisioning{}
	}

	for _, val := range s.provisioned[provisioning.Name] {
		if val.DashboardId == dto.Dashboard.Id && val.Name == provisioning.Name {
			// Do not insert duplicates
			return dto.Dashboard, nil
		}
	}

	copyProvisioning.DashboardId = copyDto.Dashboard.Id

	s.provisioned[provisioning.Name] = append(s.provisioned[provisioning.Name], copyProvisioning)
	return dto.Dashboard, nil
}

func (s *fakeDashboardProvisioningService) SaveFolderForProvisionedDashboards(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*models.Dashboard, error) {
	s.inserted = append(s.inserted, dto)
	return dto.Dashboard, nil
}

func (s *fakeDashboardProvisioningService) UnprovisionDashboard(dashboardID int64) error {
	for key, val := range s.provisioned {
		for index, dashboard := range val {
			if dashboard.DashboardId == dashboardID {
				s.provisioned[key] = append(s.provisioned[key][:index], s.provisioned[key][index+1:]...)
			}
		}
	}
	return nil
}

func (s *fakeDashboardProvisioningService) DeleteProvisionedDashboard(ctx context.Context, dashboardID int64, orgID int64) error {
	err := s.UnprovisionDashboard(dashboardID)
	if err != nil {
		return err
	}

	for index, val := range s.inserted {
		if val.Dashboard.Id == dashboardID {
			s.inserted = append(s.inserted[:index], s.inserted[util.MinInt(index+1, len(s.inserted)):]...)
		}
	}
	return nil
}

func (s *fakeDashboardProvisioningService) GetProvisionedDashboardDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error) {
	return nil, nil
}

func mockGetDashboardQuery(cmd *models.GetDashboardQuery) error {
	for _, d := range fakeService.getDashboard {
		if d.Slug == cmd.Slug {
			cmd.Result = d
			return nil
		}
	}

	return models.ErrDashboardNotFound
}
