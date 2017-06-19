package sqlstore

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingDataAccess(t *testing.T) {
	Convey("Testing Alerting data access", t, func() {
		InitTestDB(t)

		testDash := insertTestDashboard("dashboard with alerts", 1, "alert")

		items := []*m.Alert{
			{
				PanelId:     1,
				DashboardId: testDash.Id,
				OrgId:       testDash.OrgId,
				Name:        "Alerting title",
				Message:     "Alerting message",
				Settings:    simplejson.New(),
				Frequency:   1,
			},
		}

		cmd := m.SaveAlertsCommand{
			Alerts:      items,
			DashboardId: testDash.Id,
			OrgId:       1,
			UserId:      1,
		}

		err := SaveAlerts(&cmd)

		Convey("Can create one alert", func() {
			So(err, ShouldBeNil)
		})

		Convey("Can set new states", func() {
			Convey("new state ok", func() {
				cmd := &m.SetAlertStateCommand{
					AlertId: 1,
					State:   m.AlertStateOK,
				}

				err = SetAlertState(cmd)
				So(err, ShouldBeNil)
			})

			Convey("can pause alert", func() {
				cmd := &m.PauseAllAlertCommand{
					Paused: true,
				}

				err = PauseAllAlerts(cmd)
				So(err, ShouldBeNil)

				Convey("cannot updated paused alert", func() {
					cmd := &m.SetAlertStateCommand{
						AlertId: 1,
						State:   m.AlertStateOK,
					}

					err = SetAlertState(cmd)
					So(err, ShouldNotBeNil)
				})
			})
		})

		Convey("Set Eval Date", func() {
			cmd := &m.SetAlertEvalDateCmd{
				AlertId: 1,
			}
			err = SetAlertEvalDate(cmd)
			So(err, ShouldBeNil)
			So(cmd.EvalDate, ShouldNotBeNil)
		})

		Convey("Can read properties", func() {
			alertQuery := m.GetAlertsQuery{DashboardId: testDash.Id, PanelId: 1, OrgId: 1}
			err2 := HandleAlertsQuery(&alertQuery)

			alert := alertQuery.Result[0]
			So(err2, ShouldBeNil)
			So(alert.Name, ShouldEqual, "Alerting title")
			So(alert.Message, ShouldEqual, "Alerting message")
			So(alert.State, ShouldEqual, "pending")
			So(alert.Frequency, ShouldEqual, 1)
		})

		Convey("Alerts with same dashboard id and panel id should update", func() {
			modifiedItems := items
			modifiedItems[0].Name = "Name"

			modifiedCmd := m.SaveAlertsCommand{
				DashboardId: testDash.Id,
				OrgId:       1,
				UserId:      1,
				Alerts:      modifiedItems,
			}

			err := SaveAlerts(&modifiedCmd)

			Convey("Can save alerts with same dashboard and panel id", func() {
				So(err, ShouldBeNil)
			})

			Convey("Alerts should be updated", func() {
				query := m.GetAlertsQuery{DashboardId: testDash.Id, OrgId: 1}
				err2 := HandleAlertsQuery(&query)

				So(err2, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Name, ShouldEqual, "Name")

				Convey("Alert state should not be updated", func() {
					So(query.Result[0].State, ShouldEqual, "pending")
				})
			})

			Convey("Updates without changes should be ignored", func() {
				err3 := SaveAlerts(&modifiedCmd)
				So(err3, ShouldBeNil)
			})
		})

		Convey("Multiple alerts per dashboard", func() {
			multipleItems := []*m.Alert{
				{
					DashboardId: testDash.Id,
					PanelId:     1,
					Name:        "1",
					OrgId:       1,
					Settings:    simplejson.New(),
				},
				{
					DashboardId: testDash.Id,
					PanelId:     2,
					Name:        "2",
					OrgId:       1,
					Settings:    simplejson.New(),
				},
				{
					DashboardId: testDash.Id,
					PanelId:     3,
					Name:        "3",
					OrgId:       1,
					Settings:    simplejson.New(),
				},
			}

			cmd.Alerts = multipleItems
			err = SaveAlerts(&cmd)

			Convey("Should save 3 dashboards", func() {
				So(err, ShouldBeNil)

				queryForDashboard := m.GetAlertsQuery{DashboardId: testDash.Id, OrgId: 1}
				err2 := HandleAlertsQuery(&queryForDashboard)

				So(err2, ShouldBeNil)
				So(len(queryForDashboard.Result), ShouldEqual, 3)
			})

			Convey("should updated two dashboards and delete one", func() {
				missingOneAlert := multipleItems[:2]

				cmd.Alerts = missingOneAlert
				err = SaveAlerts(&cmd)

				Convey("should delete the missing alert", func() {
					query := m.GetAlertsQuery{DashboardId: testDash.Id, OrgId: 1}
					err2 := HandleAlertsQuery(&query)
					So(err2, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
				})
			})
		})

		Convey("Get Missing alerts", func() {

			currentTime := time.Now().Round(time.Second)
			currentTimeLessFrequency := time.Unix(currentTime.Unix()-120-30, 0)
			currentTimeLess2Frequency := time.Unix(currentTime.Unix()-2*120+30, 0)
			currentTimeLess60s := time.Unix(currentTime.Unix()-60, 0)
			currentTimeLess3Frequency := time.Unix(currentTime.Unix()-3*120, 0)

			multipleAlerts := []*m.Alert{
				{
					DashboardId: testDash.Id,
					PanelId:     4,
					Name:        "4",
					OrgId:       1,
					Settings:    simplejson.New(),
					Frequency:   120,
					EvalDate:    currentTime,
				},
				{
					DashboardId: testDash.Id,
					PanelId:     5,
					Name:        "5",
					OrgId:       1,
					Settings:    simplejson.New(),
					Frequency:   120,
					EvalDate:    currentTimeLessFrequency,
				},
				{
					DashboardId: testDash.Id,
					PanelId:     6,
					Name:        "6",
					OrgId:       1,
					Settings:    simplejson.New(),
					Frequency:   120,
					EvalDate:    currentTimeLess2Frequency,
				},
				{
					DashboardId: testDash.Id,
					PanelId:     7,
					Name:        "7",
					OrgId:       1,
					Settings:    simplejson.New(),
					Frequency:   120,
					EvalDate:    currentTimeLess60s,
				},
				{
					DashboardId: testDash.Id,
					PanelId:     8,
					Name:        "8",
					OrgId:       1,
					Settings:    simplejson.New(),
					Frequency:   120,
					EvalDate:    currentTimeLess3Frequency,
				},
				{
					DashboardId: testDash.Id,
					PanelId:     9,
					Name:        "9",
					OrgId:       1,
					Settings:    simplejson.New(),
					Frequency:   14400,                                  //4hrs
					EvalDate:    time.Unix(currentTime.Unix()-18000, 0), //5 hours before currrent time
				},
				{
					DashboardId: testDash.Id,
					PanelId:     10,
					Name:        "10",
					OrgId:       1,
					Settings:    simplejson.New(),
					Frequency:   9000,                                   //2.5 hrs
					EvalDate:    time.Unix(currentTime.Unix()-18000, 0), //5 hours before current time
				},
			}

			cmd.Alerts = multipleAlerts
			err = SaveAlerts(&cmd)

			Convey("Get Missed Alerts", func() {
				So(err, ShouldBeNil)

				queryForMissedAlerts := m.GetMissingAlertsQuery{}
				err1 := GetMissingAlerts(&queryForMissedAlerts)
				So(err1, ShouldBeNil)
				So(len(queryForMissedAlerts.Result), ShouldEqual, 3)
			})
		})

		Convey("When dashboard is removed", func() {
			items := []*m.Alert{
				{
					PanelId:     1,
					DashboardId: testDash.Id,
					Name:        "Alerting title",
					Message:     "Alerting message",
				},
			}

			cmd := m.SaveAlertsCommand{
				Alerts:      items,
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
				query := m.GetAlertsQuery{DashboardId: testDash.Id, OrgId: 1}
				err2 := HandleAlertsQuery(&query)

				So(testDash.Id, ShouldEqual, 1)
				So(err2, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 0)
			})
		})
	})
}
