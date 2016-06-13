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

		Convey("Alert notifications should be empty", func() {
			cmd := &m.GetAlertNotificationQuery{
				OrgID: FakeOrgId,
				Name:  "email",
			}

			err := GetAlertNotifications(cmd)
			fmt.Printf("errror %v", err)
			So(err, ShouldBeNil)
			So(len(cmd.Result), ShouldEqual, 0)
		})
		/*
			Convey("Can save Alert Notification", func() {
				cmd := &m.CreateAlertNotificationCommand{}

				var err error
				err = CreateAlertNotification(cmd)

				So(err, ShouldBeNil)
			}) */
	})
}
