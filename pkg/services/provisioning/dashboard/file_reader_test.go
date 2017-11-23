package dashboard

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"testing"

	"github.com/grafana/grafana/pkg/log"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	defaultDashboards string = "./test-dashboards/folder-one"
	brokenDashboards  string = "./test-dashboards/broken-dashboards"
)

func TestDashboardFileReader(t *testing.T) {
	Convey("Reading dashboards from disk", t, func() {
		bus.ClearBusHandlers()

		bus.AddHandler("test", mockGetDashboardQuery)
		bus.AddHandler("test", mockValidateDashboardAlertsCommand)
		bus.AddHandler("test", mockSaveDashboardCommand)
		bus.AddHandler("test", mockUpdateDashboardAlertsCommand)
		logger := log.New("test.logger")

		Convey("Can read default dashboard", func() {
			cfg := &DashboardsAsConfig{
				Name:   "Default",
				Type:   "file",
				OrgId:  1,
				Folder: "",
				Options: map[string]interface{}{
					"folder": defaultDashboards,
				},
			}
			reader, err := NewDashboardFilereader(cfg, logger)
			So(err, ShouldBeNil)

			err = reader.walkFolder()
			So(err, ShouldBeNil)
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

func mockGetDashboardQuery(cmd *models.GetDashboardQuery) error {
	return models.ErrDashboardNotFound
}

func mockValidateDashboardAlertsCommand(cmd *alerting.ValidateDashboardAlertsCommand) error {
	return nil
}

func mockSaveDashboardCommand(cmd *models.SaveDashboardCommand) error {
	return nil
}

func mockUpdateDashboardAlertsCommand(cmd *alerting.UpdateDashboardAlertsCommand) error {
	return nil
}
