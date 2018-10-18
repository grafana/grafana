package notifiers

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestShouldSendAlertNotification(t *testing.T) {
	tnow := time.Now()

	tcs := []struct {
		name         string
		prevState    m.AlertStateType
		newState     m.AlertStateType
		sendReminder bool
		frequency    time.Duration
		state        *m.AlertNotificationState

		expect bool
	}{
		{
			name:         "pending -> ok should not trigger an notification",
			newState:     m.AlertStateOK,
			prevState:    m.AlertStatePending,
			sendReminder: false,
			state:        &m.AlertNotificationState{},

			expect: false,
		},
		{
			name:         "ok -> alerting should trigger an notification",
			newState:     m.AlertStateAlerting,
			prevState:    m.AlertStateOK,
			sendReminder: false,
			state:        &m.AlertNotificationState{},

			expect: true,
		},
		{
			name:         "ok -> pending should not trigger an notification",
			newState:     m.AlertStatePending,
			prevState:    m.AlertStateOK,
			sendReminder: false,
			state:        &m.AlertNotificationState{},

			expect: false,
		},
		{
			name:         "ok -> ok should not trigger an notification",
			newState:     m.AlertStateOK,
			prevState:    m.AlertStateOK,
			sendReminder: false,
			state:        &m.AlertNotificationState{},

			expect: false,
		},
		{
			name:         "ok -> ok with reminder should not trigger an notification",
			newState:     m.AlertStateOK,
			prevState:    m.AlertStateOK,
			sendReminder: true,
			state:        &m.AlertNotificationState{},

			expect: false,
		},
		{
			name:         "alerting -> ok should trigger an notification",
			newState:     m.AlertStateOK,
			prevState:    m.AlertStateAlerting,
			sendReminder: false,
			state:        &m.AlertNotificationState{},

			expect: true,
		},
		{
			name:         "alerting -> ok should trigger an notification when reminders enabled",
			newState:     m.AlertStateOK,
			prevState:    m.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &m.AlertNotificationState{UpdatedAt: tnow.Add(-time.Minute).Unix()},

			expect: true,
		},
		{
			name:         "alerting -> alerting with reminder and no state should trigger",
			newState:     m.AlertStateAlerting,
			prevState:    m.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &m.AlertNotificationState{},

			expect: true,
		},
		{
			name:         "alerting -> alerting with reminder and last notification sent 1 minute ago should not trigger",
			newState:     m.AlertStateAlerting,
			prevState:    m.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &m.AlertNotificationState{UpdatedAt: tnow.Add(-time.Minute).Unix()},

			expect: false,
		},
		{
			name:         "alerting -> alerting with reminder and last notifciation sent 11 minutes ago should trigger",
			newState:     m.AlertStateAlerting,
			prevState:    m.AlertStateAlerting,
			frequency:    time.Minute * 10,
			sendReminder: true,
			state:        &m.AlertNotificationState{UpdatedAt: tnow.Add(-11 * time.Minute).Unix()},

			expect: true,
		},
		{
			name:      "OK -> alerting with notifciation state pending and updated 30 seconds ago should not trigger",
			newState:  m.AlertStateAlerting,
			prevState: m.AlertStateOK,
			state:     &m.AlertNotificationState{State: m.AlertNotificationStatePending, UpdatedAt: tnow.Add(-30 * time.Second).Unix()},

			expect: false,
		},
		{
			name:      "OK -> alerting with notifciation state pending and updated 2 minutes ago should trigger",
			newState:  m.AlertStateAlerting,
			prevState: m.AlertStateOK,
			state:     &m.AlertNotificationState{State: m.AlertNotificationStatePending, UpdatedAt: tnow.Add(-2 * time.Minute).Unix()},

			expect: true,
		},
	}

	for _, tc := range tcs {
		evalContext := alerting.NewEvalContext(context.TODO(), &alerting.Rule{
			State: tc.prevState,
		})

		evalContext.Rule.State = tc.newState
		nb := &NotifierBase{SendReminder: tc.sendReminder, Frequency: tc.frequency}

		if nb.ShouldNotify(evalContext.Ctx, evalContext, tc.state) != tc.expect {
			t.Errorf("failed test %s.\n expected \n%+v \nto return: %v", tc.name, tc, tc.expect)
		}
	}
}

func TestBaseNotifier(t *testing.T) {
	Convey("default constructor for notifiers", t, func() {
		bJson := simplejson.New()

		model := &m.AlertNotification{
			Id:       1,
			Name:     "name",
			Type:     "email",
			Settings: bJson,
		}

		Convey("can parse false value", func() {
			bJson.Set("uploadImage", false)

			base := NewNotifierBase(model)
			So(base.UploadImage, ShouldBeFalse)
		})

		Convey("can parse true value", func() {
			bJson.Set("uploadImage", true)

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
