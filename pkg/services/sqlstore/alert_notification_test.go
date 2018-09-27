package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertNotificationSQLAccess(t *testing.T) {
	Convey("Testing Alert notification sql access", t, func() {
		InitTestDB(t)

		Convey("Alert notification state", func() {
			var alertId int64 = 7
			var orgId int64 = 5
			var notifierId int64 = 10

			Convey("Getting no existant state returns error", func() {
				query := &models.GetNotificationStateQuery{AlertId: alertId, OrgId: orgId, NotifierId: notifierId}
				err := GetAlertNotificationState(context.Background(), query)
				So(err, ShouldEqual, models.ErrAlertNotificationStateNotFound)
			})

			Convey("Can insert new state for alert notifier", func() {
				createCmd := &models.InsertAlertNotificationCommand{
					AlertId:    alertId,
					NotifierId: notifierId,
					OrgId:      orgId,
					SentAt:     1,
					State:      models.AlertNotificationStateCompleted,
				}

				err := InsertAlertNotificationState(context.Background(), createCmd)
				So(err, ShouldBeNil)

				err = InsertAlertNotificationState(context.Background(), createCmd)
				So(err, ShouldEqual, models.ErrAlertNotificationStateAllreadyExist)

				Convey("should be able to update alert notifier state", func() {
					updateCmd := &models.UpdateAlertNotificationStateCommand{
						Id:      1,
						SentAt:  1,
						State:   models.AlertNotificationStatePending,
						Version: 0,
					}

					err := UpdateAlertNotificationState(context.Background(), updateCmd)
					So(err, ShouldBeNil)

					Convey("should not be able to update older versions", func() {
						err = UpdateAlertNotificationState(context.Background(), updateCmd)
						So(err, ShouldEqual, models.ErrAlertNotificationStateVersionConflict)
					})
				})
			})
		})

		Convey("Alert notifications should be empty", func() {
			cmd := &models.GetAlertNotificationsQuery{
				OrgId: 2,
				Name:  "email",
			}

			err := GetAlertNotifications(cmd)
			So(err, ShouldBeNil)
			So(cmd.Result, ShouldBeNil)
		})

		Convey("Cannot save alert notifier with send reminder = true", func() {
			cmd := &models.CreateAlertNotificationCommand{
				Name:         "ops",
				Type:         "email",
				OrgId:        1,
				SendReminder: true,
				Settings:     simplejson.New(),
			}

			Convey("and missing frequency", func() {
				err := CreateAlertNotificationCommand(cmd)
				So(err, ShouldEqual, models.ErrNotificationFrequencyNotFound)
			})

			Convey("invalid frequency", func() {
				cmd.Frequency = "invalid duration"

				err := CreateAlertNotificationCommand(cmd)
				So(err.Error(), ShouldEqual, "time: invalid duration invalid duration")
			})
		})

		Convey("Cannot update alert notifier with send reminder = false", func() {
			cmd := &models.CreateAlertNotificationCommand{
				Name:         "ops update",
				Type:         "email",
				OrgId:        1,
				SendReminder: false,
				Settings:     simplejson.New(),
			}

			err := CreateAlertNotificationCommand(cmd)
			So(err, ShouldBeNil)

			updateCmd := &models.UpdateAlertNotificationCommand{
				Id:           cmd.Result.Id,
				SendReminder: true,
			}

			Convey("and missing frequency", func() {
				err := UpdateAlertNotification(updateCmd)
				So(err, ShouldEqual, models.ErrNotificationFrequencyNotFound)
			})

			Convey("invalid frequency", func() {
				updateCmd.Frequency = "invalid duration"

				err := UpdateAlertNotification(updateCmd)
				So(err, ShouldNotBeNil)
				So(err.Error(), ShouldEqual, "time: invalid duration invalid duration")
			})
		})

		Convey("Can save Alert Notification", func() {
			cmd := &models.CreateAlertNotificationCommand{
				Name:         "ops",
				Type:         "email",
				OrgId:        1,
				SendReminder: true,
				Frequency:    "10s",
				Settings:     simplejson.New(),
			}

			err := CreateAlertNotificationCommand(cmd)
			So(err, ShouldBeNil)
			So(cmd.Result.Id, ShouldNotEqual, 0)
			So(cmd.Result.OrgId, ShouldNotEqual, 0)
			So(cmd.Result.Type, ShouldEqual, "email")
			So(cmd.Result.Frequency, ShouldEqual, 10*time.Second)

			Convey("Cannot save Alert Notification with the same name", func() {
				err = CreateAlertNotificationCommand(cmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Can update alert notification", func() {
				newCmd := &models.UpdateAlertNotificationCommand{
					Name:         "NewName",
					Type:         "webhook",
					OrgId:        cmd.Result.OrgId,
					SendReminder: true,
					Frequency:    "60s",
					Settings:     simplejson.New(),
					Id:           cmd.Result.Id,
				}
				err := UpdateAlertNotification(newCmd)
				So(err, ShouldBeNil)
				So(newCmd.Result.Name, ShouldEqual, "NewName")
				So(newCmd.Result.Frequency, ShouldEqual, 60*time.Second)
			})

			Convey("Can update alert notification to disable sending of reminders", func() {
				newCmd := &models.UpdateAlertNotificationCommand{
					Name:         "NewName",
					Type:         "webhook",
					OrgId:        cmd.Result.OrgId,
					SendReminder: false,
					Settings:     simplejson.New(),
					Id:           cmd.Result.Id,
				}
				err := UpdateAlertNotification(newCmd)
				So(err, ShouldBeNil)
				So(newCmd.Result.SendReminder, ShouldBeFalse)
			})
		})

		Convey("Can search using an array of ids", func() {
			cmd1 := models.CreateAlertNotificationCommand{Name: "nagios", Type: "webhook", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd2 := models.CreateAlertNotificationCommand{Name: "slack", Type: "webhook", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd3 := models.CreateAlertNotificationCommand{Name: "ops2", Type: "email", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd4 := models.CreateAlertNotificationCommand{IsDefault: true, Name: "default", Type: "email", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

			otherOrg := models.CreateAlertNotificationCommand{Name: "default", Type: "email", OrgId: 2, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

			So(CreateAlertNotificationCommand(&cmd1), ShouldBeNil)
			So(CreateAlertNotificationCommand(&cmd2), ShouldBeNil)
			So(CreateAlertNotificationCommand(&cmd3), ShouldBeNil)
			So(CreateAlertNotificationCommand(&cmd4), ShouldBeNil)
			So(CreateAlertNotificationCommand(&otherOrg), ShouldBeNil)

			Convey("search", func() {
				query := &models.GetAlertNotificationsToSendQuery{
					Ids:   []int64{cmd1.Result.Id, cmd2.Result.Id, 112341231},
					OrgId: 1,
				}

				err := GetAlertNotificationsToSend(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 3)
			})

			Convey("all", func() {
				query := &models.GetAllAlertNotificationsQuery{
					OrgId: 1,
				}

				err := GetAllAlertNotifications(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 4)
			})
		})
	})
}
