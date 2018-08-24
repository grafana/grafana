package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertNotificationSQLAccess(t *testing.T) {
	Convey("Testing Alert notification sql access", t, func() {
		InitTestDB(t)

		Convey("Alert notification journal", func() {
			var alertId int64 = 5
			var orgId int64 = 5
			var notifierId int64 = 5

			Convey("Getting last journal should raise error if no one exists", func() {
				query := &m.GetLatestNotificationQuery{AlertId: alertId, OrgId: orgId, NotifierId: notifierId}
				err := GetLatestNotification(context.Background(), query)
				So(err, ShouldEqual, m.ErrJournalingNotFound)

				Convey("shoulbe be able to record two journaling events", func() {
					createCmd := &m.RecordNotificationJournalCommand{AlertId: alertId, NotifierId: notifierId, OrgId: orgId, Success: true, SentAt: 1}

					err := RecordNotificationJournal(context.Background(), createCmd)
					So(err, ShouldBeNil)

					createCmd.SentAt += 1000 //increase epoch

					err = RecordNotificationJournal(context.Background(), createCmd)
					So(err, ShouldBeNil)

					Convey("get last journaling event", func() {
						err := GetLatestNotification(context.Background(), query)
						So(err, ShouldBeNil)
						So(query.Result.SentAt, ShouldEqual, 1001)

						Convey("be able to clear all journaling for an notifier", func() {
							cmd := &m.CleanNotificationJournalCommand{AlertId: alertId, NotifierId: notifierId, OrgId: orgId}
							err := CleanNotificationJournal(context.Background(), cmd)
							So(err, ShouldBeNil)

							Convey("querying for last junaling should raise error", func() {
								query := &m.GetLatestNotificationQuery{AlertId: alertId, OrgId: orgId, NotifierId: notifierId}
								err := GetLatestNotification(context.Background(), query)
								So(err, ShouldEqual, m.ErrJournalingNotFound)
							})
						})
					})
				})
			})
		})

		Convey("Alert notifications should be empty", func() {
			cmd := &m.GetAlertNotificationsQuery{
				OrgId: 2,
				Name:  "email",
			}

			err := GetAlertNotifications(cmd)
			So(err, ShouldBeNil)
			So(cmd.Result, ShouldBeNil)
		})

		Convey("Cannot save alert notifier with send reminder = true", func() {
			cmd := &m.CreateAlertNotificationCommand{
				Name:         "ops",
				Type:         "email",
				OrgId:        1,
				SendReminder: true,
				Settings:     simplejson.New(),
			}

			Convey("and missing frequency", func() {
				err := CreateAlertNotificationCommand(cmd)
				So(err, ShouldEqual, m.ErrNotificationFrequencyNotFound)
			})

			Convey("invalid frequency", func() {
				cmd.Frequency = "invalid duration"

				err := CreateAlertNotificationCommand(cmd)
				So(err.Error(), ShouldEqual, "time: invalid duration invalid duration")
			})
		})

		Convey("Cannot update alert notifier with send reminder = false", func() {
			cmd := &m.CreateAlertNotificationCommand{
				Name:         "ops update",
				Type:         "email",
				OrgId:        1,
				SendReminder: false,
				Settings:     simplejson.New(),
			}

			err := CreateAlertNotificationCommand(cmd)
			So(err, ShouldBeNil)

			updateCmd := &m.UpdateAlertNotificationCommand{
				Id:           cmd.Result.Id,
				SendReminder: true,
			}

			Convey("and missing frequency", func() {
				err := UpdateAlertNotification(updateCmd)
				So(err, ShouldEqual, m.ErrNotificationFrequencyNotFound)
			})

			Convey("invalid frequency", func() {
				updateCmd.Frequency = "invalid duration"

				err := UpdateAlertNotification(updateCmd)
				So(err, ShouldNotBeNil)
				So(err.Error(), ShouldEqual, "time: invalid duration invalid duration")
			})
		})

		Convey("Can save Alert Notification", func() {
			cmd := &m.CreateAlertNotificationCommand{
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
				newCmd := &m.UpdateAlertNotificationCommand{
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
				newCmd := &m.UpdateAlertNotificationCommand{
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
			cmd1 := m.CreateAlertNotificationCommand{Name: "nagios", Type: "webhook", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd2 := m.CreateAlertNotificationCommand{Name: "slack", Type: "webhook", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd3 := m.CreateAlertNotificationCommand{Name: "ops2", Type: "email", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}
			cmd4 := m.CreateAlertNotificationCommand{IsDefault: true, Name: "default", Type: "email", OrgId: 1, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

			otherOrg := m.CreateAlertNotificationCommand{Name: "default", Type: "email", OrgId: 2, SendReminder: true, Frequency: "10s", Settings: simplejson.New()}

			So(CreateAlertNotificationCommand(&cmd1), ShouldBeNil)
			So(CreateAlertNotificationCommand(&cmd2), ShouldBeNil)
			So(CreateAlertNotificationCommand(&cmd3), ShouldBeNil)
			So(CreateAlertNotificationCommand(&cmd4), ShouldBeNil)
			So(CreateAlertNotificationCommand(&otherOrg), ShouldBeNil)

			Convey("search", func() {
				query := &m.GetAlertNotificationsToSendQuery{
					Ids:   []int64{cmd1.Result.Id, cmd2.Result.Id, 112341231},
					OrgId: 1,
				}

				err := GetAlertNotificationsToSend(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 3)
			})

			Convey("all", func() {
				query := &m.GetAllAlertNotificationsQuery{
					OrgId: 1,
				}

				err := GetAllAlertNotifications(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 4)
			})
		})
	})
}
