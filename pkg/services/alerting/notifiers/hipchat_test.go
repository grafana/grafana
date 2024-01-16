package notifiers

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
)

//nolint:goconst
func TestHipChatNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "hipchat",
				Settings: settingsJSON,
			}

			_, err := NewHipChatNotifier(model, encryptionService.GetDecryptedValue, nil)
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
				Type:     "hipchat",
				Settings: settingsJSON,
			}

			not, err := NewHipChatNotifier(model, encryptionService.GetDecryptedValue, nil)
			hipchatNotifier := not.(*HipChatNotifier)

			require.Nil(t, err)
			require.Equal(t, "ops", hipchatNotifier.Name)
			require.Equal(t, "hipchat", hipchatNotifier.Type)
			require.Equal(t, "http://google.com", hipchatNotifier.URL)
			require.Equal(t, "", hipchatNotifier.APIKey)
			require.Equal(t, "", hipchatNotifier.RoomID)
		})

		t.Run("from settings with Recipient and Mention", func(t *testing.T) {
			json := `
				{
          "url": "http://www.hipchat.com",
          "apikey": "1234",
          "roomid": "1234"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "hipchat",
				Settings: settingsJSON,
			}

			not, err := NewHipChatNotifier(model, encryptionService.GetDecryptedValue, nil)
			hipchatNotifier := not.(*HipChatNotifier)

			require.Nil(t, err)
			require.Equal(t, "ops", hipchatNotifier.Name)
			require.Equal(t, "hipchat", hipchatNotifier.Type)
			require.Equal(t, "http://www.hipchat.com", hipchatNotifier.URL)
			require.Equal(t, "1234", hipchatNotifier.APIKey)
			require.Equal(t, "1234", hipchatNotifier.RoomID)
		})
	})
}
