package alerting

import (
	"testing"

	"fmt"

	"github.com/grafana/grafana/pkg/models"
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

func (fn *FakeNotifier) Notify(alertResult *EvalContext) {}

func (fn *FakeNotifier) MatchSeverity(result models.AlertSeverityType) bool {
	return fn.FakeMatchResult
}

func TestAlertNotificationExtraction(t *testing.T) {

	Convey("Notifier tests", t, func() {
		Convey("none firing alerts", func() {
			ctx := &EvalContext{
				Firing: false,
				Rule: &Rule{
					Severity: models.AlertSeverityCritical,
				},
			}
			notifier := &FakeNotifier{FakeMatchResult: false}

			So(shouldUseNotification(notifier, ctx), ShouldBeTrue)
		})

		Convey("exeuction error cannot be ignored", func() {
			ctx := &EvalContext{
				Firing: true,
				Error:  fmt.Errorf("I used to be a programmer just like you"),
				Rule: &Rule{
					Severity: models.AlertSeverityCritical,
				},
			}
			notifier := &FakeNotifier{FakeMatchResult: false}

			So(shouldUseNotification(notifier, ctx), ShouldBeTrue)
		})

		Convey("firing alert that match", func() {
			ctx := &EvalContext{
				Firing: true,
				Rule: &Rule{
					Severity: models.AlertSeverityCritical,
				},
			}
			notifier := &FakeNotifier{FakeMatchResult: true}

			So(shouldUseNotification(notifier, ctx), ShouldBeTrue)
		})

		Convey("firing alert that dont match", func() {
			ctx := &EvalContext{
				Firing: true,
				Rule: &Rule{
					Severity: models.AlertSeverityCritical,
				},
			}
			notifier := &FakeNotifier{FakeMatchResult: false}

			So(shouldUseNotification(notifier, ctx), ShouldBeFalse)
		})
	})
}
