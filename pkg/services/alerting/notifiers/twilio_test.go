package notifiers

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"testing"
)

func TestNewTwilioNotifier(t *testing.T) {
	Convey("Twilio notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "twilio_testing",
					Type:     "twilio",
					Settings: settingsJSON,
				}

				_, err := NewTwilioNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          "clientId": "CLIENTID",
  		  "apiToken": "APITOKEN",
  		  "senderNumber": "+333666777888",
   		  "recipients": "+333666777999,+333444555666",
		  "sendOnlyFail": true,
          "sendMMS": true
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "twilio_testing",
					Type:     "twilio",
					Settings: settingsJSON,
				}

				not, err := NewTwilioNotifier(model)
				twilioNotifier := not.(*TwilioNotifier)

				So(err, ShouldBeNil)
				So(twilioNotifier.Name, ShouldEqual, "twilio_testing")
				So(twilioNotifier.Type, ShouldEqual, "twilio")
				So(twilioNotifier.ClientId, ShouldEqual, "CLIENTID")
				So(twilioNotifier.Recipients, ShouldResemble, []string{"+333666777999", "+333444555666"})
			})
		})
	})
}
