package notifications

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

type testTriggeredAlert struct {
	ActualValue float64
	Name        string
	State       string
}

func TestNotifications(t *testing.T) {

	Convey("Given the notifications service", t, func() {
		setting.StaticRootPath = "../../../public/"
		setting.Smtp.Enabled = true
		setting.Smtp.TemplatesPattern = "emails/*.html"
		setting.Smtp.FromAddress = "from@address.com"
		setting.Smtp.FromName = "Grafana Admin"

		ns := &NotificationService{}
		ns.Bus = bus.New()

		err := ns.Init()
		So(err, ShouldBeNil)

		Convey("When sending reset email password", func() {
			err := ns.sendResetPasswordEmail(&m.SendResetPasswordEmailCommand{User: &m.User{Email: "asd@asd.com"}})
			So(err, ShouldBeNil)

			sentMsg := <-ns.mailQueue
			So(sentMsg.Body, ShouldContainSubstring, "body")
			So(sentMsg.Subject, ShouldEqual, "Reset your Grafana password - asd@asd.com")
			So(sentMsg.Body, ShouldNotContainSubstring, "Subject")
		})
	})
}
