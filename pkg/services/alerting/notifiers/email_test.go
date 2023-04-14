package notifiers

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
)

func TestEmailNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "email",
				Settings: settingsJSON,
			}

			_, err := NewEmailNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Error(t, err)
		})

		t.Run("from settings", func(t *testing.T) {
			json := `
				{
					"addresses": "ops@grafana.org"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "email",
				Settings: settingsJSON,
			}

			not, err := NewEmailNotifier(model, encryptionService.GetDecryptedValue, nil)
			emailNotifier := not.(*EmailNotifier)

			require.Nil(t, err)
			require.Equal(t, "ops", emailNotifier.Name)
			require.Equal(t, "email", emailNotifier.Type)
			require.Equal(t, "ops@grafana.org", emailNotifier.Addresses[0])
		})

		t.Run("from settings with two emails", func(t *testing.T) {
			json := `
				{
					"addresses": "ops@grafana.org;dev@grafana.org"
				}`

			settingsJSON, err := simplejson.NewJson([]byte(json))
			require.Nil(t, err)

			model := &models.AlertNotification{
				Name:     "ops",
				Type:     "email",
				Settings: settingsJSON,
			}

			not, err := NewEmailNotifier(model, encryptionService.GetDecryptedValue, nil)
			emailNotifier := not.(*EmailNotifier)

			require.Nil(t, err)
			require.Equal(t, "ops", emailNotifier.Name)
			require.Equal(t, "email", emailNotifier.Type)
			require.Equal(t, 2, len(emailNotifier.Addresses))

			require.Equal(t, "ops@grafana.org", emailNotifier.Addresses[0])
			require.Equal(t, "dev@grafana.org", emailNotifier.Addresses[1])
		})
	})
}
