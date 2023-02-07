package notifiers

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/validations"
)

func TestPushoverNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "Pushover",
				Type:     "pushover",
				Settings: settingsJSON,
			}

			_, err := NewPushoverNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Error(t, err)
		})

		t.Run("from settings", func(t *testing.T) {
			json := `
				{
					"apiToken": "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve",
					"userKey": "tzNZYf36y0ohWwXo4XoUrB61rz1A4o",
					"priority": "1",
					"okPriority": "2",
					"sound": "pushover",
					"okSound": "magic"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "Pushover",
				Type:     "pushover",
				Settings: settingsJSON,
			}

			not, err := NewPushoverNotifier(model, encryptionService.GetDecryptedValue, nil)
			pushoverNotifier := not.(*PushoverNotifier)

			require.Nil(t, err)
			require.Equal(t, "Pushover", pushoverNotifier.Name)
			require.Equal(t, "pushover", pushoverNotifier.Type)
			require.Equal(t, "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve", pushoverNotifier.APIToken)
			require.Equal(t, "tzNZYf36y0ohWwXo4XoUrB61rz1A4o", pushoverNotifier.UserKey)
			require.Equal(t, 1, pushoverNotifier.AlertingPriority)
			require.Equal(t, 2, pushoverNotifier.OKPriority)
			require.Equal(t, "pushover", pushoverNotifier.AlertingSound)
			require.Equal(t, "magic", pushoverNotifier.OKSound)
		})
	})
}

func TestGenPushoverBody(t *testing.T) {
	t.Run("Given common sounds", func(t *testing.T) {
		sirenSound := "siren_sound_tst"
		successSound := "success_sound_tst"
		notifier := &PushoverNotifier{AlertingSound: sirenSound, OKSound: successSound}

		t.Run("When alert is firing - should use siren sound", func(t *testing.T) {
			evalContext := alerting.NewEvalContext(context.Background(),
				&alerting.Rule{
					State: models.AlertStateAlerting,
				}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
			_, pushoverBody, err := notifier.genPushoverBody(evalContext, "", "")

			require.Nil(t, err)
			require.True(t, strings.Contains(pushoverBody.String(), sirenSound))
		})

		t.Run("When alert is ok - should use success sound", func(t *testing.T) {
			evalContext := alerting.NewEvalContext(context.Background(),
				&alerting.Rule{
					State: models.AlertStateOK,
				}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
			_, pushoverBody, err := notifier.genPushoverBody(evalContext, "", "")

			require.Nil(t, err)
			require.True(t, strings.Contains(pushoverBody.String(), successSound))
		})
	})
}
