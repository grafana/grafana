package notifiers

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
)

func TestThreemaNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "threema_testing",
				Type:     "threema",
				Settings: settingsJSON,
			}

			_, err := NewThreemaNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Error(t, err)
		})

		t.Run("valid settings should be parsed successfully", func(t *testing.T) {
			json := `
				{
					"gateway_id": "*3MAGWID",
					"recipient_id": "ECHOECHO",
					"api_secret": "1234"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "threema_testing",
				Type:     "threema",
				Settings: settingsJSON,
			}

			not, err := NewThreemaNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Nil(t, err)
			threemaNotifier := not.(*ThreemaNotifier)

			require.Nil(t, err)
			require.Equal(t, "threema_testing", threemaNotifier.Name)
			require.Equal(t, "threema", threemaNotifier.Type)
			require.Equal(t, "*3MAGWID", threemaNotifier.GatewayID)
			require.Equal(t, "ECHOECHO", threemaNotifier.RecipientID)
			require.Equal(t, "1234", threemaNotifier.APISecret)
		})

		t.Run("invalid Threema Gateway IDs should be rejected (prefix)", func(t *testing.T) {
			json := `
				{
					"gateway_id": "ECHOECHO",
					"recipient_id": "ECHOECHO",
					"api_secret": "1234"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "threema_testing",
				Type:     "threema",
				Settings: settingsJSON,
			}

			not, err := NewThreemaNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Nil(t, not)
			var valErr alerting.ValidationError
			require.True(t, errors.As(err, &valErr))
			require.Equal(t, "Invalid Threema Gateway ID: Must start with a *", valErr.Reason)
		})

		t.Run("invalid Threema Gateway IDs should be rejected (length)", func(t *testing.T) {
			json := `
				{
					"gateway_id": "*ECHOECHO",
					"recipient_id": "ECHOECHO",
					"api_secret": "1234"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "threema_testing",
				Type:     "threema",
				Settings: settingsJSON,
			}

			not, err := NewThreemaNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Nil(t, not)
			var valErr alerting.ValidationError
			require.True(t, errors.As(err, &valErr))
			require.Equal(t, "Invalid Threema Gateway ID: Must be 8 characters long", valErr.Reason)
		})

		t.Run("invalid Threema Recipient IDs should be rejected (length)", func(t *testing.T) {
			json := `
				{
					"gateway_id": "*3MAGWID",
					"recipient_id": "ECHOECH",
					"api_secret": "1234"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "threema_testing",
				Type:     "threema",
				Settings: settingsJSON,
			}

			not, err := NewThreemaNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Nil(t, not)
			var valErr alerting.ValidationError
			require.True(t, errors.As(err, &valErr))
			require.Equal(t, "Invalid Threema Recipient ID: Must be 8 characters long", valErr.Reason)
		})
	})
}
