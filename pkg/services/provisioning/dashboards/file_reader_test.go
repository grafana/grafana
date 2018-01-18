package dashboards

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"

	"github.com/grafana/grafana/pkg/log"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	defaultDashboards string = "./test-dashboards/folder-one"
	brokenDashboards  string = "./test-dashboards/broken-dashboards"
	oneDashboard      string = "./test-dashboards/one-dashboard"

	fakeRepo *fakeDashboardRepo
)

func TestDashboardFileReader(t *testing.T) {
	Convey("Dashboard file reader", t, func() {
		bus.ClearBusHandlers()
		fakeRepo = &fakeDashboardRepo{}

		bus.AddHandler("test", mockGetDashboardQuery)
		dashboards.SetRepository(fakeRepo)
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

				for _, i := range fakeRepo.inserted {
					if i.Dashboard.IsFolder {
						folders++
					} else {
						dashboards++
					}
				}

				So(dashboards, ShouldEqual, 2)
				So(folders, ShouldEqual, 1)
			})

			Convey("Should not update dashboards when db is newer", func() {
				cfg.Options["path"] = oneDashboard

				fakeRepo.getDashboard = append(fakeRepo.getDashboard, &models.Dashboard{
					Updated: time.Now().Add(time.Hour),
					Slug:    "grafana",
				})

				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				So(len(fakeRepo.inserted), ShouldEqual, 0)
			})

			Convey("Can read default dashboard and replace old version in database", func() {
				cfg.Options["path"] = oneDashboard

				stat, _ := os.Stat(oneDashboard + "/dashboard1.json")

				fakeRepo.getDashboard = append(fakeRepo.getDashboard, &models.Dashboard{
					Updated: stat.ModTime().AddDate(0, 0, -1),
					Slug:    "grafana",
				})

				reader, err := NewDashboardFileReader(cfg, logger)
				So(err, ShouldBeNil)

				err = reader.startWalkingDisk()
				So(err, ShouldBeNil)

				So(len(fakeRepo.inserted), ShouldEqual, 1)
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

			_, err := getOrCreateFolderId(cfg, fakeRepo)
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

			folderId, err := getOrCreateFolderId(cfg, fakeRepo)
			So(err, ShouldBeNil)
			inserted := false
			for _, d := range fakeRepo.inserted {
				if d.Dashboard.IsFolder && d.Dashboard.Id == folderId {
					inserted = true
				}
			}
			So(len(fakeRepo.inserted), ShouldEqual, 1)
			So(inserted, ShouldBeTrue)
		})

		Convey("Walking the folder with dashboards", func() {
			cfg := &DashboardsAsConfig{
				Name:   "Default",
				Type:   "file",
				OrgId:  1,
				Folder: "",
				Options: map[string]interface{}{
					"path": defaultDashboards,
				},
			}

			reader, err := NewDashboardFileReader(cfg, log.New("test-logger"))
			So(err, ShouldBeNil)

			Convey("should skip dirs that starts with .", func() {
				shouldSkip := reader.createWalk(reader, 0)("path", &FakeFileInfo{isDirectory: true, name: ".folder"}, nil)
				So(shouldSkip, ShouldEqual, filepath.SkipDir)
			})

			Convey("should keep walking if file is not .json", func() {
				shouldSkip := reader.createWalk(reader, 0)("path", &FakeFileInfo{isDirectory: true, name: "folder"}, nil)
				So(shouldSkip, ShouldBeNil)
			})
		})

		Convey("Can use bpth path and folder as dashboard path", func() {
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
				So(reader.Path, ShouldEqual, defaultDashboards)
			})

			Convey("using folder as options", func() {
				cfg.Options["folder"] = defaultDashboards
				reader, err := NewDashboardFileReader(cfg, log.New("test-logger"))
				So(err, ShouldBeNil)
				So(reader.Path, ShouldEqual, defaultDashboards)
			})
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

type fakeDashboardRepo struct {
	inserted     []*dashboards.SaveDashboardItem
	getDashboard []*models.Dashboard
}

func (repo *fakeDashboardRepo) SaveDashboard(json *dashboards.SaveDashboardItem) (*models.Dashboard, error) {
	repo.inserted = append(repo.inserted, json)
	return json.Dashboard, nil
}

func mockGetDashboardQuery(cmd *models.GetDashboardQuery) error {
	for _, d := range fakeRepo.getDashboard {
		if d.Slug == cmd.Slug {
			cmd.Result = d
			return nil
		}
	}

	return models.ErrDashboardNotFound
}
