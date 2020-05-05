package notifiers

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestShouldSendAlertNotification(t *testing.T) {
	tnow := time.Now()

	tcs := []struct {
		name         string
		prevState    models.AlertStateType
		newState     models.AlertStateType
		sendReminder bool
		frequency    time.Duration
		state        *models.AlertNotificationState

		expect bool
	}{
		{
			name:         "pending -> ok should not trigger an notification",
			newState:     models.AlertStateOK,
			prevState:    models.AlertStatePending,
			sendReminder: false,

			expect: false,
		},
		{
			name:         "ok -> alerting should trigger an notification",
			newState:     models.AlertStateAlerting,
			prevState:    models.AlertStateOK,
			sendReminder: false,

			expect: true,
		},
		{
			name:         "ok -> pending should not trigger an notification",
			newState:     models.AlertStatePending,
			prevState:    models.AlertStateOK,
			sendReminder: false,

			expect: false,
		},
		{
			name:         "ok -> ok should not trigger an notification",
			newState:     models.AlertStateOK,
			prevState:    models.AlertStateOK,
			sendReminder: false,

			expect: false,
		},
		{
			name:         "ok -> ok with reminder should not trigger an notification",
			newState:     models.AlertStateOK,
			prevState:    models.AlertStateOK,
			sendReminder: true,

			expect: false,
		},
		{
			name:         "alerting -> ok should trigger an notification",
			newState:     models.AlertStateOK,
			prevState:    models.AlertStateAlerting,
			sendReminder: false,

			expect: true,
		},
		{
			name:         "alerting -> ok should trigger an notification when reminders enabled",
			newState:     models.AlertStateOK,
			prevState:    models.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &models.AlertNotificationState{UpdatedAt: tnow.Add(-time.Minute).Unix()},

			expect: true,
		},
		{
			name:         "alerting -> alerting with reminder and no state should trigger",
			newState:     models.AlertStateAlerting,
			prevState:    models.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,

			expect: true,
		},
		{
			name:         "alerting -> alerting with reminder and last notification sent 1 minute ago should not trigger",
			newState:     models.AlertStateAlerting,
			prevState:    models.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &models.AlertNotificationState{UpdatedAt: tnow.Add(-time.Minute).Unix()},

			expect: false,
		},
		{
			name:         "alerting -> alerting with reminder and last notification sent 11 minutes ago should trigger",
			newState:     models.AlertStateAlerting,
			prevState:    models.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &models.AlertNotificationState{UpdatedAt: tnow.Add(-11 * time.Minute).Unix()},

			expect: true,
		},
		{
			name:      "OK -> alerting with notification state pending and updated 30 seconds ago should not trigger",
			newState:  models.AlertStateAlerting,
			prevState: models.AlertStateOK,
			state:     &models.AlertNotificationState{State: models.AlertNotificationStatePending, UpdatedAt: tnow.Add(-30 * time.Second).Unix()},

			expect: false,
		},
		{
			name:      "OK -> alerting with notification state pending and updated 2 minutes ago should trigger",
			newState:  models.AlertStateAlerting,
			prevState: models.AlertStateOK,
			state:     &models.AlertNotificationState{State: models.AlertNotificationStatePending, UpdatedAt: tnow.Add(-2 * time.Minute).Unix()},

			expect: true,
		},
		{
			name:      "unknown -> ok",
			prevState: models.AlertStateUnknown,
			newState:  models.AlertStateOK,

			expect: false,
		},
		{
			name:      "unknown -> pending",
			prevState: models.AlertStateUnknown,
			newState:  models.AlertStatePending,

			expect: false,
		},
		{
			name:      "unknown -> alerting",
			prevState: models.AlertStateUnknown,
			newState:  models.AlertStateAlerting,

			expect: true,
		},
		{
			name:      "no_data -> pending",
			prevState: models.AlertStateNoData,
			newState:  models.AlertStatePending,

			expect: false,
		},
		{
			name:      "no_data -> ok",
			prevState: models.AlertStateNoData,
			newState:  models.AlertStateOK,

			expect: true,
		},
	}

	for _, tc := range tcs {
		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			State: tc.prevState,
		})

		if tc.state == nil {
			tc.state = &models.AlertNotificationState{}
		}

		evalContext.Rule.State = tc.newState
		nb := &NotifierBase{SendReminder: tc.sendReminder, Frequency: tc.frequency}

		r := nb.ShouldNotify(evalContext.Ctx, evalContext, tc.state)
		assert.Equal(t, r, tc.expect, "failed test %s. expected %+v to return: %v", tc.name, tc, tc.expect)
	}
}

func TestBaseNotifier(t *testing.T) {
	Convey("default constructor for notifiers", t, func() {
		bJSON := simplejson.New()

		model := &models.AlertNotification{
			Uid:      "1",
			Name:     "name",
			Type:     "email",
			Settings: bJSON,
		}

		Convey("can parse false value", func() {
			bJSON.Set("uploadImage", false)

			base := NewNotifierBase(model)
			So(base.UploadImage, ShouldBeFalse)
		})

		Convey("can parse true value", func() {
			bJSON.Set("uploadImage", true)

			base := NewNotifierBase(model)
			So(base.UploadImage, ShouldBeTrue)
		})

		Convey("default value should be true for backwards compatibility", func() {
			base := NewNotifierBase(model)
			So(base.UploadImage, ShouldBeTrue)
		})

		Convey("default value should be false for backwards compatibility", func() {
			base := NewNotifierBase(model)
			So(base.DisableResolveMessage, ShouldBeFalse)
		})
	})
}
