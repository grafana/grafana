package dashboards

import (
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"

	"github.com/grafana/grafana/pkg/infra/log"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	defaultDashboards = "testdata/test-dashboards/folder-one"
	brokenDashboards  = "testdata/test-dashboards/broken-dashboards"
	oneDashboard      = "testdata/test-dashboards/one-dashboard"
	containingID      = "testdata/test-dashboards/containing-id"
	unprovision       = "testdata/test-dashboards/unprovision"

	fakeService *fakeDashboardProvisioningService
)

func TestCreatingNewDashboardFileReader(t *testing.T) {
	Convey("creating new dashboard file reader", t, func() {
		cfg := &config{
			Name:    "Default",
			Type:    "file",
			OrgID:   1,
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

			resolvedPath := reader.resolvedPath()
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

			cfg := &config{
				Name:    "Default",
				Type:    "file",
				OrgID:   1,
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
				cfg.Options["path"] = containingID

				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				So(len(fakeService.inserted), ShouldEqual, 1)
			})

			Convey("Invalid configuration should return error", func() {
				cfg := &config{
					Name:   "Default",
					Type:   "file",
					OrgID:  1,
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
				cfg1 := &config{Name: "1", Type: "file", OrgID: 1, Folder: "f1", Options: map[string]interface{}{"path": containingID}}
				cfg2 := &config{Name: "2", Type: "file", OrgID: 1, Folder: "f2", Options: map[string]interface{}{"path": containingID}}

				reader1, err := NewDashboardFileReader(cfg1, logger)
				So(err, ShouldBeNil)

				err = reader1.startWalkingDisk()
				So(err, ShouldBeNil)

				reader2, err := NewDashboardFileReader(cfg2, logger)
				So(err, ShouldBeNil)

				err = reader2.startWalkingDisk()
				So(err, ShouldBeNil)

				var folderCount int
				var dashCount int
				for _, o := range fakeService.inserted {
					if o.Dashboard.IsFolder {
						folderCount++
					} else {
						dashCount++
					}
				}

				So(folderCount, ShouldEqual, 2)
				So(dashCount, ShouldEqual, 2)
			})
		})

		Convey("Should not create new folder if folder name is missing", func() {
			cfg := &config{
				Name:   "Default",
				Type:   "file",
				OrgID:  1,
				Folder: "",
				Options: map[string]interface{}{
					"folder": defaultDashboards,
				},
			}

			_, err := getOrCreateFolderID(cfg, fakeService)
			So(err, ShouldEqual, ErrFolderNameMissing)
		})

		Convey("can get or Create dashboard folder", func() {
			cfg := &config{
				Name:   "Default",
				Type:   "file",
				OrgID:  1,
				Folder: "TEAM A",
				Options: map[string]interface{}{
					"folder": defaultDashboards,
				},
			}

			folderID, err := getOrCreateFolderID(cfg, fakeService)
			So(err, ShouldBeNil)
			inserted := false
			for _, d := range fakeService.inserted {
				if d.Dashboard.IsFolder && d.Dashboard.Id == folderID {
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

		Convey("Given missing dashboard file", func() {
			cfg := &config{
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

			absPath1, err := filepath.Abs(unprovision + "/dashboard1.json")
			So(err, ShouldBeNil)
			// This one does not exist on disc, simulating a deleted file
			absPath2, err := filepath.Abs(unprovision + "/dashboard2.json")
			So(err, ShouldBeNil)

			fakeService.provisioned = map[string][]*models.DashboardProvisioning{
				"Default": {
					{DashboardId: 1, Name: "Default", ExternalId: absPath1},
					{DashboardId: 2, Name: "Default", ExternalId: absPath2},
				},
			}

			Convey("Missing dashboard should be unprovisioned if DisableDeletion = true", func() {
				cfg.DisableDeletion = true

				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				So(len(fakeService.provisioned["Default"]), ShouldEqual, 1)
				So(fakeService.provisioned["Default"][0].ExternalId, ShouldEqual, absPath1)

			})

			Convey("Missing dashboard should be deleted if DisableDeletion = false", func() {
				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				So(len(fakeService.provisioned["Default"]), ShouldEqual, 1)
				So(fakeService.provisioned["Default"][0].ExternalId, ShouldEqual, absPath1)
				So(len(fakeService.inserted), ShouldEqual, 1)
				So(fakeService.inserted[0].Dashboard.Id, ShouldEqual, 1)
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
	mock := fakeDashboardProvisioningService{
		provisioned: map[string][]*models.DashboardProvisioning{},
	}
	dashboards.NewProvisioningService = func() dashboards.DashboardProvisioningService {
		return &mock
	}
	return &mock
}

type fakeDashboardProvisioningService struct {
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

func (s *fakeDashboardProvisioningService) SaveProvisionedDashboard(dto *dashboards.SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	// Copy the structs as we need to change them but do not want to alter outside world.
	var copyProvisioning = &models.DashboardProvisioning{}
	*copyProvisioning = *provisioning

	var copyDto = &dashboards.SaveDashboardDTO{}
	*copyDto = *dto

	if copyDto.Dashboard.Id == 0 {
		copyDto.Dashboard.Id = rand.Int63n(1000000)
	} else {
		err := s.DeleteProvisionedDashboard(dto.Dashboard.Id, dto.Dashboard.OrgId)
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

func (s *fakeDashboardProvisioningService) SaveFolderForProvisionedDashboards(dto *dashboards.SaveDashboardDTO) (*models.Dashboard, error) {
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

func (s *fakeDashboardProvisioningService) DeleteProvisionedDashboard(dashboardID int64, orgID int64) error {
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
