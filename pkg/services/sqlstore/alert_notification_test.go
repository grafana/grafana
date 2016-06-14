package sqlstore

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
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
				Name:     "ops",
				Type:     "email",
				OrgID:    1,
				Settings: simplejson.New(),
			}

			err = CreateAlertNotificationCommand(cmd)
			So(err, ShouldBeNil)
			So(cmd.Result.Id, ShouldNotEqual, 0)
			So(cmd.Result.OrgId, ShouldNotEqual, 0)
			So(cmd.Result.Type, ShouldEqual, "email")

			Convey("Cannot save Alert Notification with the same name", func() {
				err = CreateAlertNotificationCommand(cmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Can update alert notification", func() {
				newCmd := &m.UpdateAlertNotificationCommand{
					Name:     "NewName",
					Type:     "webhook",
					OrgID:    cmd.Result.OrgId,
					Settings: simplejson.New(),
					Id:       cmd.Result.Id,
				}
				err := UpdateAlertNotification(newCmd)
				So(err, ShouldBeNil)
				So(newCmd.Result.Name, ShouldEqual, "NewName")
			})
		})

		Convey("Can search using an array of ids", func() {
			So(CreateAlertNotificationCommand(&m.CreateAlertNotificationCommand{
				Name:     "ops2",
				Type:     "email",
				OrgID:    1,
				Settings: simplejson.New(),
			}), ShouldBeNil)

			So(CreateAlertNotificationCommand(&m.CreateAlertNotificationCommand{
				Name:     "slack",
				Type:     "webhook",
				OrgID:    1,
				Settings: simplejson.New(),
			}), ShouldBeNil)

			Convey("search", func() {
				query := &m.GetAlertNotificationQuery{
					Ids:   []int64{1, 2, 3},
					OrgID: 1,
				}

				err := AlertNotificationQuery(query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 2)
			})
		})
	})
}
