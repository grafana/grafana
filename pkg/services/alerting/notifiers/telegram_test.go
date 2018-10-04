package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
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

			Convey("generateCaption should generate a message with all pertinent details", func() {
				evalContext := alerting.NewEvalContext(context.Background(),
					&alerting.Rule{
						Name:    "This is an alarm",
						Message: "Some kind of message.",
						State:   m.AlertStateOK,
					})

				caption := generateImageCaption(evalContext, "http://grafa.url/abcdef", "")
				So(len(caption), ShouldBeLessThanOrEqualTo, 200)
				So(caption, ShouldContainSubstring, "Some kind of message.")
				So(caption, ShouldContainSubstring, "[OK] This is an alarm")
				So(caption, ShouldContainSubstring, "http://grafa.url/abcdef")
			})

			Convey("When generating a message", func() {

				Convey("URL should be skipped if it's too long", func() {
					evalContext := alerting.NewEvalContext(context.Background(),
						&alerting.Rule{
							Name:    "This is an alarm",
							Message: "Some kind of message.",
							State:   m.AlertStateOK,
						})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/abcdefaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						"foo bar")
					So(len(caption), ShouldBeLessThanOrEqualTo, 200)
					So(caption, ShouldContainSubstring, "Some kind of message.")
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldContainSubstring, "foo bar")
					So(caption, ShouldNotContainSubstring, "http")
				})

				Convey("Message should be trimmed if it's too long", func() {
					evalContext := alerting.NewEvalContext(context.Background(),
						&alerting.Rule{
							Name:    "This is an alarm",
							Message: "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise I will. Yes siree that's it.",
							State:   m.AlertStateOK,
						})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/foo",
						"")
					So(len(caption), ShouldBeLessThanOrEqualTo, 200)
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldNotContainSubstring, "http")
					So(caption, ShouldContainSubstring, "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise ")
				})

				Convey("Metrics should be skipped if they don't fit", func() {
					evalContext := alerting.NewEvalContext(context.Background(),
						&alerting.Rule{
							Name:    "This is an alarm",
							Message: "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I ",
							State:   m.AlertStateOK,
						})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/foo",
						"foo bar long song")
					So(len(caption), ShouldBeLessThanOrEqualTo, 200)
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldNotContainSubstring, "http")
					So(caption, ShouldNotContainSubstring, "foo bar")
				})
			})
		})
	})
}
