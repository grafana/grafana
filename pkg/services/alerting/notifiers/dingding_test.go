package notifiers

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/validations"
)

func TestDingDingNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("empty settings should return error", func(t *testing.T) {
		json := `{ }`

		settingsJSON, _ := simplejson.NewJson([]byte(json))
		model := &models.AlertNotification{
			Name:     "dingding_testing",
			Type:     "dingding",
			Settings: settingsJSON,
		}

		_, err := newDingDingNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.Error(t, err)
	})
	t.Run("settings should trigger incident", func(t *testing.T) {
		json := `{ "url": "https://www.google.com" }`

		settingsJSON, _ := simplejson.NewJson([]byte(json))
		model := &models.AlertNotification{
			Name:     "dingding_testing",
			Type:     "dingding",
			Settings: settingsJSON,
		}

		not, err := newDingDingNotifier(model, encryptionService.GetDecryptedValue, nil)
		notifier := not.(*DingDingNotifier)

		require.Nil(t, err)
		require.Equal(t, "dingding_testing", notifier.Name)
		require.Equal(t, "dingding", notifier.Type)
		require.Equal(t, "https://www.google.com", notifier.URL)

		t.Run("genBody should not panic", func(t *testing.T) {
			evalContext := alerting.NewEvalContext(context.Background(),
				&alerting.Rule{
					State:   models.AlertStateAlerting,
					Message: `{host="localhost"}`,
				}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
			_, err = notifier.genBody(evalContext, "")
			require.Nil(t, err)
		})
	})
}
