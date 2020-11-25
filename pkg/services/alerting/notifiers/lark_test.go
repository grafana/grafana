package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/stretchr/testify/assert"
)

func TestLarkNotifier(t *testing.T) {
	t.Run("Lark notifier tests", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "lark_testing",
				Type:     "lark",
				Settings: settingsJSON,
			}

			_, err := newLarkNotifier(model)
			assert.EqualError(t, err, "alert validation error: Could not find url property in settings")
		})
		t.Run("settings should trigger incident", func(t *testing.T) {
			json := `{ "url": "https://www.google.com" }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "lark_testing",
				Type:     "lark",
				Settings: settingsJSON,
			}

			not, err := newLarkNotifier(model)
			notifier := not.(*LarkNotifier)

			assert.Nil(t, err)
			assert.Equal(t, "lark_testing", notifier.Name)
			assert.Equal(t, "lark", notifier.Type)
			assert.Equal(t, "https://www.google.com", notifier.URL)

			t.Run("genBody should not panic", func(t *testing.T) {
				evalContext := alerting.NewEvalContext(context.Background(),
					&alerting.Rule{
						State:   models.AlertStateAlerting,
						Message: `{host="localhost"}`,
					})
				_, err = notifier.genBody(evalContext, "")
				assert.Nil(t, err)
			})
		})
	})
}
