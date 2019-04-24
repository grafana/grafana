package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestGoogleChatNotifier(t *testing.T) {
	Convey("Google Hangouts Chat notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "googlechat",
					Settings: settingsJSON,
				}

				_, err := NewGoogleChatNotifier(model)
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
					Type:     "googlechat",
					Settings: settingsJSON,
				}

				not, err := NewGoogleChatNotifier(model)
				webhookNotifier := not.(*GoogleChatNotifier)

				So(err, ShouldBeNil)
				So(webhookNotifier.Name, ShouldEqual, "ops")
				So(webhookNotifier.Type, ShouldEqual, "googlechat")
				So(webhookNotifier.Url, ShouldEqual, "http://google.com")
			})

		})
	})
}
