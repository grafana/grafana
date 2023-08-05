package notifiers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
)

func TestWebhookNotifier_parsingFromSettings(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Empty settings should cause error", func(t *testing.T) {
		const json = `{}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "webhook",
			Settings: settingsJSON,
		}

		_, err = NewWebHookNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.Error(t, err)
	})

	t.Run("Valid settings should result in a valid notifier", func(t *testing.T) {
		const json = `{"url": "http://google.com"}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "webhook",
			Settings: settingsJSON,
		}

		not, err := NewWebHookNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.NoError(t, err)
		webhookNotifier := not.(*WebhookNotifier)

		assert.Equal(t, "ops", webhookNotifier.Name)
		assert.Equal(t, "webhook", webhookNotifier.Type)
		assert.Equal(t, "http://google.com", webhookNotifier.URL)
	})
}
