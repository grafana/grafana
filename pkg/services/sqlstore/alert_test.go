package sqlstore

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func mockTimeNow() {
	var timeSeed int64
	timeNow = func() time.Time {
		loc := time.FixedZone("MockZoneUTC-5", -5*60*60)
		fakeNow := time.Unix(timeSeed, 0).In(loc)
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
		items := []*models.Alert{
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

		cmd := models.SaveAlertsCommand{
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
				cmd := &models.SetAlertStateCommand{
					AlertId: 1,
					State:   models.AlertStateOK,
				}

				err = SetAlertState(cmd)
				So(err, ShouldBeNil)
			})

			alert, _ := getAlertById(1)
			stateDateBeforePause := alert.NewStateDate

			Convey("can pause all alerts", func() {
				err := pauseAllAlerts(true)
				So(err, ShouldBeNil)

				Convey("cannot updated paused alert", func() {
					cmd := &models.SetAlertStateCommand{
						AlertId: 1,
						State:   models.AlertStateOK,
					}

					err = SetAlertState(cmd)
					So(err, ShouldNotBeNil)
				})

				Convey("alert is paused", func() {
					alert, _ = getAlertById(1)
					currentState := alert.State
					So(currentState, ShouldEqual, "paused")
				})

				Convey("pausing alerts should update their NewStateDate", func() {
					alert, _ = getAlertById(1)
					stateDateAfterPause := alert.NewStateDate
					So(stateDateBeforePause, ShouldHappenBefore, stateDateAfterPause)
				})

				Convey("unpausing alerts should update their NewStateDate again", func() {
					err := pauseAllAlerts(false)
					So(err, ShouldBeNil)
					alert, _ = getAlertById(1)
					stateDateAfterUnpause := alert.NewStateDate
					So(stateDateBeforePause, ShouldHappenBefore, stateDateAfterUnpause)
				})
			})
		})

		Convey("Can read properties", func() {
			alertQuery := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, PanelId: 1, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
			err2 := HandleAlertsQuery(&alertQuery)

			alert := alertQuery.Result[0]
			So(err2, ShouldBeNil)
			So(alert.Id, ShouldBeGreaterThan, 0)
			So(alert.DashboardId, ShouldEqual, testDash.Id)
			So(alert.PanelId, ShouldEqual, 1)
			So(alert.Name, ShouldEqual, "Alerting title")
			So(alert.State, ShouldEqual, models.AlertStateUnknown)
			So(alert.NewStateDate, ShouldNotBeNil)
			So(alert.EvalData, ShouldNotBeNil)
			So(alert.EvalData.Get("test").MustString(), ShouldEqual, "test")
			So(alert.EvalDate, ShouldNotBeNil)
			So(alert.ExecutionError, ShouldEqual, "")
			So(alert.DashboardUid, ShouldNotBeNil)
			So(alert.DashboardSlug, ShouldEqual, "dashboard-with-alerts")
		})

		Convey("Viewer cannot read alerts", func() {
			viewerUser := &models.SignedInUser{OrgRole: models.ROLE_VIEWER, OrgId: 1}
			alertQuery := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, PanelId: 1, OrgId: 1, User: viewerUser}
			err2 := HandleAlertsQuery(&alertQuery)

			So(err2, ShouldBeNil)
			So(alertQuery.Result, ShouldHaveLength, 1)
		})

		Convey("Alerts with same dashboard id and panel id should update", func() {
			modifiedItems := items
			modifiedItems[0].Name = "Name"

			modifiedCmd := models.SaveAlertsCommand{
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
				query := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
				err2 := HandleAlertsQuery(&query)

				So(err2, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Name, ShouldEqual, "Name")

				Convey("Alert state should not be updated", func() {
					So(query.Result[0].State, ShouldEqual, models.AlertStateUnknown)
				})
			})

			Convey("Updates without changes should be ignored", func() {
				err3 := SaveAlerts(&modifiedCmd)
				So(err3, ShouldBeNil)
			})
		})

		Convey("Multiple alerts per dashboard", func() {
			multipleItems := []*models.Alert{
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

				queryForDashboard := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
				err2 := HandleAlertsQuery(&queryForDashboard)

				So(err2, ShouldBeNil)
				So(len(queryForDashboard.Result), ShouldEqual, 3)
			})

			Convey("should updated two dashboards and delete one", func() {
				missingOneAlert := multipleItems[:2]

				cmd.Alerts = missingOneAlert
				err = SaveAlerts(&cmd)

				Convey("should delete the missing alert", func() {
					query := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
					err2 := HandleAlertsQuery(&query)
					So(err2, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
				})
			})
		})

		Convey("When dashboard is removed", func() {
			items := []*models.Alert{
				{
					PanelId:     1,
					DashboardId: testDash.Id,
					Name:        "Alerting title",
					Message:     "Alerting message",
				},
			}

			cmd := models.SaveAlertsCommand{
				Alerts:      items,
				DashboardId: testDash.Id,
				OrgId:       1,
				UserId:      1,
			}

			err = SaveAlerts(&cmd)
			So(err, ShouldBeNil)

			err = DeleteDashboard(&models.DeleteDashboardCommand{
				OrgId: 1,
				Id:    testDash.Id,
			})
			So(err, ShouldBeNil)

			Convey("Alerts should be removed", func() {
				query := models.GetAlertsQuery{DashboardIDs: []int64{testDash.Id}, OrgId: 1, User: &models.SignedInUser{OrgRole: models.ROLE_ADMIN}}
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
			_, err := pauseAlert(testDash.OrgId, 1, true)
			So(err, ShouldBeNil)

			Convey("the NewStateDate should be updated", func() {
				alert, err := getAlertById(1)
				So(err, ShouldBeNil)

				stateDateAfterPause = alert.NewStateDate
				So(stateDateBeforePause, ShouldHappenBefore, stateDateAfterPause)
			})
		})

		Convey("when unpaused", func() {
			_, err := pauseAlert(testDash.OrgId, 1, false)
			So(err, ShouldBeNil)

			Convey("the NewStateDate should be updated again", func() {
				alert, err := getAlertById(1)
				So(err, ShouldBeNil)

				stateDateAfterUnpause := alert.NewStateDate
				So(stateDateAfterPause, ShouldHappenBefore, stateDateAfterUnpause)
			})
		})
	})
}
func pauseAlert(orgId int64, alertId int64, pauseState bool) (int64, error) {
	cmd := &models.PauseAlertCommand{
		OrgId:    orgId,
		AlertIds: []int64{alertId},
		Paused:   pauseState,
	}
	err := PauseAlert(cmd)
	So(err, ShouldBeNil)
	return cmd.ResultCount, err
}
func insertTestAlert(title string, message string, orgId int64, dashId int64, settings *simplejson.Json) (*models.Alert, error) {
	items := []*models.Alert{
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

	cmd := models.SaveAlertsCommand{
		Alerts:      items,
		DashboardId: dashId,
		OrgId:       orgId,
		UserId:      1,
	}

	err := SaveAlerts(&cmd)
	return cmd.Alerts[0], err
}

func getAlertById(id int64) (*models.Alert, error) {
	q := &models.GetAlertByIdQuery{
		Id: id,
	}
	err := GetAlertById(q)
	So(err, ShouldBeNil)
	return q.Result, err
}

func pauseAllAlerts(pauseState bool) error {
	cmd := &models.PauseAllAlertCommand{
		Paused: pauseState,
	}
	err := PauseAllAlerts(cmd)
	So(err, ShouldBeNil)
	return err
}
