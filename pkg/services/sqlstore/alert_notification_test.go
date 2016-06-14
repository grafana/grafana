package sqlstore

import (
	"fmt"
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertNotificationSQLAccess(t *testing.T) {
	Convey("Testing Alert notification sql access", t, func() {
		InitTestDB(t)
		var err error

		Convey("Alert notifications should be empty", func() {
			cmd := &m.GetAlertNotificationQuery{
				OrgID: FakeOrgId,
				Name:  "email",
			}

			err := AlertNotificationQuery(cmd)
			fmt.Printf("errror %v", err)
			So(err, ShouldBeNil)
			So(len(cmd.Result), ShouldEqual, 0)
		})

		Convey("Can save Alert Notification", func() {
			cmd := &m.CreateAlertNotificationCommand{
				Name: "ops",
				Type: "email",
			}

			err = CreateAlertNotificationCommand(cmd)
			So(err, ShouldBeNil)
			So(cmd.Result.Id, ShouldNotEqual, 0)

			Convey("Cannot save Alert Notification with the same name", func() {
				err = CreateAlertNotificationCommand(cmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Cannot update alert notification that does not exist", func() {
				newCmd := &m.UpdateAlertNotificationCommand{
					Name:  "NewName",
					Type:  cmd.Result.Type,
					OrgID: cmd.Result.OrgId,
					Id:    1337,
				}
				err = UpdateAlertNotification(newCmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Can update alert notification", func() {
				newCmd := &m.UpdateAlertNotificationCommand{
					Name:  "NewName",
					Type:  cmd.Result.Type,
					OrgID: cmd.Result.OrgId,
					Id:    cmd.Result.Id,
				}
				err = UpdateAlertNotification(newCmd)
				So(err, ShouldBeNil)
				So(newCmd.Result.Name, ShouldEqual, "NewName")
			})
		})
	})
}
