package notifiers

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
)

func TestLineNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("empty settings should return error", func(t *testing.T) {
		json := `{ }`

		settingsJSON, _ := simplejson.NewJson([]byte(json))
		model := &models.AlertNotification{
			Name:     "line_testing",
			Type:     "line",
			Settings: settingsJSON,
		}

		_, err := NewLINENotifier(model, encryptionService.GetDecryptedValue, nil)
		require.Error(t, err)
	})
	t.Run("settings should trigger incident", func(t *testing.T) {
		json := `
			{
  "token": "abcdefgh0123456789"
			}`
		settingsJSON, _ := simplejson.NewJson([]byte(json))
		model := &models.AlertNotification{
			Name:     "line_testing",
			Type:     "line",
			Settings: settingsJSON,
		}

		not, err := NewLINENotifier(model, encryptionService.GetDecryptedValue, nil)
		lineNotifier := not.(*LineNotifier)

		require.Nil(t, err)
		require.Equal(t, "line_testing", lineNotifier.Name)
		require.Equal(t, "line", lineNotifier.Type)
		require.Equal(t, "abcdefgh0123456789", lineNotifier.Token)
	})
}
