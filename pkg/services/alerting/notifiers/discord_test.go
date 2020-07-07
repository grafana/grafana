package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDiscordNotifier(t *testing.T) {
	Convey("Telegram notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "discord_testing",
					Type:     "discord",
					Settings: settingsJSON,
				}

				_, err := newDiscordNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings should trigger incident", func() {
				json := `
				{
					"content": "@everyone Please check this notification",
					"url": "https://web.hook/"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "discord_testing",
					Type:     "discord",
					Settings: settingsJSON,
				}

				not, err := newDiscordNotifier(model)
				discordNotifier := not.(*DiscordNotifier)

				So(err, ShouldBeNil)
				So(discordNotifier.Name, ShouldEqual, "discord_testing")
				So(discordNotifier.Type, ShouldEqual, "discord")
				So(discordNotifier.Content, ShouldEqual, "@everyone Please check this notification")
				So(discordNotifier.WebhookURL, ShouldEqual, "https://web.hook/")
			})
		})
	})
}
