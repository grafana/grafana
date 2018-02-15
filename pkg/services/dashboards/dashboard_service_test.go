package dashboards

import (
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/alerting"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardService(t *testing.T) {
	Convey("Dashboard service tests", t, func() {
		service := NewDashboardService()

		Convey("Save dashboard validation", func() {
			dto := &SaveDashboardDTO{}

			Convey("When saving a dashboard with empty title it should return error", func() {
				titles := []string{"", " ", "   \t   "}

				for _, title := range titles {
					dto.Dashboard = m.NewDashboard(title)
					_, err := service.SaveDashboard(dto)
					So(err, ShouldEqual, m.ErrDashboardTitleEmpty)
				}
			})

			Convey("Should return validation error if it's a folder and have a folder id", func() {
				dto.Dashboard = m.NewDashboardFolder("Folder")
				dto.Dashboard.FolderId = 1
				_, err := service.SaveDashboard(dto)
				So(err, ShouldEqual, m.ErrDashboardFolderCannotHaveParent)
			})

			Convey("Should return validation error if folder is named General", func() {
				dto.Dashboard = m.NewDashboardFolder("General")
				_, err := service.SaveDashboard(dto)
				So(err, ShouldEqual, m.ErrDashboardFolderNameExists)
			})

			Convey("Should return validation error if alert data is invalid", func() {
				bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
					return errors.New("error")
				})

				dto.Dashboard = m.NewDashboard("Dash")
				_, err := service.SaveDashboard(dto)
				So(err, ShouldEqual, m.ErrDashboardContainsInvalidAlertData)
			})
		})
	})
}
