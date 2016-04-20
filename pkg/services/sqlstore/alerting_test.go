package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingDataAccess(t *testing.T) {

	Convey("Testing Alerting data access", t, func() {
		InitTestDB(t)

		items := []m.Alert{
			{
				PanelId:     1,
				DashboardId: 1,
				Query:       "Query",
				QueryRefId:  "A",
				WarnLevel:   "> 30",
				CritLevel:   "> 50",
				Interval:    "10",
				Title:       "Alerting title",
				Description: "Alerting description",
				QueryRange:  "5m",
				Aggregator:  "avg",
			},
		}

		cmd := m.SaveAlertsCommand{
			Alerts:      &items,
			DashboardId: 1,
			OrgId:       1,
			UserId:      1,
		}

		err := SaveAlerts(&cmd)

		Convey("Can create alert", func() {
			So(err, ShouldBeNil)
		})

		Convey("can read properties", func() {
			alert, err2 := GetAlertsByDashboard(1, 1)

			So(err2, ShouldBeNil)
			So(alert.Interval, ShouldEqual, "10")
			So(alert.WarnLevel, ShouldEqual, "> 30")
			So(alert.CritLevel, ShouldEqual, "> 50")
			So(alert.Query, ShouldEqual, "Query")
			So(alert.QueryRefId, ShouldEqual, "A")
			So(alert.Title, ShouldEqual, "Alerting title")
			So(alert.Description, ShouldEqual, "Alerting description")
			So(alert.QueryRange, ShouldEqual, "5m")
			So(alert.Aggregator, ShouldEqual, "avg")
		})
	})
}
