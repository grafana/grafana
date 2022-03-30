package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"

	"github.com/stretchr/testify/require"
)

func TestDiscordNotifier(t *testing.T) {
	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "discord_testing",
				Type:     "discord",
				Settings: settingsJSON,
			}

			_, err := newDiscordNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
			require.Error(t, err)
		})

		t.Run("settings should trigger incident", func(t *testing.T) {
			json := `
				{
					"avatar_url": "https://grafana.com/img/fav32.png",
					"content": "@everyone Please check this notification",
					"url": "https://web.hook/"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "discord_testing",
				Type:     "discord",
				Settings: settingsJSON,
			}

			not, err := newDiscordNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
			discordNotifier := not.(*DiscordNotifier)

			require.Nil(t, err)
			require.Equal(t, "discord_testing", discordNotifier.Name)
			require.Equal(t, "discord", discordNotifier.Type)
			require.Equal(t, "https://grafana.com/img/fav32.png", discordNotifier.AvatarURL)
			require.Equal(t, "@everyone Please check this notification", discordNotifier.Content)
			require.Equal(t, "https://web.hook/", discordNotifier.WebhookURL)
		})
	})
}
