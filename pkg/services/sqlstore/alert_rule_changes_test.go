package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	FakeOrgId int64 = 2
)

func TestAlertRuleChangesDataAccess(t *testing.T) {

	Convey("Testing Alert rule changes data access", t, func() {
		InitTestDB(t)

		testDash := insertTestDashboard("dashboard with alerts", 2, "alert")
		var err error

		Convey("When dashboard is removed", func() {
			items := []m.AlertRule{
				{
					PanelId:     1,
					DashboardId: testDash.Id,
					Query:       "Query",
					QueryRefId:  "A",
					WarnLevel:   "> 30",
					CritLevel:   "> 50",
					Interval:    "10",
					Title:       "Alerting title",
					Description: "Alerting description",
					QueryRange:  "5m",
					Aggregator:  "avg",
					OrgId:       FakeOrgId,
				},
			}

			cmd := m.SaveAlertsCommand{
				Alerts:      &items,
				DashboardId: testDash.Id,
				OrgId:       FakeOrgId,
				UserId:      2,
			}

			SaveAlerts(&cmd)

			query := &m.GetAlertChangesQuery{OrgId: FakeOrgId}
			er := GetAlertRuleChanges(query)
			So(er, ShouldBeNil)
			So(len(query.Result), ShouldEqual, 1)

			err = DeleteDashboard(&m.DeleteDashboardCommand{
				OrgId: FakeOrgId,
				Slug:  testDash.Slug,
			})

			So(err, ShouldBeNil)

			Convey("Alerts should be removed", func() {
				query := m.GetAlertsForDashboardQuery{DashboardId: testDash.Id}
				err2 := GetAlertsByDashboardId(&query)

				So(testDash.Id, ShouldEqual, 1)
				So(err2, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 0)
			})

			Convey("should add one more alert_rule_change", func() {
				query := &m.GetAlertChangesQuery{OrgId: FakeOrgId}
				er := GetAlertRuleChanges(query)
				So(er, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 2)
			})
		})
	})
}
