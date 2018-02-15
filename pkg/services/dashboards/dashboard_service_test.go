package dashboards

import (
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/alerting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardService(t *testing.T) {
	Convey("Dashboard service tests", t, func() {
		service := DashboardService{}

		Convey("Save dashboard validation", func() {
			dto := &SaveDashboardDTO{}

			Convey("When saving a dashboard with empty title it should return error", func() {
				titles := []string{"", " ", "   \t   "}

				for _, title := range titles {
					dto.Dashboard = models.NewDashboard(title)
					_, err := service.SaveDashboard(dto)
					So(err, ShouldEqual, models.ErrDashboardTitleEmpty)
				}
			})

			Convey("Should return validation error if it's a folder and have a folder id", func() {
				dto.Dashboard = models.NewDashboardFolder("Folder")
				dto.Dashboard.FolderId = 1
				_, err := service.SaveDashboard(dto)
				So(err, ShouldEqual, models.ErrDashboardFolderCannotHaveParent)
			})

			Convey("Should return validation error if folder is named General", func() {
				dto.Dashboard = models.NewDashboardFolder("General")
				_, err := service.SaveDashboard(dto)
				So(err, ShouldEqual, models.ErrDashboardFolderNameExists)
			})

			Convey("When saving a dashboard should validate uid", func() {
				bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
					return nil
				})

				bus.AddHandler("test", func(cmd *models.ValidateDashboardBeforeSaveCommand) error {
					return nil
				})

				permissionScenario("Given user has permission to save", true, func(sc *dashboardPermissionScenarioContext) {
					testCases := []struct {
						Uid   string
						Error error
					}{
						{Uid: "", Error: nil},
						{Uid: "   ", Error: nil},
						{Uid: "  \t  ", Error: nil},
						{Uid: "asdf90_-", Error: nil},
						{Uid: "asdf/90", Error: models.ErrDashboardInvalidUid},
						{Uid: "   asdfghjklqwertyuiopzxcvbnmasdfghjklqwer   ", Error: nil},
						{Uid: "asdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnm", Error: models.ErrDashboardUidToLong},
					}

					for _, tc := range testCases {
						dto.Dashboard = models.NewDashboard("title")
						dto.Dashboard.SetUid(tc.Uid)
						dto.User = &models.SignedInUser{}

						_, err := service.buildSaveDashboardCommand(dto)
						So(err, ShouldEqual, tc.Error)
					}
				})
			})

			Convey("Should return validation error if alert data is invalid", func() {
				bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
					return errors.New("error")
				})

				dto.Dashboard = models.NewDashboard("Dash")
				_, err := service.SaveDashboard(dto)
				So(err, ShouldEqual, models.ErrDashboardContainsInvalidAlertData)
			})
		})
	})
}
