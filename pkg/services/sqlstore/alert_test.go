package sqlstore

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

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

func TestDeletingAlerts(t *testing.T) {
	InitTestDB(t)

	Convey("No error when deleting non existing alert", t, func() { // Is that what we want?
		err := DeleteAlert(&models.DeleteAlertCommand{Id: 1})
		So(err, ShouldBeNil)
	})

	Convey("Can delete existing alert", t, func() {
		org := int64(1)
		dashboard := int64(0)
		alert, _ := insertTestAlert("Alerting title", "Alerting message", org, dashboard, simplejson.New())
		err := DeleteAlert(&models.DeleteAlertCommand{Id: 1})
		So(err, ShouldBeNil)

		q := &models.GetAlertByIdQuery{
			Id: alert.Id,
		}
		err = GetAlertById(q)
		So(err, ShouldNotBeNil)
	})
}

func TestCreatingAlerts(t *testing.T) {
	db := InitTestDB(t)

	mockTimeNow()
	defer resetTimeNow()

	t.Run("Can create alert", func(t *testing.T) {
		// TODO alerts for other datasources
		cmd, err := loadTestFile("./testdata/1-cloud_monitoring-alert.json")
		assert.NoError(t, err)

		cmd.OrgId = 1

		// create a notification
		notification := models.CreateAlertNotificationCommand{Uid: "notifier1", OrgId: 1, Name: "1"}
		err = CreateAlertNotificationCommand(&notification)
		assert.NoError(t, err)
		// set the generated notification to the command
		cmd.Notifications[0].UID = notification.Uid

		err = CreateAlert(&cmd)
		assert.NoError(t, err)
		assert.NotNil(t, cmd.Result)

		q := &models.GetAlertByIdQuery{
			Id: cmd.Result.Id,
		}
		err = GetAlertById(q)
		alert := q.Result
		assert.NoError(t, err)
		assert.Equal(t, int64(1), alert.OrgId)
		assert.Equal(t, "Test cloud monitoring standalone alert", alert.Name)
		assert.Equal(t, int64(10), alert.Frequency)
		assert.Equal(t, 30*time.Second, alert.For)
		assert.Equal(t, models.AlertStateUnknown, alert.State)

		loc := time.FixedZone("MockZoneUTC-5", -5*60*60)
		expTime := time.Unix(0, 0).In(loc).UTC()
		assert.Equal(t, expTime, alert.Created)
		assert.Equal(t, expTime, alert.Updated)
		assert.Equal(t, expTime, alert.NewStateDate)

		err = db.WithDbSession(context.Background(), func(sess *DBSession) error {
			checkTags(sess, t, alert)
			return nil
		})
		checkNotifications(t, alert, notification.Uid)
	})

	t.Run("Fails to create alert with unparsable for", func(t *testing.T) {
		cmd, err := loadTestFile("./testdata/1-cloud_monitoring-alert.json")
		assert.NoError(t, err)
		cmd.OrgId = 1
		cmd.For = "some text"

		err = CreateAlert(&cmd)
		assert.Error(t, err, "invalid duration some text")
		assert.Nil(t, cmd.Result)
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

func loadTestFile(path string) (models.CreateAlertCommand, error) {
	var data models.CreateAlertCommand

	jsonBody, err := ioutil.ReadFile(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(jsonBody, &data)
	return data, err
}

func checkTags(sess *DBSession, t *testing.T, alert *models.Alert) {
	t.Run("tag is stored in alert settings", func(t *testing.T) {
		tags := alert.GetTagsFromSettings()
		assert.Len(t, tags, 1)
		assert.Equal(t, tags[0].Key, "foo")
		assert.Equal(t, tags[0].Value, "bar")
	})

	t.Run("record exists in alert_rule_tag table", func(t *testing.T) {
		tag, err := getTag(sess, "foo", "bar")
		assert.NoError(t, err)
		assert.NotNil(t, tag)

		alertTags, err := getAlertTags(alert.Id)
		assert.NoError(t, err)
		tagFound := false
		for _, t := range alertTags {
			if t.Id == tag.Id {
				tagFound = true
			}
		}
		assert.True(t, tagFound)
	})
}

func checkNotifications(t *testing.T, alert *models.Alert, uid string) {
	t.Run("tag is stored in alert settings", func(t *testing.T) {
		notifications := alert.GetNotificationsFromSettings()
		assert.Len(t, notifications, 1)
		assert.Equal(t, notifications[0], uid)
	})

	t.Run("record exists in alert_rule_notification table", func(t *testing.T) {
		q := models.GetAlertNotificationsWithUidQuery{OrgId: alert.OrgId, Uid: uid}
		err := GetAlertNotificationsWithUid(&q)
		assert.NoError(t, err)
		assert.NotNil(t, q.Result)

		notificationIDs, err := getAlertNotificationIDs(alert.Id)
		assert.NoError(t, err)
		notificationsFound := false
		for _, id := range notificationIDs {
			if id == q.Result.Id {
				notificationsFound = true
			}
		}
		assert.True(t, notificationsFound)
	})
}
