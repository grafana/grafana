package notifiers

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/validations"
)

func presenceComparerInt(a, b int64) bool {
	if a == -1 {
		return b != 0
	}
	if b == -1 {
		return a != 0
	}
	return a == b
}
func TestVictoropsNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "victorops_testing",
				Type:     "victorops",
				Settings: settingsJSON,
			}

			_, err := NewVictoropsNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Error(t, err)
		})

		t.Run("from settings", func(t *testing.T) {
			json := `
				{
          "url": "http://google.com"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "victorops_testing",
				Type:     "victorops",
				Settings: settingsJSON,
			}

			not, err := NewVictoropsNotifier(model, encryptionService.GetDecryptedValue, nil)
			victoropsNotifier := not.(*VictoropsNotifier)

			require.Nil(t, err)
			require.Equal(t, "victorops_testing", victoropsNotifier.Name)
			require.Equal(t, "victorops", victoropsNotifier.Type)
			require.Equal(t, "http://google.com", victoropsNotifier.URL)
		})

		t.Run("should return properly formatted event payload when using severity override tag", func(t *testing.T) {
			json := `
				{
					"url": "http://google.com"
				}`

			settingsJSON, err := simplejson.NewJson([]byte(json))
			require.Nil(t, err)

			model := &models.AlertNotification{
				Name:     "victorops_testing",
				Type:     "victorops",
				Settings: settingsJSON,
			}

			not, err := NewVictoropsNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Nil(t, err)

			victoropsNotifier := not.(*VictoropsNotifier)

			evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
				ID:      0,
				Name:    "someRule",
				Message: "someMessage",
				State:   models.AlertStateAlerting,
				AlertRuleTags: []*tag.Tag{
					{Key: "keyOnly"},
					{Key: "severity", Value: "warning"},
				},
			}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
			evalContext.IsTestRun = true

			payload, err := victoropsNotifier.buildEventPayload(evalContext)
			require.Nil(t, err)

			diff := cmp.Diff(map[string]interface{}{
				"alert_url":           "",
				"entity_display_name": "[Alerting] someRule",
				"entity_id":           "someRule",
				"message_type":        "WARNING",
				"metrics":             map[string]interface{}{},
				"monitoring_tool":     "Grafana v",
				"state_message":       "someMessage",
				"state_start_time":    int64(-1),
				"timestamp":           int64(-1),
			}, payload.Interface(), cmp.Comparer(presenceComparerInt))
			require.Empty(t, diff)
		})
		t.Run("resolving with severity works properly", func(t *testing.T) {
			json := `
				{
					"url": "http://google.com"
				}`

			settingsJSON, err := simplejson.NewJson([]byte(json))
			require.Nil(t, err)

			model := &models.AlertNotification{
				Name:     "victorops_testing",
				Type:     "victorops",
				Settings: settingsJSON,
			}

			not, err := NewVictoropsNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Nil(t, err)

			victoropsNotifier := not.(*VictoropsNotifier)

			evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
				ID:      0,
				Name:    "someRule",
				Message: "someMessage",
				State:   models.AlertStateOK,
				AlertRuleTags: []*tag.Tag{
					{Key: "keyOnly"},
					{Key: "severity", Value: "warning"},
				},
			}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
			evalContext.IsTestRun = true

			payload, err := victoropsNotifier.buildEventPayload(evalContext)
			require.Nil(t, err)

			diff := cmp.Diff(map[string]interface{}{
				"alert_url":           "",
				"entity_display_name": "[OK] someRule",
				"entity_id":           "someRule",
				"message_type":        "RECOVERY",
				"metrics":             map[string]interface{}{},
				"monitoring_tool":     "Grafana v",
				"state_message":       "someMessage",
				"state_start_time":    int64(-1),
				"timestamp":           int64(-1),
			}, payload.Interface(), cmp.Comparer(presenceComparerInt))
			require.Empty(t, diff)
		})
	})
}
