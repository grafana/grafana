package alert_notifications

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/notifiers"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	logger = log.New("fake.log")

	correct_properties              = "./test-configs/correct-properties"
	incorrect_properties            = "./test-configs/incorrect-properties"
	correct_properties_with_orgName = "./test-configs/correct-properties-with-orgName"
	brokenYaml                      = "./test-configs/broken-yaml"
	doubleNotificationsConfig       = "./test-configs/double-default"
	emptyFolder                     = "./test-configs/empty_folder"
	emptyFile                       = "./test-configs/empty"
	twoNotificationsConfig          = "./test-configs/two-notifications"
	unknownNotifier                 = "./test-configs/unknown-notifier"

	fakeRepo *fakeRepository
)

func TestNotificationAsConfig(t *testing.T) {
	Convey("Testing notification as configuration", t, func() {
		fakeRepo = &fakeRepository{}
		bus.ClearBusHandlers()
		bus.AddHandler("test", mockDelete)
		bus.AddHandler("test", mockInsert)
		bus.AddHandler("test", mockUpdate)
		bus.AddHandler("test", mockGet)
		bus.AddHandler("test", mockGetOrg)

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
			cfgProvifer := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvifer.readConfig(correct_properties)
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
			So(nt.IsDefault, ShouldBeTrue)
			So(nt.Settings, ShouldResemble, map[string]interface{}{
				"recipient": "XXX", "token": "xoxb", "uploadImage": true, "url": "https://slack.com",
			})

			nt = nts[1]
			So(nt.Name, ShouldEqual, "another-not-default-notification")
			So(nt.Type, ShouldEqual, "email")
			So(nt.OrgId, ShouldEqual, 3)
			So(nt.IsDefault, ShouldBeFalse)

			nt = nts[2]
			So(nt.Name, ShouldEqual, "check-unset-is_default-is-false")
			So(nt.Type, ShouldEqual, "slack")
			So(nt.OrgId, ShouldEqual, 3)
			So(nt.IsDefault, ShouldBeFalse)

			nt = nts[3]
			So(nt.Name, ShouldEqual, "Added notification with whitespaces in name")
			So(nt.Type, ShouldEqual, "email")
			So(nt.OrgId, ShouldEqual, 3)

			deleteNts := ntCfg.DeleteNotifications
			So(len(deleteNts), ShouldEqual, 4)

			deleteNt := deleteNts[0]
			So(deleteNt.Name, ShouldEqual, "default-slack-notification")
			So(deleteNt.OrgId, ShouldEqual, 2)

			deleteNt = deleteNts[1]
			So(deleteNt.Name, ShouldEqual, "deleted-notification-without-orgId")
			So(deleteNt.OrgId, ShouldEqual, 1)

			deleteNt = deleteNts[2]
			So(deleteNt.Name, ShouldEqual, "deleted-notification-with-0-orgId")
			So(deleteNt.OrgId, ShouldEqual, 1)

			deleteNt = deleteNts[3]
			So(deleteNt.Name, ShouldEqual, "Deleted notification with whitespaces in name")
			So(deleteNt.OrgId, ShouldEqual, 1)
		})

		Convey("One configured notification", func() {
			Convey("no notification in database", func() {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(twoNotificationsConfig)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}
				So(len(fakeRepo.deleted), ShouldEqual, 0)
				So(len(fakeRepo.inserted), ShouldEqual, 2)
				So(len(fakeRepo.updated), ShouldEqual, 0)
			})
			Convey("One notification in database with same name", func() {
				fakeRepo.loadAll = []*models.AlertNotification{
					{Name: "channel1", OrgId: 1, Id: 1},
				}
				Convey("should update one notification", func() {
					dc := newNotificationProvisioner(logger)
					err := dc.applyChanges(twoNotificationsConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}
					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 1)
				})
			})
			Convey("Two notifications with is_default", func() {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(doubleNotificationsConfig)
				Convey("should both be inserted", func() {
					So(err, ShouldBeNil)
					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 2)
					So(len(fakeRepo.updated), ShouldEqual, 0)
				})
			})
		})

		Convey("Two configured notification", func() {
			Convey("two other notifications in database", func() {
				fakeRepo.loadAll = []*models.AlertNotification{
					{Name: "channel1", OrgId: 1, Id: 1},
					{Name: "channel3", OrgId: 1, Id: 2},
				}
				Convey("should have two new notifications", func() {
					dc := newNotificationProvisioner(logger)
					err := dc.applyChanges(twoNotificationsConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}
					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 1)
				})
			})
		})

		Convey("Can read correct properties with orgName instead of orgId", func() {
			fakeRepo.loadAllOrg = []*models.Org{
				{Name: "Main Org. 1", Id: 1},
				{Name: "Main Org. 2", Id: 2},
			}

			fakeRepo.loadAll = []*models.AlertNotification{
				{Name: "default-slack-notification", OrgId: 1, Id: 1},
				{Name: "another-not-default-notification", OrgId: 2, Id: 2},
			}
			dc := newNotificationProvisioner(logger)
			err := dc.applyChanges(correct_properties_with_orgName)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}
			So(len(fakeRepo.deleted), ShouldEqual, 2)
			So(len(fakeRepo.inserted), ShouldEqual, 0)
			So(len(fakeRepo.updated), ShouldEqual, 2)
			updated := fakeRepo.updated
			nt := updated[0]
			So(nt.Name, ShouldEqual, "default-slack-notification")
			So(nt.OrgId, ShouldEqual, 1)

			nt = updated[1]
			So(nt.Name, ShouldEqual, "another-not-default-notification")
			So(nt.OrgId, ShouldEqual, 2)

		})

		Convey("Empty yaml file", func() {
			Convey("should have not changed repo", func() {
				dc := newNotificationProvisioner(logger)
				err := dc.applyChanges(emptyFile)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}
				So(len(fakeRepo.deleted), ShouldEqual, 0)
				So(len(fakeRepo.inserted), ShouldEqual, 0)
				So(len(fakeRepo.updated), ShouldEqual, 0)
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
			So(err, ShouldEqual, ErrInvalidNotifierType)
		})

		Convey("Read incorrect properties", func() {
			cfgProvifer := &configReader{log: log.New("test logger")}
			_, err := cfgProvifer.readConfig(incorrect_properties)
			So(err, ShouldNotBeNil)
			So(err.Error(), ShouldEqual, "Alert validation error: Could not find url property in settings")
		})

	})
}

