package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSlackNotifier(t *testing.T) {
	Convey("Slack notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				_, err = NewSlackNotifier(model)
				So(err, ShouldBeError, "alert validation error: Could not find url property in settings")
			})

			//nolint:goconst
			Convey("from settings", func() {
				json := `
				{
          "url": "http://google.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				not, err := NewSlackNotifier(model)
				slackNotifier := not.(*SlackNotifier)

				So(err, ShouldBeNil)
				So(slackNotifier.Name, ShouldEqual, "ops")
				So(slackNotifier.Type, ShouldEqual, "slack")
				So(slackNotifier.URL, ShouldEqual, "http://google.com")
				So(slackNotifier.Recipient, ShouldEqual, "")
				So(slackNotifier.Username, ShouldEqual, "")
				So(slackNotifier.IconEmoji, ShouldEqual, "")
				So(slackNotifier.IconURL, ShouldEqual, "")
				So(slackNotifier.MentionUsers, ShouldResemble, []string{})
				So(slackNotifier.MentionGroups, ShouldResemble, []string{})
				So(slackNotifier.MentionChannel, ShouldEqual, "")
				So(slackNotifier.Token, ShouldEqual, "")
			})

			Convey("from settings with Recipient, Username, IconEmoji, IconUrl, MentionUsers, MentionGroups, MentionChannel, and Token", func() {
				json := `
                    {
                      "url": "http://google.com",
                      "recipient": "#ds-opentsdb",
                      "username": "Grafana Alerts",
                      "icon_emoji": ":smile:",
                      "icon_url": "https://grafana.com/img/fav32.png",
                      "mentionUsers": "user1, user2",
                      "mentionGroups": "group1, group2",
                      "mentionChannel": "here",
                      "token": "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX"
                    }`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				not, err := NewSlackNotifier(model)
				slackNotifier := not.(*SlackNotifier)

				So(err, ShouldBeNil)
				So(slackNotifier.Name, ShouldEqual, "ops")
				So(slackNotifier.Type, ShouldEqual, "slack")
				So(slackNotifier.URL, ShouldEqual, "http://google.com")
				So(slackNotifier.Recipient, ShouldEqual, "#ds-opentsdb")
				So(slackNotifier.Username, ShouldEqual, "Grafana Alerts")
				So(slackNotifier.IconEmoji, ShouldEqual, ":smile:")
				So(slackNotifier.IconURL, ShouldEqual, "https://grafana.com/img/fav32.png")
				So(slackNotifier.MentionUsers, ShouldResemble, []string{"user1", "user2"})
				So(slackNotifier.MentionGroups, ShouldResemble, []string{"group1", "group2"})
				So(slackNotifier.MentionChannel, ShouldEqual, "here")
				So(slackNotifier.Token, ShouldEqual, "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX")
			})

			Convey("from settings with Recipient, Username, IconEmoji, IconUrl, MentionUsers, MentionGroups, MentionChannel, and Secured Token", func() {
				json := `
                    {
                      "url": "http://google.com",
                      "recipient": "#ds-opentsdb",
                      "username": "Grafana Alerts",
                      "icon_emoji": ":smile:",
                      "icon_url": "https://grafana.com/img/fav32.png",
                      "mentionUsers": "user1, user2",
                      "mentionGroups": "group1, group2",
                      "mentionChannel": "here",
                      "token": "uenc-XXXXXXXX-XXXXXXXX-XXXXXXXXXX"
                    }`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				securedSettingsJSON := securejsondata.GetEncryptedJsonData(map[string]string{
					"token": "xenc-XXXXXXXX-XXXXXXXX-XXXXXXXXXX",
				})
				So(err, ShouldBeNil)
				model := &models.AlertNotification{
					Name:           "ops",
					Type:           "slack",
					Settings:       settingsJSON,
					SecureSettings: securedSettingsJSON,
				}

				not, err := NewSlackNotifier(model)
				slackNotifier := not.(*SlackNotifier)

				So(err, ShouldBeNil)
				So(slackNotifier.Name, ShouldEqual, "ops")
				So(slackNotifier.Type, ShouldEqual, "slack")
				So(slackNotifier.URL, ShouldEqual, "http://google.com")
				So(slackNotifier.Recipient, ShouldEqual, "#ds-opentsdb")
				So(slackNotifier.Username, ShouldEqual, "Grafana Alerts")
				So(slackNotifier.IconEmoji, ShouldEqual, ":smile:")
				So(slackNotifier.IconURL, ShouldEqual, "https://grafana.com/img/fav32.png")
				So(slackNotifier.MentionUsers, ShouldResemble, []string{"user1", "user2"})
				So(slackNotifier.MentionGroups, ShouldResemble, []string{"group1", "group2"})
				So(slackNotifier.MentionChannel, ShouldEqual, "here")
				So(slackNotifier.Token, ShouldEqual, "xenc-XXXXXXXX-XXXXXXXX-XXXXXXXXXX")
			})

			Convey("with channel recipient with spaces should return an error", func() {
				json := `
                    {
                      "url": "http://google.com",
                      "recipient": "#open tsdb"
                    }`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				_, err = NewSlackNotifier(model)

				So(err, ShouldBeError, "alert validation error: Recipient on invalid format: \"#open tsdb\"")
			})

			Convey("with user recipient with spaces should return an error", func() {
				json := `
                    {
                      "url": "http://google.com",
                      "recipient": "@user name"
                    }`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				_, err = NewSlackNotifier(model)

				So(err, ShouldBeError, "alert validation error: Recipient on invalid format: \"@user name\"")
			})

			Convey("with user recipient with uppercase letters should return an error", func() {
				json := `
                    {
                      "url": "http://google.com",
                      "recipient": "@User"
                    }`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				_, err = NewSlackNotifier(model)

				So(err, ShouldBeError, "alert validation error: Recipient on invalid format: \"@User\"")
			})

			Convey("with Slack ID for recipient should work", func() {
				json := `
                    {
                      "url": "http://google.com",
                      "recipient": "1ABCDE"
                    }`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "slack",
					Settings: settingsJSON,
				}

				not, err := NewSlackNotifier(model)
				So(err, ShouldBeNil)
				slackNotifier := not.(*SlackNotifier)

				So(slackNotifier.Recipient, ShouldEqual, "1ABCDE")
			})
		})
	})
}
