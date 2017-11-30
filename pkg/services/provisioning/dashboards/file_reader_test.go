package dashboards

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"os"
	"testing"
	"time"

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
		bus.AddHandler("test", mockValidateDashboardAlertsCommand)
		bus.AddHandler("test", mockSaveDashboardCommand)
		bus.AddHandler("test", mockUpdateDashboardAlertsCommand)
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

			reader, err := NewDashboardFilereader(cfg, logger)
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

			reader, err := NewDashboardFilereader(cfg, logger)
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

			reader, err := NewDashboardFilereader(cfg, logger)
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

			_, err := NewDashboardFilereader(cfg, logger)
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

			_, err := NewDashboardFilereader(cfg, logger)
			So(err, ShouldBeNil)
		})
	})
}

type fakeDashboardRepo struct {
	inserted     []*models.SaveDashboardCommand
	getDashboard []*models.Dashboard
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

func mockValidateDashboardAlertsCommand(cmd *alerting.ValidateDashboardAlertsCommand) error {
	return nil
}

func mockSaveDashboardCommand(cmd *models.SaveDashboardCommand) error {
	fakeRepo.inserted = append(fakeRepo.inserted, cmd)
	return nil
}

func mockUpdateDashboardAlertsCommand(cmd *alerting.UpdateDashboardAlertsCommand) error {
	return nil
}
