package dashboards

import (
	"os"
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
	Convey("Reading dashboards from disk", t, func() {
		bus.ClearBusHandlers()
		fakeRepo = &fakeDashboardRepo{}

		bus.AddHandler("test", mockGetDashboardQuery)
		dashboards.SetRepository(fakeRepo)
		logger := log.New("test.logger")

		cfg := &DashboardsAsConfig{
			Name:    "Default",
			Type:    "file",
			OrgId:   1,
			Folder:  "",
			Options: map[string]interface{}{},
		}

		Convey("Can read default dashboard", func() {
			cfg.Options["folder"] = defaultDashboards

			reader, err := NewDashboardFileReader(cfg, logger)
			So(err, ShouldBeNil)

			err = reader.walkFolder()
			So(err, ShouldBeNil)

			So(len(fakeRepo.inserted), ShouldEqual, 2)
		})

		Convey("Should not update dashboards when db is newer", func() {
			cfg.Options["folder"] = oneDashboard

			fakeRepo.getDashboard = append(fakeRepo.getDashboard, &models.Dashboard{
				Updated: time.Now().Add(time.Hour),
				Slug:    "grafana",
			})

			reader, err := NewDashboardFileReader(cfg, logger)
			So(err, ShouldBeNil)

			err = reader.walkFolder()
			So(err, ShouldBeNil)

			So(len(fakeRepo.inserted), ShouldEqual, 0)
		})

		Convey("Can read default dashboard and replace old version in database", func() {
			cfg.Options["folder"] = oneDashboard

			stat, _ := os.Stat(oneDashboard + "/dashboard1.json")

			fakeRepo.getDashboard = append(fakeRepo.getDashboard, &models.Dashboard{
				Updated: stat.ModTime().AddDate(0, 0, -1),
				Slug:    "grafana",
			})

			reader, err := NewDashboardFileReader(cfg, logger)
			So(err, ShouldBeNil)

			err = reader.walkFolder()
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
			cfg := &DashboardsAsConfig{
				Name:   "Default",
				Type:   "file",
				OrgId:  1,
				Folder: "",
				Options: map[string]interface{}{
					"folder": brokenDashboards,
				},
			}

			_, err := NewDashboardFileReader(cfg, logger)
			So(err, ShouldBeNil)
		})
	})
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
