package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"

	"github.com/stretchr/testify/require"
)

func TestGoogleChatNotifier(t *testing.T) {
	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "googlechat",
				Settings: settingsJSON,
			}

			_, err := newGoogleChatNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
			require.Error(t, err)
		})

		t.Run("from settings", func(t *testing.T) {
			json := `
				{
          			"url": "http://google.com"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "googlechat",
				Settings: settingsJSON,
			}

			not, err := newGoogleChatNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
			webhookNotifier := not.(*GoogleChatNotifier)

			require.Nil(t, err)
			require.Equal(t, "ops", webhookNotifier.Name)
			require.Equal(t, "googlechat", webhookNotifier.Type)
			require.Equal(t, "http://google.com", webhookNotifier.URL)
		})
	})
}
