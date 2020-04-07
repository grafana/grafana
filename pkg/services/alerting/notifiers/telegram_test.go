package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTelegramNotifier(t *testing.T) {
	Convey("Telegram notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
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
				model := &models.AlertNotification{
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
						State:   models.AlertStateOK,
					})

				caption := generateImageCaption(evalContext, "http://grafa.url/abcdef", "")
				So(len(caption), ShouldBeLessThanOrEqualTo, 1024)
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
							State:   models.AlertStateOK,
						})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/abcdefaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						"foo bar")
					So(len(caption), ShouldBeLessThanOrEqualTo, 1024)
					So(caption, ShouldContainSubstring, "Some kind of message.")
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldContainSubstring, "foo bar")
					So(caption, ShouldNotContainSubstring, "http")
				})

				Convey("Message should be trimmed if it's too long", func() {
					evalContext := alerting.NewEvalContext(context.Background(),
						&alerting.Rule{
							Name:    "This is an alarm",
							Message: "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise I will. Yes siree that's it. But suddenly Telegram increased the length so now we need some lorem ipsum to fix this test. Here we go: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus consectetur molestie cursus. Donec suscipit egestas nisi. Proin ut efficitur ex. Mauris mi augue, volutpat a nisi vel, euismod dictum arcu. Sed quis tempor eros, sed malesuada dolor. Ut orci augue, viverra sit amet blandit quis, faucibus sit amet ex. Duis condimentum efficitur lectus, id dignissim quam tempor id. Morbi sollicitudin rhoncus diam, id tincidunt lectus scelerisque vitae. Etiam imperdiet semper sem, vel eleifend ligula mollis eget. Etiam ultrices fringilla lacus, sit amet pharetra ex blandit quis. Suspendisse in egestas neque, et posuere lectus. Vestibulum eu ex dui. Sed molestie nulla a lobortis scelerisque. Nulla ipsum ex, iaculis vitae vehicula sit amet, fermentum eu eros.",
							State:   models.AlertStateOK,
						})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/foo",
						"")
					So(len(caption), ShouldBeLessThanOrEqualTo, 1024)
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldNotContainSubstring, "http")
					So(caption, ShouldContainSubstring, "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise I will. Yes siree that's it. But suddenly Telegram increased the length so now we need some lorem ipsum to fix this test. Here we go: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus consectetur molestie cursus. Donec suscipit egestas nisi. Proin ut efficitur ex. Mauris mi augue, volutpat a nisi vel, euismod dictum arcu. Sed quis tempor eros, sed malesuada dolor. Ut orci augue, viverra sit amet blandit quis, faucibus sit amet ex. Duis condimentum efficitur lectus, id dignissim quam tempor id. Morbi sollicitudin rhoncus diam, id tincidunt lectus scelerisque vitae. Etiam imperdiet semper sem, vel eleifend ligula mollis eget. Etiam ultrices fringilla lacus, sit amet pharetra ex blandit quis. Suspendisse in egestas neque, et posuere lectus. Vestibulum eu ex dui. Sed molestie nulla a lobortis sceleri")
				})

				Convey("Metrics should be skipped if they don't fit", func() {
					evalContext := alerting.NewEvalContext(context.Background(),
						&alerting.Rule{
							Name:    "This is an alarm",
							Message: "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise I will. Yes siree that's it. But suddenly Telegram increased the length so now we need some lorem ipsum to fix this test. Here we go: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus consectetur molestie cursus. Donec suscipit egestas nisi. Proin ut efficitur ex. Mauris mi augue, volutpat a nisi vel, euismod dictum arcu. Sed quis tempor eros, sed malesuada dolor. Ut orci augue, viverra sit amet blandit quis, faucibus sit amet ex. Duis condimentum efficitur lectus, id dignissim quam tempor id. Morbi sollicitudin rhoncus diam, id tincidunt lectus scelerisque vitae. Etiam imperdiet semper sem, vel eleifend ligula mollis eget. Etiam ultrices fringilla lacus, sit amet pharetra ex blandit quis. Suspendisse in egestas neque, et posuere lectus. Vestibulum eu ex dui. Sed molestie nulla a lobortis sceleri",
							State:   models.AlertStateOK,
						})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/foo",
						"foo bar long song")
					So(len(caption), ShouldBeLessThanOrEqualTo, 1024)
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldNotContainSubstring, "http")
					So(caption, ShouldNotContainSubstring, "foo bar")
				})
			})
		})
	})
}
