package notifiers

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/validations"
)

func TestReplaceIllegalCharswithUnderscore(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{
			input:    "foobar",
			expected: "foobar",
		},
		{
			input:    `foo.,\][!?#="~*^&+|<>\'bar09_09`,
			expected: "foo____________________bar09_09",
		},
	}

	for _, c := range cases {
		assert.Equal(t, replaceIllegalCharsInLabelname(c.input), c.expected)
	}
}

func TestWhenAlertManagerShouldNotify(t *testing.T) {
	tcs := []struct {
		prevState models.AlertStateType
		newState  models.AlertStateType

		expect bool
	}{
		{
			prevState: models.AlertStatePending,
			newState:  models.AlertStateOK,
			expect:    false,
		},
		{
			prevState: models.AlertStateAlerting,
			newState:  models.AlertStateOK,
			expect:    true,
		},
		{
			prevState: models.AlertStateOK,
			newState:  models.AlertStatePending,
			expect:    false,
		},
		{
			prevState: models.AlertStateUnknown,
			newState:  models.AlertStatePending,
			expect:    false,
		},
	}

	for _, tc := range tcs {
		am := &AlertmanagerNotifier{log: log.New("test.logger")}
		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			State: tc.prevState,
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		evalContext.Rule.State = tc.newState

		res := am.ShouldNotify(context.Background(), evalContext, &models.AlertNotificationState{})
		if res != tc.expect {
			t.Errorf("got %v expected %v", res, tc.expect)
		}
	}
}

//nolint:goconst
func TestAlertmanagerNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "alertmanager",
				Type:     "alertmanager",
				Settings: settingsJSON,
			}

			_, err := NewAlertmanagerNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Error(t, err)
		})

		t.Run("from settings", func(t *testing.T) {
			json := `{ "url": "http://127.0.0.1:9093/", "basicAuthUser": "user", "basicAuthPassword": "password" }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "alertmanager",
				Type:     "alertmanager",
				Settings: settingsJSON,
			}

			not, err := NewAlertmanagerNotifier(model, encryptionService.GetDecryptedValue, nil)
			alertmanagerNotifier := not.(*AlertmanagerNotifier)

			require.NoError(t, err)
			require.Equal(t, alertmanagerNotifier.BasicAuthUser, "user")
			require.Equal(t, alertmanagerNotifier.BasicAuthPassword, "password")
			require.Equal(t, alertmanagerNotifier.URL, []string{"http://127.0.0.1:9093/"})
		})

		t.Run("from settings with multiple alertmanager", func(t *testing.T) {
			json := `{ "url": "http://alertmanager1:9093,http://alertmanager2:9093" }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "alertmanager",
				Type:     "alertmanager",
				Settings: settingsJSON,
			}

			not, err := NewAlertmanagerNotifier(model, encryptionService.GetDecryptedValue, nil)
			alertmanagerNotifier := not.(*AlertmanagerNotifier)

			require.NoError(t, err)
			require.Equal(t, alertmanagerNotifier.URL, []string{"http://alertmanager1:9093", "http://alertmanager2:9093"})
		})
	})
}
