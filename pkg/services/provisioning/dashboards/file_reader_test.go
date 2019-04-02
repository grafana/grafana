package dashboards

import (
	"github.com/stretchr/testify/mock"
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
	unprovision       = "testdata/test-dashboards/unprovision"

	fakeService *dashboards.FakeDashboardProvisioningService
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

				bus.AddHandler("test", func(cmd *models.GetDashboardQuery) error {
					return models.ErrDashboardNotFound
				})

				fakeService.
					On(
						"SaveFolderForProvisionedDashboards",
						mock.MatchedBy(func(dash *dashboards.SaveDashboardDTO) bool {
							return dash.Dashboard.Title == "Team A"
						}),
					).
					Return(&models.Dashboard{Id: 1}, nil)

				fakeService.
					On("GetProvisionedDashboardData", "Default").
					Return([]*models.DashboardProvisioning{}, nil)

				fakeService.
					On("SaveProvisionedDashboard", mock.Anything, mock.Anything).
					Return(&models.Dashboard{}, nil).
					Times(2)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				dash := &dashboards.SaveDashboardDTO{}
				dash.Dashboard = models.NewDashboardFolder(cfg.Folder)
				dash.Dashboard.IsFolder = true
				dash.Overwrite = true
				dash.OrgId = cfg.OrgId

				fakeService.AssertExpectations(t)
			})

			// There was an issue with former test that it did not mock GetProvisionedDashboardData, which
			// is the function that actually returns existing provisioned dashboards so it inserted a dashboard
			// but not due to update but as a new dashboard
			Convey("Can read default dashboard and replace old version in database", func() {
				cfg.Options["path"] = oneDashboard

				dashboardPath := oneDashboard + "/dashboard1.json"
				stat, _ := os.Stat(dashboardPath)

				absPath, err := filepath.Abs(dashboardPath)
				So(err, ShouldBeNil)

				// Fake older data in the DB
				fakeService.
					On("GetProvisionedDashboardData", "Default").
					Return(
						[]*models.DashboardProvisioning{
							{
								Id:          1,
								DashboardId: 1,
								Updated:     stat.ModTime().AddDate(0, 0, -1).Unix(),
								ExternalId:  absPath,
								CheckSum:    "",
								Name:        "Default",
							},
						},
						nil,
					)

				// And that dashboard is updated due to date difference
				fakeService.
					On("SaveProvisionedDashboard", mock.Anything, mock.Anything).
					Return(&models.Dashboard{}, nil)

				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				fakeService.AssertExpectations(t)
			})

			// Not sure what this should do, looking at the code we do not actually save the dashboard under the ID
			// set in the json file, we strip it or use the one from dashboard_provisioning
			//Convey("Overrides id from dashboard.json files", func() {
			//	cfg.Options["path"] = containingId
			//
			//	reader, err := NewDashboardFileReader(cfg, logger)
			//	So(err, ShouldBeNil)
			//
			//	err = reader.startWalkingDisk()
			//	So(err, ShouldBeNil)
			//
			//	So(len(fakeService.inserted), ShouldEqual, 1)
			//})

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

			Convey("Two dashboard providers should be able to provisioned the same dashboard without uid", func() {
				cfg1 := &DashboardsAsConfig{Name: "1", Type: "file", OrgId: 1, Folder: "f1", Options: map[string]interface{}{"path": containingId}}
				cfg2 := &DashboardsAsConfig{Name: "2", Type: "file", OrgId: 1, Folder: "f2", Options: map[string]interface{}{"path": containingId}}

				bus.AddHandler("test", func(cmd *models.GetDashboardQuery) error {
					return models.ErrDashboardNotFound
				})

				fakeService.
					On("SaveFolderForProvisionedDashboards", mock.Anything).
					Return(&models.Dashboard{Id: 1}, nil).
					Times(2)

				fakeService.
					On("GetProvisionedDashboardData", "1").
					Return([]*models.DashboardProvisioning{}, nil)

				fakeService.
					On("GetProvisionedDashboardData", "2").
					Return([]*models.DashboardProvisioning{}, nil)

				fakeService.
					On("SaveProvisionedDashboard", mock.Anything, mock.Anything).
					// No need to return anything as it is ignored in the code
					Return(&models.Dashboard{}, nil).
					Times(2)

				reader1, err := NewDashboardFileReader(cfg1, logger)
				So(err, ShouldBeNil)

				err = reader1.startWalkingDisk()
				So(err, ShouldBeNil)

				reader2, err := NewDashboardFileReader(cfg2, logger)
				So(err, ShouldBeNil)

				err = reader2.startWalkingDisk()
				So(err, ShouldBeNil)

				fakeService.AssertExpectations(t)
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

			bus.AddHandler("test", func(cmd *models.GetDashboardQuery) error {
				return models.ErrDashboardNotFound
			})

			fakeService.
				On(
					"SaveFolderForProvisionedDashboards",
					mock.MatchedBy(func(dash *dashboards.SaveDashboardDTO) bool {
						return dash.Dashboard.IsFolder && dash.Dashboard.Title == "TEAM A"
					}),
				).
				Return(&models.Dashboard{Id: 1}, nil)

			_, err := getOrCreateFolderId(cfg, fakeService)
			So(err, ShouldBeNil)
			fakeService.AssertExpectations(t)
		})

		Convey("Walking the folder with dashboards", func() {
			noFiles := map[string]os.FileInfo{}

			Convey("should skip dirs that starts with .", func() {
				shouldSkip := createWalkFn(noFiles, nil)("path", &FakeFileInfo{isDirectory: true, name: ".folder"}, nil)
				So(shouldSkip, ShouldEqual, filepath.SkipDir)
			})

			Convey("should keep walking if file is not .json", func() {
				shouldSkip := createWalkFn(noFiles, nil)("path", &FakeFileInfo{isDirectory: true, name: "folder"}, nil)
				So(shouldSkip, ShouldBeNil)
			})
		})

		Convey("Should unprovision missing dashboard if preventDelete = true", func() {
			cfg := &DashboardsAsConfig{
				Name:  "Default",
				Type:  "file",
				OrgId: 1,
				Options: map[string]interface{}{
					"folder": unprovision,
				},
				DisableDeletion: true,
			}

			reader, err := NewDashboardFileReader(cfg, logger)
			So(err, ShouldBeNil)

			externalId1, err := filepath.Abs(unprovision + "/dashboard1.json")
			So(err, ShouldBeNil)
			externalId2, err := filepath.Abs(unprovision + "/dashboard2.json")
			So(err, ShouldBeNil)

			fakeService.
				On("GetProvisionedDashboardData", "Default").
				Return([]*models.DashboardProvisioning{
					{
						Id:          1,
						DashboardId: 1,
						ExternalId:  externalId1,
					},
					{
						Id:          2,
						DashboardId: 2,
						ExternalId:  externalId2,
					},
				}, nil)

			fakeService.
				On("SaveProvisionedDashboard", mock.Anything, mock.Anything).
				Return(&models.Dashboard{}, nil)

			fakeService.
				On("UnprovisionDashboard", int64(2)).
				Return(nil)

			err = reader.startWalkingDisk()
			So(err, ShouldBeNil)

			fakeService.AssertExpectations(t)
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

func mockDashboardProvisioningService() *dashboards.FakeDashboardProvisioningService {
	fake := &dashboards.FakeDashboardProvisioningService{}
	dashboards.NewProvisioningService = func() dashboards.DashboardProvisioningService {
		return fake
	}
	return fake
}
