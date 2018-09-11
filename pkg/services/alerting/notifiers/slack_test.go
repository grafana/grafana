package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSlackNotifier(t *testing.T) {
	Convey("Slack notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				_, err := NewSlackNotifier(model)
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
					Type:     "slack",
					Settings: settingsJSON,
				}

				not, err := NewSlackNotifier(model)
				slackNotifier := not.(*SlackNotifier)

				So(err, ShouldBeNil)
				So(slackNotifier.Name, ShouldEqual, "ops")
				So(slackNotifier.Type, ShouldEqual, "slack")
				So(slackNotifier.Url, ShouldEqual, "http://google.com")
				So(slackNotifier.Recipient, ShouldEqual, "")
				So(slackNotifier.Mention, ShouldEqual, "")
				So(slackNotifier.Token, ShouldEqual, "")
			})

			Convey("from settings with Recipient, Mention, and Token", func() {
				json := `
				{
          "url": "http://google.com",
          "recipient": "#ds-opentsdb",
          "mention": "@carl",
          "token": "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				not, err := NewSlackNotifier(model)
				slackNotifier := not.(*SlackNotifier)

				So(err, ShouldBeNil)
				So(slackNotifier.Name, ShouldEqual, "ops")
				So(slackNotifier.Type, ShouldEqual, "slack")
				So(slackNotifier.Url, ShouldEqual, "http://google.com")
				So(slackNotifier.Recipient, ShouldEqual, "#ds-opentsdb")
				So(slackNotifier.Mention, ShouldEqual, "@carl")
				So(slackNotifier.Token, ShouldEqual, "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX")
			})
		})
	})
}
