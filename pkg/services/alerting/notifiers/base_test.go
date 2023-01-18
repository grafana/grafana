package notifiers

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/alerts"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/validations"
)

func TestShouldSendAlertNotification(t *testing.T) {
	tnow := time.Now()

	tcs := []struct {
		name         string
		prevState    alerts.AlertStateType
		newState     alerts.AlertStateType
		sendReminder bool
		frequency    time.Duration
		state        *alerting.AlertNotificationState

		expect bool
	}{
		{
			name:         "pending -> ok should not trigger an notification",
			newState:     alerts.AlertStateOK,
			prevState:    alerts.AlertStatePending,
			sendReminder: false,

			expect: false,
		},
		{
			name:         "ok -> alerting should trigger an notification",
			newState:     alerts.AlertStateAlerting,
			prevState:    alerts.AlertStateOK,
			sendReminder: false,

			expect: true,
		},
		{
			name:         "ok -> pending should not trigger an notification",
			newState:     alerts.AlertStatePending,
			prevState:    alerts.AlertStateOK,
			sendReminder: false,

			expect: false,
		},
		{
			name:         "ok -> ok should not trigger an notification",
			newState:     alerts.AlertStateOK,
			prevState:    alerts.AlertStateOK,
			sendReminder: false,

			expect: false,
		},
		{
			name:         "ok -> ok with reminder should not trigger an notification",
			newState:     alerts.AlertStateOK,
			prevState:    alerts.AlertStateOK,
			sendReminder: true,

			expect: false,
		},
		{
			name:         "alerting -> ok should trigger an notification",
			newState:     alerts.AlertStateOK,
			prevState:    alerts.AlertStateAlerting,
			sendReminder: false,

			expect: true,
		},
		{
			name:         "alerting -> ok should trigger an notification when reminders enabled",
			newState:     alerts.AlertStateOK,
			prevState:    alerts.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &alerting.AlertNotificationState{UpdatedAt: tnow.Add(-time.Minute).Unix()},

			expect: true,
		},
		{
			name:         "alerting -> alerting with reminder and no state should trigger",
			newState:     alerts.AlertStateAlerting,
			prevState:    alerts.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,

			expect: true,
		},
		{
			name:         "alerting -> alerting with reminder and last notification sent 1 minute ago should not trigger",
			newState:     alerts.AlertStateAlerting,
			prevState:    alerts.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &alerting.AlertNotificationState{UpdatedAt: tnow.Add(-time.Minute).Unix()},

			expect: false,
		},
		{
			name:         "alerting -> alerting with reminder and last notification sent 11 minutes ago should trigger",
			newState:     alerts.AlertStateAlerting,
			prevState:    alerts.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &alerting.AlertNotificationState{UpdatedAt: tnow.Add(-11 * time.Minute).Unix()},

			expect: true,
		},
		{
			name:      "OK -> alerting with notification state pending and updated 30 seconds ago should not trigger",
			newState:  alerts.AlertStateAlerting,
			prevState: alerts.AlertStateOK,
			state:     &alerting.AlertNotificationState{State: alerting.AlertNotificationStatePending, UpdatedAt: tnow.Add(-30 * time.Second).Unix()},

			expect: false,
		},
		{
			name:      "OK -> alerting with notification state pending and updated 2 minutes ago should trigger",
			newState:  alerts.AlertStateAlerting,
			prevState: alerts.AlertStateOK,
			state:     &alerting.AlertNotificationState{State: alerting.AlertNotificationStatePending, UpdatedAt: tnow.Add(-2 * time.Minute).Unix()},

			expect: true,
		},
		{
			name:      "unknown -> ok",
			prevState: alerts.AlertStateUnknown,
			newState:  alerts.AlertStateOK,

			expect: false,
		},
		{
			name:      "unknown -> pending",
			prevState: alerts.AlertStateUnknown,
			newState:  alerts.AlertStatePending,

			expect: false,
		},
		{
			name:      "unknown -> alerting",
			prevState: alerts.AlertStateUnknown,
			newState:  alerts.AlertStateAlerting,

			expect: true,
		},
		{
			name:      "no_data -> pending",
			prevState: alerts.AlertStateNoData,
			newState:  alerts.AlertStatePending,

			expect: false,
		},
		{
			name:      "no_data -> ok",
			prevState: alerts.AlertStateNoData,
			newState:  alerts.AlertStateOK,

			expect: true,
		},
	}

	for _, tc := range tcs {
		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			State: tc.prevState,
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())

		if tc.state == nil {
			tc.state = &alerting.AlertNotificationState{}
		}

		evalContext.Rule.State = tc.newState
		nb := &NotifierBase{SendReminder: tc.sendReminder, Frequency: tc.frequency}

		r := nb.ShouldNotify(evalContext.Ctx, evalContext, tc.state)
		assert.Equal(t, r, tc.expect, "failed test %s. expected %+v to return: %v", tc.name, tc, tc.expect)
	}
}

func TestBaseNotifier(t *testing.T) {
	bJSON := simplejson.New()

	model := &alerting.AlertNotification{
		Uid:      "1",
		Name:     "name",
		Type:     "email",
		Settings: bJSON,
	}

	t.Run("can parse false value", func(t *testing.T) {
		bJSON.Set("uploadImage", false)

		base := NewNotifierBase(model, nil)
		require.False(t, base.UploadImage)
	})

	t.Run("can parse true value", func(t *testing.T) {
		bJSON.Set("uploadImage", true)

		base := NewNotifierBase(model, nil)
		require.True(t, base.UploadImage)
	})

	t.Run("default value should be true for backwards compatibility", func(t *testing.T) {
		base := NewNotifierBase(model, nil)
		require.True(t, base.UploadImage)
	})

	t.Run("default value should be false for backwards compatibility", func(t *testing.T) {
		base := NewNotifierBase(model, nil)
		require.False(t, base.DisableResolveMessage)
	})
}
