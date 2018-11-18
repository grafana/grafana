package dashboards

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"

	"github.com/grafana/grafana/pkg/log"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	defaultDashboards = "testdata/test-dashboards/folder-one"
	brokenDashboards  = "testdata/test-dashboards/broken-dashboards"
	oneDashboard      = "testdata/test-dashboards/one-dashboard"
	containingId      = "testdata/test-dashboards/containing-id"

	fakeService *fakeDashboardProvisioningService
)

func TestCreatingNewDashboardFileReader(t *testing.T) {
	Convey("creating new dashboard file reader", t, func() {
		cfg := &DashboardsAsConfig{
			Name:    "Default",
			Type:    "file",
			OrgId:   1,
			Folder:  "",
			Options: map[string]interface{}{},
		}

		Convey("using path parameter", func() {
			cfg.Options["path"] = defaultDashboards
			reader, err := NewDashboardFileReader(cfg, log.New("test-logger"))
			So(err, ShouldBeNil)
			So(reader.Path, ShouldNotEqual, "")
		})

		Convey("using folder as options", func() {
			cfg.Options["folder"] = defaultDashboards
			reader, err := NewDashboardFileReader(cfg, log.New("test-logger"))
			So(err, ShouldBeNil)
			So(reader.Path, ShouldNotEqual, "")
		})

		Convey("using full path", func() {
			fullPath := "/var/lib/grafana/dashboards"
			if runtime.GOOS == "windows" {
				fullPath = `c:\var\lib\grafana`
			}

			cfg.Options["folder"] = fullPath
			reader, err := NewDashboardFileReader(cfg, log.New("test-logger"))
			So(err, ShouldBeNil)

			So(reader.Path, ShouldEqual, fullPath)
			So(filepath.IsAbs(reader.Path), ShouldBeTrue)
		})

		Convey("using relative path", func() {
			cfg.Options["folder"] = defaultDashboards
			reader, err := NewDashboardFileReader(cfg, log.New("test-logger"))
			So(err, ShouldBeNil)

			resolvedPath := reader.resolvePath(reader.Path)
			So(filepath.IsAbs(resolvedPath), ShouldBeTrue)
		})
	})
}

func TestDashboardFileReader(t *testing.T) {
	Convey("Dashboard file reader", t, func() {
		bus.ClearBusHandlers()
		origNewDashboardProvisioningService := dashboards.NewProvisioningService
		fakeService = mockDashboardProvisioningService()

		bus.AddHandler("test", mockGetDashboardQuery)
		logger := log.New("test.logger")

		Convey("Reading dashboards from disk", func() {

			cfg := &DashboardsAsConfig{
				Name:    "Default",
				Type:    "file",
				OrgId:   1,
				Folder:  "",
				Options: map[string]interface{}{},
			}

			Convey("Can read default dashboard", func() {
				cfg.Options["path"] = defaultDashboards
				cfg.Folder = "Team A"

				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				folders := 0
				dashboards := 0

				for _, i := range fakeService.inserted {
					if i.Dashboard.IsFolder {
						folders++
					} else {
						dashboards++
					}
				}

				So(folders, ShouldEqual, 1)
				So(dashboards, ShouldEqual, 2)
			})

			Convey("Can read default dashboard and replace old version in database", func() {
				cfg.Options["path"] = oneDashboard

				stat, _ := os.Stat(oneDashboard + "/dashboard1.json")

				fakeService.getDashboard = append(fakeService.getDashboard, &models.Dashboard{
					Updated: stat.ModTime().AddDate(0, 0, -1),
					Slug:    "grafana",
				})

				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				So(len(fakeService.inserted), ShouldEqual, 1)
			})

			Convey("Overrides id from dashboard.json files", func() {
				cfg.Options["path"] = containingId

				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				So(len(fakeService.inserted), ShouldEqual, 1)
			})

			Convey("Invalid configuration should return error", func() {
				cfg := &DashboardsAsConfig{
					Name:   "Default",
					Type:   "file",
					OrgId:  1,
					Folder: "",
				}

				_, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldNotBeNil)
			})

			Convey("Broken dashboards should not cause error", func() {
				cfg.Options["path"] = brokenDashboards

				_, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)
			})
		})

		Convey("Should not create new folder if folder name is missing", func() {
			cfg := &DashboardsAsConfig{
				Name:   "Default",
				Type:   "file",
				OrgId:  1,
				Folder: "",
				Options: map[string]interface{}{
					"folder": defaultDashboards,
				},
			}

			_, err := getOrCreateFolderId(cfg, fakeService)
			So(err, ShouldEqual, ErrFolderNameMissing)
		})

		Convey("can get or Create dashboard folder", func() {
			cfg := &DashboardsAsConfig{
				Name:   "Default",
				Type:   "file",
				OrgId:  1,
				Folder: "TEAM A",
				Options: map[string]interface{}{
					"folder": defaultDashboards,
				},
			}

			folderId, err := getOrCreateFolderId(cfg, fakeService)
			So(err, ShouldBeNil)
			inserted := false
			for _, d := range fakeService.inserted {
				if d.Dashboard.IsFolder && d.Dashboard.Id == folderId {
					inserted = true
				}
			}
			So(len(fakeService.inserted), ShouldEqual, 1)
			So(inserted, ShouldBeTrue)
		})

		Convey("Walking the folder with dashboards", func() {
			noFiles := map[string]os.FileInfo{}

			Convey("should skip dirs that starts with .", func() {
				shouldSkip := createWalkFn(noFiles)("path", &FakeFileInfo{isDirectory: true, name: ".folder"}, nil)
				So(shouldSkip, ShouldEqual, filepath.SkipDir)
			})

			Convey("should keep walking if file is not .json", func() {
				shouldSkip := createWalkFn(noFiles)("path", &FakeFileInfo{isDirectory: true, name: "folder"}, nil)
				So(shouldSkip, ShouldBeNil)
			})
		})

		Reset(func() {
			dashboards.NewProvisioningService = origNewDashboardProvisioningService
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
	mock := fakeDashboardProvisioningService{}
	dashboards.NewProvisioningService = func() dashboards.DashboardProvisioningService {
		return &mock
	}
	return &mock
}

type fakeDashboardProvisioningService struct {
	inserted     []*dashboards.SaveDashboardDTO
	provisioned  []*models.DashboardProvisioning
	getDashboard []*models.Dashboard
}

func (s *fakeDashboardProvisioningService) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	return s.provisioned, nil
}

func (s *fakeDashboardProvisioningService) SaveProvisionedDashboard(dto *dashboards.SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	s.inserted = append(s.inserted, dto)
	s.provisioned = append(s.provisioned, provisioning)
	return dto.Dashboard, nil
}

func (s *fakeDashboardProvisioningService) SaveFolderForProvisionedDashboards(dto *dashboards.SaveDashboardDTO) (*models.Dashboard, error) {
	s.inserted = append(s.inserted, dto)
	return dto.Dashboard, nil
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
