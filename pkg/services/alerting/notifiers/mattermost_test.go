package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMattermostNotifier(t *testing.T) {
	Convey("Mattermost notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "mattermost",
					Settings: settingsJSON,
				}

				_, err := NewMattermostNotifier(model)
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
					Type:     "mattermost",
					Settings: settingsJSON,
				}

				not, err := NewMattermostNotifier(model)
				mattermostNotifier := not.(*MattermostNotifier)

				So(err, ShouldBeNil)
				So(mattermostNotifier.Name, ShouldEqual, "ops")
				So(mattermostNotifier.Type, ShouldEqual, "mattermost")
				So(mattermostNotifier.Url, ShouldEqual, "http://google.com")
				So(mattermostNotifier.Recipient, ShouldEqual, "")
				So(mattermostNotifier.Mention, ShouldEqual, "")
				So(mattermostNotifier.Token, ShouldEqual, "")
			})

			Convey("from settings with Recipient, Mention, and Token", func() {
				json := `
				{
          "url": "http://google.com",
		  "team_name": "test",	
          "recipient": "ds-opentsdb",
          "mention": "@test",
          "token": "XXXXXXXX-XXXXXXXX-XXXXXXXXXX"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "ops",
					Type:     "mattermost",
					Settings: settingsJSON,
				}

				not, err := NewMattermostNotifier(model)
				mattermostNotifier := not.(*MattermostNotifier)

				So(err, ShouldBeNil)
				So(mattermostNotifier.Name, ShouldEqual, "ops")
				So(mattermostNotifier.Type, ShouldEqual, "mattermost")
				So(mattermostNotifier.Url, ShouldEqual, "http://google.com")
				So(mattermostNotifier.TeamName, ShouldEqual, "test")
				So(mattermostNotifier.Recipient, ShouldEqual, "ds-opentsdb")
				So(mattermostNotifier.Mention, ShouldEqual, "@test")
				So(mattermostNotifier.Token, ShouldEqual, "XXXXXXXX-XXXXXXXX-XXXXXXXXXX")
			})
		})
	})
}
