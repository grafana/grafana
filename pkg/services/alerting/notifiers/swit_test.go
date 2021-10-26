package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSwitNotifier(t *testing.T) {
	t.Run("empty settings should return error", func(t *testing.T) {
		json := `{}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)

		model := &models.AlertNotification{
			Name:     "swit_testing",
			Type:     "swit",
			Settings: settingsJSON,
		}

		_, err = NewSwitNotifier(model, ossencryption.ProvideService().GetDecryptedValue)
		require.Error(t, err)
	})

	t.Run("Valid settings should result in a valid notifier", func(t *testing.T) {
		const json = `{"webhookurl": "https://hook.swit.dev/chat/1234/1234"}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "swit_testing",
			Type:     "swit",
			Settings: settingsJSON,
		}

		not, err := NewSwitNotifier(model, ossencryption.ProvideService().GetDecryptedValue)
		require.NoError(t, err)
		switNotifier := not.(*SwitNotifier)
		assert.Equal(t, "https://hook.swit.dev/chat/1234/1234", switNotifier.WebhookURL)
	})
}
