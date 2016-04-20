package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingDataAccess(t *testing.T) {

	Convey("Testing Alerting data access", t, func() {
		InitTestDB(t)

		Convey("Can create alert", func() {
			items := []m.Alert{
				{
					PanelId:     1,
					DashboardId: 1,
					Query:       "Query",
					QueryRefId:  "A",
					WarnLevel:   30,
					ErrorLevel:  50,
					Interval:    10,
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
			So(err, ShouldBeNil)
		})
	})
}
