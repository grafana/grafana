package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func TestTelegramNotifier(t *testing.T) {
	t.Run("Telegram notifier tests", func(t *testing.T) {
		t.Run("Parsing alert notification from settings", func(t *testing.T) {
			t.Run("empty settings should return error", func(t *testing.T) {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "telegram_testing",
					Type:     "telegram",
					Settings: settingsJSON,
				}

				_, err := NewTelegramNotifier(model)
				require.Error(t, err)
			})

			t.Run("settings should trigger incident", func(t *testing.T) {
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

				require.NoError(t, err)
				require.Equal(t, "telegram_testing", telegramNotifier.Name)
				require.Equal(t, "telegram", telegramNotifier.Type)
				require.Equal(t, "abcdefgh0123456789", telegramNotifier.BotToken)
				require.Equal(t, "-1234567890", telegramNotifier.ChatID)
			})

			t.Run("generateCaption should generate a message with all pertinent details", func(t *testing.T) {
				evalContext := alerting.NewEvalContext(context.Background(),
					&alerting.Rule{
						Name:    "This is an alarm",
						Message: "Some kind of message.",
						State:   models.AlertStateOK,
					}, &validations.OSSPluginRequestValidator{})

				caption := generateImageCaption(evalContext, "http://grafa.url/abcdef", "")
				So(len(caption), ShouldBeLessThanOrEqualTo, 1024)
				require.Contains(t, caption, "Some kind of message.")
				require.Contains(t, caption, "[OK] This is an alarm")
				require.Contains(t, caption, "http://grafa.url/abcdef")
			})

			t.Run("When generating a message", func(t *testing.T) {
				t.Run("URL should be skipped if it's too long", func(t *testing.T) {
					evalContext := alerting.NewEvalContext(context.Background(),
						&alerting.Rule{
							Name:    "This is an alarm",
							Message: "Some kind of message.",
							State:   models.AlertStateOK,
						}, &validations.OSSPluginRequestValidator{})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/abcdefaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						"foo bar")
					So(len(caption), ShouldBeLessThanOrEqualTo, 1024)
					require.Contains(t, caption, "Some kind of message.")
					require.Contains(t, caption, "[OK] This is an alarm")
					require.Contains(t, caption, "foo bar")
					So(caption, ShouldNotContainSubstring, "http")
				})

				t.Run("Message should be trimmed if it's too long", func(t *testing.T) {
					evalContext := alerting.NewEvalContext(context.Background(),
						&alerting.Rule{
							Name:    "This is an alarm",
							Message: "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise I will. Yes siree that's it. But suddenly Telegram increased the length so now we need some lorem ipsum to fix this test. Here we go: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus consectetur molestie cursus. Donec suscipit egestas nisi. Proin ut efficitur ex. Mauris mi augue, volutpat a nisi vel, euismod dictum arcu. Sed quis tempor eros, sed malesuada dolor. Ut orci augue, viverra sit amet blandit quis, faucibus sit amet ex. Duis condimentum efficitur lectus, id dignissim quam tempor id. Morbi sollicitudin rhoncus diam, id tincidunt lectus scelerisque vitae. Etiam imperdiet semper sem, vel eleifend ligula mollis eget. Etiam ultrices fringilla lacus, sit amet pharetra ex blandit quis. Suspendisse in egestas neque, et posuere lectus. Vestibulum eu ex dui. Sed molestie nulla a lobortis scelerisque. Nulla ipsum ex, iaculis vitae vehicula sit amet, fermentum eu eros.",
							State:   models.AlertStateOK,
						}, &validations.OSSPluginRequestValidator{})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/foo",
						"")
					So(len(caption), ShouldBeLessThanOrEqualTo, 1024)
					require.Contains(t, caption, "[OK] This is an alarm")
					So(caption, ShouldNotContainSubstring, "http")
					require.Contains(t, caption, "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise I will. Yes siree that's it. But suddenly Telegram increased the length so now we need some lorem ipsum to fix this test. Here we go: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus consectetur molestie cursus. Donec suscipit egestas nisi. Proin ut efficitur ex. Mauris mi augue, volutpat a nisi vel, euismod dictum arcu. Sed quis tempor eros, sed malesuada dolor. Ut orci augue, viverra sit amet blandit quis, faucibus sit amet ex. Duis condimentum efficitur lectus, id dignissim quam tempor id. Morbi sollicitudin rhoncus diam, id tincidunt lectus scelerisque vitae. Etiam imperdiet semper sem, vel eleifend ligula mollis eget. Etiam ultrices fringilla lacus, sit amet pharetra ex blandit quis. Suspendisse in egestas neque, et posuere lectus. Vestibulum eu ex dui. Sed molestie nulla a lobortis sceleri")
				})

				t.Run("Metrics should be skipped if they don't fit", func(t *testing.T) {
					evalContext := alerting.NewEvalContext(context.Background(),
						&alerting.Rule{
							Name:    "This is an alarm",
							Message: "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise I will. Yes siree that's it. But suddenly Telegram increased the length so now we need some lorem ipsum to fix this test. Here we go: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus consectetur molestie cursus. Donec suscipit egestas nisi. Proin ut efficitur ex. Mauris mi augue, volutpat a nisi vel, euismod dictum arcu. Sed quis tempor eros, sed malesuada dolor. Ut orci augue, viverra sit amet blandit quis, faucibus sit amet ex. Duis condimentum efficitur lectus, id dignissim quam tempor id. Morbi sollicitudin rhoncus diam, id tincidunt lectus scelerisque vitae. Etiam imperdiet semper sem, vel eleifend ligula mollis eget. Etiam ultrices fringilla lacus, sit amet pharetra ex blandit quis. Suspendisse in egestas neque, et posuere lectus. Vestibulum eu ex dui. Sed molestie nulla a lobortis sceleri",
							State:   models.AlertStateOK,
						}, &validations.OSSPluginRequestValidator{})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/foo",
						"foo bar long song")
					So(len(caption), ShouldBeLessThanOrEqualTo, 1024)
					require.Contains(t, caption, "[OK] This is an alarm")
					So(caption, ShouldNotContainSubstring, "http")
					So(caption, ShouldNotContainSubstring, "foo bar")
				})
			})
		})
	})
}
