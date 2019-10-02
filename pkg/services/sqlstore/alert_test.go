package sqlstore

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func mockTimeNow() {
	var timeSeed int64
	timeNow = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0)
		timeSeed++
		return fakeNow
	}
}

func resetTimeNow() {
	timeNow = time.Now
}

func TestAlertingDataAccess(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	Convey("Testing Alerting data access", t, func() {
		InitTestDB(t)

		testDash := insertTestDashboard("dashboard with alerts", 1, 0, false, "alert")
		evalData, _ := simplejson.NewJson([]byte(`{"test": "test"}`))
		items := []*m.Alert{
			{
				PanelId:     1,
				DashboardId: testDash.Id,
				OrgId:       testDash.OrgId,
				Name:        "Alerting title",
				Message:     "Alerting message",
				Settings:    simplejson.New(),
				Frequency:   1,
				EvalData:    evalData,
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

			alert, _ := getAlertById(1)
			stateDateBeforePause := alert.NewStateDate

			Convey("can pause all alerts", func() {
				pauseAllAlerts(true)

				Convey("cannot updated paused alert", func() {
					cmd := &m.SetAlertStateCommand{
						AlertId: 1,
						State:   m.AlertStateOK,
					}

					err = SetAlertState(cmd)
					So(err, ShouldNotBeNil)
				})

				Convey("pausing alerts should update their NewStateDate", func() {
					alert, _ = getAlertById(1)
					stateDateAfterPause := alert.NewStateDate
					So(stateDateBeforePause, ShouldHappenBefore, stateDateAfterPause)
				})

				Convey("unpausing alerts should update their NewStateDate again", func() {
					pauseAllAlerts(false)
					alert, _ = getAlertById(1)
					stateDateAfterUnpause := alert.NewStateDate
					So(stateDateBeforePause, ShouldHappenBefore, stateDateAfterUnpause)
				})
			})
		})

		Convey("Can read properties", func() {
			alertQuery := m.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, PanelId: 1, OrgId: 1, User: &m.SignedInUser{OrgRole: m.ROLE_ADMIN}}
			err2 := HandleAlertsQuery(&alertQuery)

			alert := alertQuery.Result[0]
			So(err2, ShouldBeNil)
			So(alert.Id, ShouldBeGreaterThan, 0)
			So(alert.DashboardId, ShouldEqual, testDash.Id)
			So(alert.PanelId, ShouldEqual, 1)
			So(alert.Name, ShouldEqual, "Alerting title")
			So(alert.State, ShouldEqual, m.AlertStateUnknown)
			So(alert.NewStateDate, ShouldNotBeNil)
			So(alert.EvalData, ShouldNotBeNil)
			So(alert.EvalData.Get("test").MustString(), ShouldEqual, "test")
			So(alert.EvalDate, ShouldNotBeNil)
			So(alert.ExecutionError, ShouldEqual, "")
			So(alert.DashboardUid, ShouldNotBeNil)
			So(alert.DashboardSlug, ShouldEqual, "dashboard-with-alerts")
		})

		Convey("Viewer cannot read alerts", func() {
			viewerUser := &m.SignedInUser{OrgRole: m.ROLE_VIEWER, OrgId: 1}
			alertQuery := m.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, PanelId: 1, OrgId: 1, User: viewerUser}
			err2 := HandleAlertsQuery(&alertQuery)

			So(err2, ShouldBeNil)
			So(alertQuery.Result, ShouldHaveLength, 1)
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
				query := m.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &m.SignedInUser{OrgRole: m.ROLE_ADMIN}}
				err2 := HandleAlertsQuery(&query)

				So(err2, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Name, ShouldEqual, "Name")

				Convey("Alert state should not be updated", func() {
					So(query.Result[0].State, ShouldEqual, m.AlertStateUnknown)
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

				queryForDashboard := m.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &m.SignedInUser{OrgRole: m.ROLE_ADMIN}}
				err2 := HandleAlertsQuery(&queryForDashboard)

				So(err2, ShouldBeNil)
				So(len(queryForDashboard.Result), ShouldEqual, 3)
			})

			Convey("should updated two dashboards and delete one", func() {
				missingOneAlert := multipleItems[:2]

				cmd.Alerts = missingOneAlert
				err = SaveAlerts(&cmd)

				Convey("should delete the missing alert", func() {
					query := m.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &m.SignedInUser{OrgRole: m.ROLE_ADMIN}}
					err2 := HandleAlertsQuery(&query)
					So(err2, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
				})
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
				Id:    testDash.Id,
			})

			So(err, ShouldBeNil)

			Convey("Alerts should be removed", func() {
				query := m.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &m.SignedInUser{OrgRole: m.ROLE_ADMIN}}
				err2 := HandleAlertsQuery(&query)

				So(testDash.Id, ShouldEqual, 1)
				So(err2, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 0)
			})
		})
	})
}

func TestPausingAlerts(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	Convey("Given an alert", t, func() {
		InitTestDB(t)

		testDash := insertTestDashboard("dashboard with alerts", 1, 0, false, "alert")
		alert, _ := insertTestAlert("Alerting title", "Alerting message", testDash.OrgId, testDash.Id, simplejson.New())

		stateDateBeforePause := alert.NewStateDate
		stateDateAfterPause := stateDateBeforePause
		Convey("when paused", func() {
			pauseAlert(testDash.OrgId, 1, true)

			Convey("the NewStateDate should be updated", func() {
				alert, _ := getAlertById(1)

				stateDateAfterPause = alert.NewStateDate
				So(stateDateBeforePause, ShouldHappenBefore, stateDateAfterPause)
			})
		})

		Convey("when unpaused", func() {
			pauseAlert(testDash.OrgId, 1, false)

			Convey("the NewStateDate should be updated again", func() {
				alert, _ := getAlertById(1)

				stateDateAfterUnpause := alert.NewStateDate
				So(stateDateAfterPause, ShouldHappenBefore, stateDateAfterUnpause)
			})
		})
	})
}
func pauseAlert(orgId int64, alertId int64, pauseState bool) (int64, error) {
	cmd := &m.PauseAlertCommand{
		OrgId:    orgId,
		AlertIds: []int64{alertId},
		Paused:   pauseState,
	}
	err := PauseAlert(cmd)
	So(err, ShouldBeNil)
	return cmd.ResultCount, err
}
func insertTestAlert(title string, message string, orgId int64, dashId int64, settings *simplejson.Json) (*m.Alert, error) {
	items := []*m.Alert{
		{
			PanelId:     1,
			DashboardId: dashId,
			OrgId:       orgId,
			Name:        title,
			Message:     message,
			Settings:    settings,
			Frequency:   1,
		},
	}

	cmd := m.SaveAlertsCommand{
		Alerts:      items,
		DashboardId: dashId,
		OrgId:       orgId,
		UserId:      1,
	}

	err := SaveAlerts(&cmd)
	return cmd.Alerts[0], err
}

func getAlertById(id int64) (*m.Alert, error) {
	q := &m.GetAlertByIdQuery{
		Id: id,
	}
	err := GetAlertById(q)
	So(err, ShouldBeNil)
	return q.Result, err
}

func pauseAllAlerts(pauseState bool) error {
	cmd := &m.PauseAllAlertCommand{
		Paused: pauseState,
	}
	err := PauseAllAlerts(cmd)
	So(err, ShouldBeNil)
	return err
}
