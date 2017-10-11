package alerting

import (
	"testing"

	"fmt"

	"github.com/grafana/grafana/pkg/models"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

type FakeNotifier struct {
	FakeMatchResult bool
}

func (fn *FakeNotifier) GetType() string {
	return "FakeNotifier"
}

func (fn *FakeNotifier) NeedsImage() bool {
	return true
}

func (n *FakeNotifier) GetNotifierId() int64 {
	return 0
}

func (n *FakeNotifier) GetIsDefault() bool {
	return false
}

func (fn *FakeNotifier) Notify(alertResult *EvalContext) error { return nil }

func (fn *FakeNotifier) PassesFilter(rule *Rule) bool {
	return fn.FakeMatchResult
}

func TestAlertNotificationExtraction(t *testing.T) {

	Convey("Notifier tests", t, func() {
		Convey("none firing alerts", func() {
			ctx := &EvalContext{
				Firing: false,
				Rule: &Rule{
					State: m.AlertStateAlerting,
				},
			}
			notifier := &FakeNotifier{FakeMatchResult: false}

			So(shouldUseNotification(notifier, ctx), ShouldBeTrue)
		})

		Convey("execution error cannot be ignored", func() {
			ctx := &EvalContext{
				Firing: true,
				Error:  fmt.Errorf("I used to be a programmer just like you"),
				Rule: &Rule{
					State: m.AlertStateOK,
				},
			}
			notifier := &FakeNotifier{FakeMatchResult: false}

			So(shouldUseNotification(notifier, ctx), ShouldBeTrue)
		})

		Convey("firing alert that match", func() {
			ctx := &EvalContext{
				Firing: true,
				Rule: &Rule{
					State: models.AlertStateAlerting,
				},
			}
			notifier := &FakeNotifier{FakeMatchResult: true}

			So(shouldUseNotification(notifier, ctx), ShouldBeTrue)
		})

		Convey("firing alert that dont match", func() {
			ctx := &EvalContext{
				Firing: true,
				Rule:   &Rule{State: m.AlertStateOK},
			}
			notifier := &FakeNotifier{FakeMatchResult: false}

			So(shouldUseNotification(notifier, ctx), ShouldBeFalse)
		})
	})
}
