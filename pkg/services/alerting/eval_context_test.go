package alerting

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingEvalContext(t *testing.T) {
	Convey("Eval context", t, func() {
		ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})

		Convey("Should update alert state", func() {

			Convey("ok -> alerting", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.State = models.AlertStateAlerting

				So(ctx.ShouldUpdateAlertState(), ShouldBeTrue)
			})

			Convey("ok -> ok", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.State = models.AlertStateOK

				So(ctx.ShouldUpdateAlertState(), ShouldBeFalse)
			})
		})
	})
}
