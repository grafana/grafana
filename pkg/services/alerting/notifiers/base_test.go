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
	tcs := []struct {
		prevState m.AlertStateType
		newState  m.AlertStateType
		expected  bool
	}{
		{
			newState:  m.AlertStatePending,
			prevState: m.AlertStateOK,
			expected:  false,
		},
		{
			newState:  m.AlertStateOK,
			prevState: m.AlertStateAlerting,
			expected:  true,
		},
	}

	for _, tc := range tcs {
		context := alerting.NewEvalContext(context.TODO(), &alerting.Rule{
			State: tc.newState,
		})
		context.Rule.State = tc.prevState
		timeNow := time.Now()
		if defaultShouldNotify(context, true, 0, &timeNow) != tc.expected {
			t.Errorf("expected %v to return %v", tc, tc.expected)
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
	})
}
