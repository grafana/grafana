package notifiers

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	correct_properties              = "./testdata/test-configs/correct-properties"
	incorrect_settings              = "./testdata/test-configs/incorrect-settings"
	no_required_fields              = "./testdata/test-configs/no-required-fields"
	correct_properties_with_orgName = "./testdata/test-configs/correct-properties-with-orgName"
	brokenYaml                      = "./testdata/test-configs/broken-yaml"
	doubleNotificationsConfig       = "./testdata/test-configs/double-default"
	emptyFolder                     = "./testdata/test-configs/empty_folder"
	emptyFile                       = "./testdata/test-configs/empty"
	twoNotificationsConfig          = "./testdata/test-configs/two-notifications"
	unknownNotifier                 = "./testdata/test-configs/unknown-notifier"
)

func TestNotificationAsConfig(t *testing.T) {
	logger := log.New("fake.log")

	Convey("Testing notification as configuration", t, func() {
		sqlstore.InitTestDB(t)

		alerting.RegisterNotifier(&alerting.NotifierPlugin{
			Type:    "slack",
			Name:    "slack",
			Factory: notifiers.NewSlackNotifier,
		})

		alerting.RegisterNotifier(&alerting.NotifierPlugin{
			Type:    "email",
			Name:    "email",
			Factory: notifiers.NewEmailNotifier,
		})

		Convey("Can read correct properties", func() {
			_ = os.Setenv("TEST_VAR", "default")
			cfgProvifer := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvifer.readConfig(correct_properties)
			_ = os.Unsetenv("TEST_VAR")
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}
			So(len(cfg), ShouldEqual, 1)

			ntCfg := cfg[0]
			nts := ntCfg.Notifications
			So(len(nts), ShouldEqual, 4)

			nt := nts[0]
			So(nt.Name, ShouldEqual, "default-slack-notification")
			So(nt.Type, ShouldEqual, "slack")
			So(nt.OrgId, ShouldEqual, 2)
			So(nt.Uid, ShouldEqual, "notifier1")
			So(nt.IsDefault, ShouldBeTrue)
			So(nt.Settings, ShouldResemble, map[string]interface{}{
				"recipient": "XXX", "token": "xoxb", "uploadImage": true, "url": "https://slack.com",
			})
			So(nt.SendReminder, ShouldBeTrue)
			So(nt.Frequency, ShouldEqual, "1h")

			nt = nts[1]
			So(nt.Name, ShouldEqual, "another-not-default-notification")
			So(nt.Type, ShouldEqual, "email")
			So(nt.OrgId, ShouldEqual, 3)
			So(nt.Uid, ShouldEqual, "notifier2")
			So(nt.IsDefault, ShouldBeFalse)

			nt = nts[2]
			So(nt.Name, ShouldEqual, "check-unset-is_default-is-false")
			So(nt.Type, ShouldEqual, "slack")
			So(nt.OrgId, ShouldEqual, 3)
			So(nt.Uid, ShouldEqual, "notifier3")
			So(nt.IsDefault, ShouldBeFalse)

			nt = nts[3]
			So(nt.Name, ShouldEqual, "Added notification with whitespaces in name")
			So(nt.Type, ShouldEqual, "email")
			So(nt.Uid, ShouldEqual, "notifier4")
			So(nt.OrgId, ShouldEqual, 3)

			deleteNts := ntCfg.DeleteNotifications
			So(len(deleteNts), ShouldEqual, 4)

			deleteNt := deleteNts[0]
			So(deleteNt.Name, ShouldEqual, "default-slack-notification")
			So(deleteNt.Uid, ShouldEqual, "notifier1")
			So(deleteNt.OrgId, ShouldEqual, 2)

			deleteNt = deleteNts[1]
			So(deleteNt.Name, ShouldEqual, "deleted-notification-without-orgId")
			So(deleteNt.OrgId, ShouldEqual, 1)
			So(deleteNt.Uid, ShouldEqual, "notifier2")

			deleteNt = deleteNts[2]
			So(deleteNt.Name, ShouldEqual, "deleted-notification-with-0-orgId")
			So(deleteNt.OrgId, ShouldEqual, 1)
			So(deleteNt.Uid, ShouldEqual, "notifier3")

			deleteNt = deleteNts[3]
			So(deleteNt.Name, ShouldEqual, "Deleted notification with whitespaces in name")
			So(deleteNt.OrgId, ShouldEqual, 1)
			So(deleteNt.Uid, ShouldEqual, "notifier4")
		})

		Convey("One configured notification", func() {
			Convey("no notification in database", func() {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(twoNotificationsConfig)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}
				notificationsQuery := m.GetAllAlertNotificationsQuery{OrgId: 1}
				err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
				So(err, ShouldBeNil)
				So(notificationsQuery.Result, ShouldNotBeNil)
				So(len(notificationsQuery.Result), ShouldEqual, 2)
			})

			Convey("One notification in database with same name and uid", func() {
				existingNotificationCmd := m.CreateAlertNotificationCommand{
					Name:  "channel1",
					OrgId: 1,
					Uid:   "notifier1",
					Type:  "slack",
				}
				err := sqlstore.CreateAlertNotificationCommand(&existingNotificationCmd)
				So(err, ShouldBeNil)
				So(existingNotificationCmd.Result, ShouldNotBeNil)
				notificationsQuery := m.GetAllAlertNotificationsQuery{OrgId: 1}
				err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
				So(err, ShouldBeNil)
				So(notificationsQuery.Result, ShouldNotBeNil)
				So(len(notificationsQuery.Result), ShouldEqual, 1)

				Convey("should update one notification", func() {
					dc := newNotificationProvisioner(logger)
					err = dc.applyChanges(twoNotificationsConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}
					err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
					So(err, ShouldBeNil)
					So(notificationsQuery.Result, ShouldNotBeNil)
					So(len(notificationsQuery.Result), ShouldEqual, 2)

					nts := notificationsQuery.Result
					nt1 := nts[0]
					So(nt1.Type, ShouldEqual, "email")
					So(nt1.Name, ShouldEqual, "channel1")
					So(nt1.Uid, ShouldEqual, "notifier1")

					nt2 := nts[1]
					So(nt2.Type, ShouldEqual, "slack")
					So(nt2.Name, ShouldEqual, "channel2")
					So(nt2.Uid, ShouldEqual, "notifier2")
				})
			})
			Convey("Two notifications with is_default", func() {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(doubleNotificationsConfig)
				Convey("should both be inserted", func() {
					So(err, ShouldBeNil)
					notificationsQuery := m.GetAllAlertNotificationsQuery{OrgId: 1}
					err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
					So(err, ShouldBeNil)
					So(notificationsQuery.Result, ShouldNotBeNil)
					So(len(notificationsQuery.Result), ShouldEqual, 2)

					So(notificationsQuery.Result[0].IsDefault, ShouldBeTrue)
					So(notificationsQuery.Result[1].IsDefault, ShouldBeTrue)
				})
			})
		})

		Convey("Two configured notification", func() {
			Convey("two other notifications in database", func() {
				existingNotificationCmd := m.CreateAlertNotificationCommand{
					Name:  "channel0",
					OrgId: 1,
					Uid:   "notifier0",
					Type:  "slack",
				}
				err := sqlstore.CreateAlertNotificationCommand(&existingNotificationCmd)
				So(err, ShouldBeNil)
				existingNotificationCmd = m.CreateAlertNotificationCommand{
					Name:  "channel3",
					OrgId: 1,
					Uid:   "notifier3",
					Type:  "slack",
				}
				err = sqlstore.CreateAlertNotificationCommand(&existingNotificationCmd)
				So(err, ShouldBeNil)

				notificationsQuery := m.GetAllAlertNotificationsQuery{OrgId: 1}
				err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
				So(err, ShouldBeNil)
				So(notificationsQuery.Result, ShouldNotBeNil)
				So(len(notificationsQuery.Result), ShouldEqual, 2)

				Convey("should have two new notifications", func() {
					dc := newNotificationProvisioner(logger)
					err := dc.applyChanges(twoNotificationsConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}
					notificationsQuery = m.GetAllAlertNotificationsQuery{OrgId: 1}
					err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
					So(err, ShouldBeNil)
					So(notificationsQuery.Result, ShouldNotBeNil)
					So(len(notificationsQuery.Result), ShouldEqual, 4)
				})
			})
		})

		Convey("Can read correct properties with orgName instead of orgId", func() {
			existingOrg1 := m.CreateOrgCommand{Name: "Main Org. 1"}
			err := sqlstore.CreateOrg(&existingOrg1)
			So(err, ShouldBeNil)
			So(existingOrg1.Result, ShouldNotBeNil)
			existingOrg2 := m.CreateOrgCommand{Name: "Main Org. 2"}
			err = sqlstore.CreateOrg(&existingOrg2)
			So(err, ShouldBeNil)
			So(existingOrg2.Result, ShouldNotBeNil)

			existingNotificationCmd := m.CreateAlertNotificationCommand{
				Name:  "default-notification-delete",
				OrgId: existingOrg2.Result.Id,
				Uid:   "notifier2",
				Type:  "slack",
			}
			err = sqlstore.CreateAlertNotificationCommand(&existingNotificationCmd)
			So(err, ShouldBeNil)

			dc := newNotificationProvisioner(logger)
			err = dc.applyChanges(correct_properties_with_orgName)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			notificationsQuery := m.GetAllAlertNotificationsQuery{OrgId: existingOrg2.Result.Id}
			err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
			So(err, ShouldBeNil)
			So(notificationsQuery.Result, ShouldNotBeNil)
			So(len(notificationsQuery.Result), ShouldEqual, 1)

			nt := notificationsQuery.Result[0]
			So(nt.Name, ShouldEqual, "default-notification-create")
			So(nt.OrgId, ShouldEqual, existingOrg2.Result.Id)

		})

		Convey("Config doesn't contain required field", func() {
			dc := newNotificationProvisioner(logger)
			err := dc.applyChanges(no_required_fields)
			So(err, ShouldNotBeNil)

			errString := err.Error()
			So(errString, ShouldContainSubstring, "Deleted alert notification item 1 in configuration doesn't contain required field uid")
			So(errString, ShouldContainSubstring, "Deleted alert notification item 2 in configuration doesn't contain required field name")
			So(errString, ShouldContainSubstring, "Added alert notification item 1 in configuration doesn't contain required field name")
			So(errString, ShouldContainSubstring, "Added alert notification item 2 in configuration doesn't contain required field uid")
		})

		Convey("Empty yaml file", func() {
			Convey("should have not changed repo", func() {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(emptyFile)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}
				notificationsQuery := m.GetAllAlertNotificationsQuery{OrgId: 1}
				err = sqlstore.GetAllAlertNotifications(&notificationsQuery)
				So(err, ShouldBeNil)
				So(notificationsQuery.Result, ShouldBeEmpty)
			})
		})

		Convey("Broken yaml should return error", func() {
			reader := &configReader{log: log.New("test logger")}
			_, err := reader.readConfig(brokenYaml)
			So(err, ShouldNotBeNil)
		})

		Convey("Skip invalid directory", func() {
			cfgProvifer := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvifer.readConfig(emptyFolder)
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}
			So(len(cfg), ShouldEqual, 0)
		})

		Convey("Unknown notifier should return error", func() {
			cfgProvifer := &configReader{log: log.New("test logger")}
			_, err := cfgProvifer.readConfig(unknownNotifier)
			So(err, ShouldNotBeNil)
			So(err.Error(), ShouldEqual, "Unsupported notification type")
		})

		Convey("Read incorrect properties", func() {
			cfgProvifer := &configReader{log: log.New("test logger")}
			_, err := cfgProvifer.readConfig(incorrect_settings)
			So(err, ShouldNotBeNil)
			So(err.Error(), ShouldEqual, "Alert validation error: Could not find url property in settings")
		})
	})
}