type fakeRepository struct {
	inserted   []*models.CreateAlertNotificationCommand
	deleted    []*models.DeleteAlertNotificationCommand
	updated    []*models.UpdateAlertNotificationCommand
	loadAll    []*models.AlertNotification
	loadAllOrg []*models.Org
}

func mockDelete(cmd *models.DeleteAlertNotificationCommand) error {
	fakeRepo.deleted = append(fakeRepo.deleted, cmd)
	return nil
}
func mockUpdate(cmd *models.UpdateAlertNotificationCommand) error {
	fakeRepo.updated = append(fakeRepo.updated, cmd)
	return nil
}
func mockInsert(cmd *models.CreateAlertNotificationCommand) error {
	fakeRepo.inserted = append(fakeRepo.inserted, cmd)
	return nil
}
func mockGet(cmd *models.GetAlertNotificationsQuery) error {
	for _, v := range fakeRepo.loadAll {
		if cmd.Name == v.Name && cmd.OrgId == v.OrgId {
			cmd.Result = v
			return nil
		}
	}
	return nil
}
func mockGetOrg(cmd *models.GetOrgByNameQuery) error {
	for _, v := range fakeRepo.loadAllOrg {
		if cmd.Name == v.Name {
			cmd.Result = v
			return nil
		}
	}
	return nil
}
