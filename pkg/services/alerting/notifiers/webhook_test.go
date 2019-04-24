package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestWebhookNotifier(t *testing.T) {
	Convey("Webhook notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "webhook",
					Settings: settingsJSON,
				}

				_, err := NewWebHookNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          "url": "http://google.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "webhook",
					Settings: settingsJSON,
				}

				not, err := NewWebHookNotifier(model)
				webhookNotifier := not.(*WebhookNotifier)

				So(err, ShouldBeNil)
				So(webhookNotifier.Name, ShouldEqual, "ops")
				So(webhookNotifier.Type, ShouldEqual, "webhook")
				So(webhookNotifier.Url, ShouldEqual, "http://google.com")
			})
		})
	})
}
