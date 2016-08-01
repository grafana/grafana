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
		bus.ClearBusHandlers()

		setting.StaticRootPath = "../../../public/"
		setting.Smtp.Enabled = true
		setting.Smtp.TemplatesPattern = "emails/*.html"
		setting.Smtp.FromAddress = "from@address.com"

		err := Init()
		So(err, ShouldBeNil)

		var sentMsg *Message
		addToMailQueue = func(msg *Message) {
			sentMsg = msg
		}

		Convey("When sending reset email password", func() {
			err := sendResetPasswordEmail(&m.SendResetPasswordEmailCommand{User: &m.User{Email: "asd@asd.com"}})
			So(err, ShouldBeNil)
			So(sentMsg.Body, ShouldContainSubstring, "body")
			So(sentMsg.Subject, ShouldEqual, "Reset your Grafana password - asd@asd.com")
			So(sentMsg.Body, ShouldNotContainSubstring, "Subject")
		})

		Convey("Alert notifications", func() {
			// Convey("When sending reset email password", func() {
			// 	cmd := &m.SendEmailCommand{
			// 		Data: map[string]interface{}{
			// 			"Name":           "Name",
			// 			"State":          "Critical",
			// 			"Description":    "Description",
			// 			"DashboardLink":  "http://localhost:3000/dashboard/db/alerting",
			// 			"AlertPageUrl":   "http://localhost:3000/alerting",
			// 			"DashboardImage": "http://localhost:3000/render/dashboard-solo/db/alerting?from=1466169458375&to=1466171258375&panelId=1&width=1000&height=500",
			// 			"TriggeredAlerts": []testTriggeredAlert{
			// 				{Name: "desktop", State: "Critical", ActualValue: 13},
			// 				{Name: "mobile", State: "Warn", ActualValue: 5},
			// 			},
			// 		},
			// 		To:       []string{"asd@asd.com "},
			// 		Template: "alert_notification.html",
			// 	}
			//
			// 	err := sendEmailCommandHandler(cmd)
			// 	So(err, ShouldBeNil)
			//
			// 	So(sentMsg.Body, ShouldContainSubstring, "Alertstate: Critical")
			// 	So(sentMsg.Body, ShouldContainSubstring, "http://localhost:3000/dashboard/db/alerting")
			// 	So(sentMsg.Body, ShouldContainSubstring, "Critical")
			// 	So(sentMsg.Body, ShouldContainSubstring, "Warn")
			// 	So(sentMsg.Body, ShouldContainSubstring, "mobile")
			// 	So(sentMsg.Body, ShouldContainSubstring, "desktop")
			// 	So(sentMsg.Subject, ShouldContainSubstring, "Grafana Alert: [ Critical ] ")
			// })
			//
			// Convey("given critical", func() {
			// 	cmd := &m.SendEmailCommand{
			// 		Data: map[string]interface{}{
			// 			"Name":           "Name",
			// 			"State":          "Warn",
			// 			"Description":    "Description",
			// 			"DashboardLink":  "http://localhost:3000/dashboard/db/alerting",
			// 			"DashboardImage": "http://localhost:3000/render/dashboard-solo/db/alerting?from=1466169458375&to=1466171258375&panelId=1&width=1000&height=500",
			// 			"AlertPageUrl":   "http://localhost:3000/alerting",
			// 			"TriggeredAlerts": []testTriggeredAlert{
			// 				{Name: "desktop", State: "Critical", ActualValue: 13},
			// 				{Name: "mobile", State: "Warn", ActualValue: 5},
			// 			},
			// 		},
			// 		To:       []string{"asd@asd.com "},
			// 		Template: "alert_notification.html",
			// 	}
			//
			// 	err := sendEmailCommandHandler(cmd)
			// 	So(err, ShouldBeNil)
			// 	So(sentMsg.Body, ShouldContainSubstring, "Alertstate: Warn")
			// 	So(sentMsg.Body, ShouldContainSubstring, "http://localhost:3000/dashboard/db/alerting")
			// 	So(sentMsg.Body, ShouldContainSubstring, "Critical")
			// 	So(sentMsg.Body, ShouldContainSubstring, "Warn")
			// 	So(sentMsg.Body, ShouldContainSubstring, "mobile")
			// 	So(sentMsg.Body, ShouldContainSubstring, "desktop")
			// 	So(sentMsg.Subject, ShouldContainSubstring, "Grafana Alert: [ Warn ]")
			// })
			//
			// Convey("given ok", func() {
			// 	cmd := &m.SendEmailCommand{
			// 		Data: map[string]interface{}{
			// 			"Name":          "Name",
			// 			"State":         "Ok",
			// 			"Description":   "Description",
			// 			"DashboardLink": "http://localhost:3000/dashboard/db/alerting",
			// 			"AlertPageUrl":  "http://localhost:3000/alerting",
			// 		},
			// 		To:       []string{"asd@asd.com "},
			// 		Template: "alert_notification.html",
			// 	}
			//
			// 	err := sendEmailCommandHandler(cmd)
			// 	So(err, ShouldBeNil)
			// 	So(sentMsg.Subject, ShouldContainSubstring, "Grafana Alert: [ Ok ]")
			// })
		})
	})
}
