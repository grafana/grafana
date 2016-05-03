package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingDataAccess(t *testing.T) {

	Convey("Testing Alerting data access", t, func() {
		InitTestDB(t)

		testDash := insertTestDashboard("dashboard with alerts", 1, "alert")

		items := []m.AlertRule{
			{
				PanelId:      1,
				DashboardId:  testDash.Id,
				OrgId:        testDash.OrgId,
				Query:        "Query",
				QueryRefId:   "A",
				WarnLevel:    30,
				CritLevel:    50,
				WarnOperator: ">",
				CritOperator: ">",
				Interval:     "10",
				Title:        "Alerting title",
				Description:  "Alerting description",
				QueryRange:   "5m",
				Aggregator:   "avg",
				State:        "OK",
			},
		}

		cmd := m.SaveAlertsCommand{
			Alerts:      &items,
			DashboardId: testDash.Id,
			OrgId:       1,
			UserId:      1,
		}

		err := SaveAlerts(&cmd)

		Convey("Can create one alert", func() {
			So(err, ShouldBeNil)

			query := &m.GetAlertChangesQuery{OrgId: 1}
			er := GetAlertRuleChanges(query)
			So(er, ShouldBeNil)
			So(len(query.Result), ShouldEqual, 1)
		})

		Convey("Can read properties", func() {
			query := m.GetAlertForPanelQuery{
				DashboardId: testDash.Id,
				PanelId:     1,
			}
			err2 := GetAlertsByDashboardAndPanelId(&query)

			So(err2, ShouldBeNil)
			So(query.Result.Interval, ShouldEqual, "10")
			So(query.Result.WarnLevel, ShouldEqual, 30)
			So(query.Result.CritLevel, ShouldEqual, 50)
			So(query.Result.WarnOperator, ShouldEqual, ">")
			So(query.Result.CritOperator, ShouldEqual, ">")
			So(query.Result.Query, ShouldEqual, "Query")
			So(query.Result.QueryRefId, ShouldEqual, "A")
			So(query.Result.Title, ShouldEqual, "Alerting title")
			So(query.Result.Description, ShouldEqual, "Alerting description")
			So(query.Result.QueryRange, ShouldEqual, "5m")
			So(query.Result.Aggregator, ShouldEqual, "avg")
			So(query.Result.State, ShouldEqual, "OK")
		})

		Convey("Alerts with same dashboard id and panel id should update", func() {
			modifiedItems := items
			modifiedItems[0].Query = "Updated Query"
			modifiedItems[0].State = "ALERT"

			modifiedCmd := m.SaveAlertsCommand{
				DashboardId: testDash.Id,
				OrgId:       1,
				UserId:      1,
				Alerts:      &modifiedItems,
			}

			err := SaveAlerts(&modifiedCmd)

			Convey("Can save alerts with same dashboard and panel id", func() {
				So(err, ShouldBeNil)
			})

			Convey("Alerts should be updated", func() {
				query := m.GetAlertsForDashboardQuery{DashboardId: testDash.Id}
				err2 := GetAlertsByDashboardId(&query)

				So(err2, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Query, ShouldEqual, "Updated Query")

				Convey("Alert state should not be updated", func() {
					So(query.Result[0].State, ShouldEqual, "OK")
				})
			})

			Convey("Updates without changes should be ignored", func() {
				err3 := SaveAlerts(&modifiedCmd)
				So(err3, ShouldBeNil)

				query := &m.GetAlertChangesQuery{OrgId: 1}
				er := GetAlertRuleChanges(query)
				So(er, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 2)
			})
		})

		Convey("Multiple alerts per dashboard", func() {
			multipleItems := []m.AlertRule{
				{
					DashboardId: testDash.Id,
					PanelId:     1,
					Query:       "1",
					OrgId:       1,
				},
				{
					DashboardId: testDash.Id,
					PanelId:     2,
					Query:       "2",
					OrgId:       1,
				},
				{
					DashboardId: testDash.Id,
					PanelId:     3,
					Query:       "3",
					OrgId:       1,
				},
			}

			cmd.Alerts = &multipleItems
			err = SaveAlerts(&cmd)

			Convey("Should save 3 dashboards", func() {
				So(err, ShouldBeNil)

				queryForDashboard := m.GetAlertsForDashboardQuery{DashboardId: testDash.Id}
				err2 := GetAlertsByDashboardId(&queryForDashboard)

				So(err2, ShouldBeNil)
				So(len(queryForDashboard.Result), ShouldEqual, 3)

				query := &m.GetAlertChangesQuery{OrgId: 1}
				er := GetAlertRuleChanges(query)
				So(er, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 4)
			})

			Convey("should updated two dashboards and delete one", func() {
				missingOneAlert := multipleItems[:2]

				cmd.Alerts = &missingOneAlert
				err = SaveAlerts(&cmd)

				Convey("should delete the missing alert", func() {
					query := m.GetAlertsForDashboardQuery{DashboardId: testDash.Id}
					err2 := GetAlertsByDashboardId(&query)
					So(err2, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
				})

				Convey("should add one more alert_rule_change", func() {
					query := &m.GetAlertChangesQuery{OrgId: 1}
					er := GetAlertRuleChanges(query)
					So(er, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 6)
				})
			})
		})

		Convey("When dashboard is removed", func() {
			items := []m.AlertRule{
				{
					PanelId:      1,
					DashboardId:  testDash.Id,
					Query:        "Query",
					QueryRefId:   "A",
					WarnLevel:    30,
					CritLevel:    50,
					WarnOperator: ">",
					CritOperator: ">",
					Interval:     "10",
					Title:        "Alerting title",
					Description:  "Alerting description",
					QueryRange:   "5m",
					Aggregator:   "avg",
				},
			}

			cmd := m.SaveAlertsCommand{
				Alerts:      &items,
				DashboardId: testDash.Id,
				OrgId:       1,
				UserId:      1,
			}

			SaveAlerts(&cmd)

			err = DeleteDashboard(&m.DeleteDashboardCommand{
				OrgId: 1,
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
		})
	})
}
