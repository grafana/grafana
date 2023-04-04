package notifiers

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
)

func TestTeamsNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "teams",
				Settings: settingsJSON,
			}

			_, err := NewTeamsNotifier(model, encryptionService.GetDecryptedValue, nil)
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
				Type:     "teams",
				Settings: settingsJSON,
			}

			not, err := NewTeamsNotifier(model, encryptionService.GetDecryptedValue, nil)
			teamsNotifier := not.(*TeamsNotifier)

			require.Nil(t, err)
			require.Equal(t, "ops", teamsNotifier.Name)
			require.Equal(t, "teams", teamsNotifier.Type)
			require.Equal(t, "http://google.com", teamsNotifier.URL)
		})

		t.Run("from settings with Recipient and Mention", func(t *testing.T) {
			json := `
				{
          "url": "http://google.com"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "teams",
				Settings: settingsJSON,
			}

			not, err := NewTeamsNotifier(model, encryptionService.GetDecryptedValue, nil)
			teamsNotifier := not.(*TeamsNotifier)

			require.Nil(t, err)
			require.Equal(t, "ops", teamsNotifier.Name)
			require.Equal(t, "teams", teamsNotifier.Type)
			require.Equal(t, "http://google.com", teamsNotifier.URL)
		})
	})
}
