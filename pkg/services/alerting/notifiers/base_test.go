package notifiers

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestShouldSendAlertNotification(t *testing.T) {
	tcs := []struct {
		name         string
		prevState    m.AlertStateType
		newState     m.AlertStateType
		expected     bool
		sendReminder bool
	}{
		{
			name:      "pending -> ok should not trigger an notification",
			newState:  m.AlertStatePending,
			prevState: m.AlertStateOK,
			expected:  false,
		},
		{
			name:      "ok -> alerting should trigger an notification",
			newState:  m.AlertStateOK,
			prevState: m.AlertStateAlerting,
			expected:  true,
		},
		{
			name:      "ok -> pending should not trigger an notification",
			newState:  m.AlertStateOK,
			prevState: m.AlertStatePending,
			expected:  false,
		},
		{
			name:         "ok -> ok should not trigger an notification",
			newState:     m.AlertStateOK,
			prevState:    m.AlertStateOK,
			expected:     false,
			sendReminder: false,
		},
		{
			name:         "ok -> alerting should not trigger an notification",
			newState:     m.AlertStateOK,
			prevState:    m.AlertStateAlerting,
			expected:     true,
			sendReminder: true,
		},
		{
			name:         "ok -> ok with reminder should not trigger an notification",
			newState:     m.AlertStateOK,
			prevState:    m.AlertStateOK,
			expected:     false,
			sendReminder: true,
		},
	}

	for _, tc := range tcs {
		evalContext := alerting.NewEvalContext(context.TODO(), &alerting.Rule{
			State: tc.newState,
		})

		evalContext.Rule.State = tc.prevState
		if defaultShouldNotify(evalContext, true, 0, time.Now()) != tc.expected {
			t.Errorf("failed %s. expected %+v to return %v", tc.name, tc, tc.expected)
		}
	}
}

func TestShouldNotifyWhenNoJournalingIsFound(t *testing.T) {
	Convey("base notifier", t, func() {
		bus.ClearBusHandlers()

		notifier := NewNotifierBase(&m.AlertNotification{
			Id:       1,
			Name:     "name",
			Type:     "email",
			Settings: simplejson.New(),
		})
		evalContext := alerting.NewEvalContext(context.TODO(), &alerting.Rule{})

		Convey("should notify if no journaling is found", func() {
			bus.AddHandlerCtx("", func(ctx context.Context, q *m.GetLatestNotificationQuery) error {
				return m.ErrJournalingNotFound
			})

			if !notifier.ShouldNotify(context.Background(), evalContext) {
				t.Errorf("should send notifications when ErrJournalingNotFound is returned")
			}
		})

		Convey("should not notify query returns error", func() {
			bus.AddHandlerCtx("", func(ctx context.Context, q *m.GetLatestNotificationQuery) error {
				return errors.New("some kind of error unknown error")
			})

			if notifier.ShouldNotify(context.Background(), evalContext) {
				t.Errorf("should not send notifications when query returns error")
			}
		})
	})
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
	})
}
