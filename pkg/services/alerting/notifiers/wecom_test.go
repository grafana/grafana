package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/stretchr/testify/require"
)

func TestWeComNotifier(t *testing.T) {
	t.Run("Parse alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "wecom_testing",
				Type:     "wecom",
				Settings: settingsJSON,
			}

			_, err := NewWeComNotifier(model, ossencryption.ProvideService().GetDecryptedValue)
			require.Error(t, err)
		})
		t.Run("settings should trigger incident", func(t *testing.T) {
			json := `{ "url": "https://www.google.com" }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "wecom_testing",
				Type:     "wecom",
				Settings: settingsJSON,
			}

			not, err := NewWeComNotifier(model, ossencryption.ProvideService().GetDecryptedValue)
			require.Nil(t, err)
			notifier := not.(*WeComNotifier)
			require.Equal(t, "wecom", notifier.Type)
			require.Equal(t, "https://www.google.com", notifier.URL)

			t.Run("generate body should not panic", func(t *testing.T) {
				evalContext := alerting.NewEvalContext(context.Background(),
					&alerting.Rule{
						Name:    "This is an alarm",
						State:   models.AlertStateAlerting,
						Message: `Some kind of message.`,
					}, &validations.OSSPluginRequestValidator{})
				body, err := notifier.buildMarkdownBody(evalContext)
				require.Nil(t, err)
				require.Contains(t, string(body), "[Alerting] This is an alarm")
			})
		})
	})
}
