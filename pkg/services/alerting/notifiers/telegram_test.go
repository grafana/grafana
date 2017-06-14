package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTelegramNotifier(t *testing.T) {
	Convey("Telegram notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "telegram_testing",
					Type:     "telegram",
					Settings: settingsJSON,
				}

				_, err := NewTelegramNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings should trigger incident", func() {
				json := `
				{
          "bottoken": "abcdefgh0123456789",
					"chatid": "-1234567890"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "telegram_testing",
					Type:     "telegram",
					Settings: settingsJSON,
				}

				not, err := NewTelegramNotifier(model)
				telegramNotifier := not.(*TelegramNotifier)

				So(err, ShouldBeNil)
				So(telegramNotifier.Name, ShouldEqual, "telegram_testing")
				So(telegramNotifier.Type, ShouldEqual, "telegram")
				So(telegramNotifier.BotToken, ShouldEqual, "abcdefgh0123456789")
				So(telegramNotifier.ChatID, ShouldEqual, "-1234567890")
			})

		})
	})
}
