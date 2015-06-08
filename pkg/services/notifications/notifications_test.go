package notifications

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestNotifications(t *testing.T) {

	Convey("Given the notifications service", t, func() {
		bus.ClearBusHandlers()

		setting.StaticRootPath = "../../../public/"
		setting.Smtp.FromAddress = "from@address.com"

		err := Init()
		So(err, ShouldBeNil)

		var sentMail *m.SendEmailCommand
		dispatchMail = func(cmd *m.SendEmailCommand) error {
			sentMail = cmd
			return nil
		}

		Convey("When sending reset email password", func() {
			sendResetPasswordEmail(&m.SendResetPasswordEmailCommand{User: &m.User{Email: "asd@asd.com"}})
			So(sentMail.Body, ShouldContainSubstring, "body")
			So(sentMail.Subject, ShouldEqual, "Reset your Grafana password")
			So(sentMail.Body, ShouldNotContainSubstring, "Subject")
		})
	})

}
