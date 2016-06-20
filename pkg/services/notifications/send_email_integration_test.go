package notifications

import (
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestEmailIntegrationTest(t *testing.T) {
	SkipConvey("Given the notifications service", t, func() {
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
			ioutil.WriteFile("../../../tmp/test_email.html", []byte(msg.Body), 0777)
		}

		Convey("When sending reset email password", func() {
			cmd := &m.SendEmailCommand{

				Data: map[string]interface{}{
					"Name":           "Name",
					"State":          "Critical",
					"Description":    "Description",
					"DashboardLink":  "http://localhost:3000/dashboard/db/alerting",
					"AlertPageUrl":   "http://localhost:3000/alerting",
					"DashboardImage": "http://localhost:3000/render/dashboard-solo/db/alerting?from=1466169458375&to=1466171258375&panelId=3&width=1000&height=500",

					"TriggeredAlerts": []testTriggeredAlert{
						{Name: "desktop", State: "Critical", ActualValue: 13},
						{Name: "mobile", State: "Warn", ActualValue: 5},
					},
				},
				To:       []string{"asd@asd.com "},
				Template: "alert_notification.html",
			}

			err := sendEmailCommandHandler(cmd)
			So(err, ShouldBeNil)
		})
	})
}
