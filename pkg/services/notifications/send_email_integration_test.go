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
		setting.Smtp.FromName = "Grafana Admin"
		setting.BuildVersion = "4.0.0"

		err := Init()
		So(err, ShouldBeNil)

		addToMailQueue = func(msg *Message) {
			So(msg.From, ShouldEqual, "Grafana Admin <from@address.com>")
			So(msg.To[0], ShouldEqual, "asdf@asdf.com")
			ioutil.WriteFile("../../../tmp/test_email.html", []byte(msg.Body), 0777)
		}

		Convey("When sending reset email password", func() {
			cmd := &m.SendEmailCommand{

				Data: map[string]interface{}{
					"Title":         "[CRITICAL] Imaginary timeserie alert",
					"State":         "Firing",
					"Name":          "Imaginary timeserie alert",
					"Severity":      "ok",
					"SeverityColor": "#D63232",
					"Message":       "Alert message that will support markdown in some distant future.",
					"RuleUrl":       "http://localhost:3000/dashboard/db/graphite-dashboard",
					"ImageLink":     "http://localhost:3000/render/dashboard-solo/db/graphite-dashboard?panelId=1&from=1471008499616&to=1471012099617&width=1000&height=500",
					"AlertPageUrl":  "http://localhost:3000/alerting",
					"EmbededImage":  "test.png",
					"EvalMatches": []map[string]string{
						{
							"Metric": "desktop",
							"Value":  "40",
						},
						{
							"Metric": "mobile",
							"Value":  "20",
						},
					},
				},
				To:       []string{"asdf@asdf.com"},
				Template: "alert_notification.html",
			}

			err := sendEmailCommandHandler(cmd)
			So(err, ShouldBeNil)
		})
	})
}
