package alert_notifications

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"

	. "github.com/smartystreets/goconvey/convey"
)

var (
	logger = log.New("fake.log")

	allProperties             = "./test-configs/all-properties"
	brokenYaml                = "./test-configs/broken-yaml"
	doubleNotificationsConfig = "./test-configs/double-default"
	emptyFolder               = "./test-configs/empty"
	twoNotificationsConfig    = "./test-configs/two-notifications"
	unknownNotifier           = "./test-configs/unknown-notifier"

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

		alerting.RegisterNotifier(&alerting.NotifierPlugin{
			Type: "slack",
			Name: "slack",
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
				Convey("should raise error", func() {
					So(err, ShouldEqual, ErrInvalidConfigTooManyDefault)
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

		Convey("Can read all properties", func() {
			cfgProvifer := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvifer.readConfig(allProperties)
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 1)

			ntCfg := cfg[0]

			nt := ntCfg.Notifications[0]
			So(nt.Name, ShouldEqual, "notification-channel-1")
			So(nt.Type, ShouldEqual, "slack")
			So(nt.OrgId, ShouldEqual, 2)
			So(nt.IsDefault, ShouldBeTrue)
			So(nt.Settings, ShouldResemble, map[string]interface{}{
				"recipient": "XXX", "token": "xoxb", "uploadImage": true,
			})

			So(len(ntCfg.DeleteNotifications), ShouldEqual, 2)

			// `orgId` must be set
			deleteNt := ntCfg.DeleteNotifications[0]
			So(deleteNt.Name, ShouldEqual, "notification-channel-1")
			So(deleteNt.OrgId, ShouldEqual, 2)

			// `orgId` must be the default
			deleteNt = ntCfg.DeleteNotifications[1]
			So(deleteNt.Name, ShouldEqual, "notification-channel-2")
			So(deleteNt.OrgId, ShouldEqual, 1)
		})
	})

}

type fakeRepository struct {
	inserted []*models.CreateAlertNotificationCommand
	deleted  []*models.DeleteAlertNotificationByNameCommand
	updated  []*models.UpdateAlertNotificationCommand

	loadAll []*models.AlertNotification
}

func mockDelete(cmd *models.DeleteAlertNotificationByNameCommand) error {
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
