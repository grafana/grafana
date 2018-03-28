package alerting

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingEvalContext(t *testing.T) {
	Convey("Eval context", t, func() {
		ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})

		Convey("Should update alert state when needed", func() {

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

		Convey("Should compute and replace properly new rule state", func() {
			dummieError := fmt.Errorf("dummie error")

			Convey("ok -> alerting", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Firing = true

				ctx.Rule.State = ctx.GetNewState()
				So(ctx.Rule.State, ShouldEqual, models.AlertStateAlerting)
			})

			Convey("ok -> error(alerting)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Error = dummieError
				ctx.Rule.ExecutionErrorState = models.ExecutionErrorSetAlerting

				ctx.Rule.State = ctx.GetNewState()
				So(ctx.Rule.State, ShouldEqual, models.AlertStateAlerting)
			})

			Convey("ok -> error(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Error = dummieError
				ctx.Rule.ExecutionErrorState = models.ExecutionErrorKeepState

				ctx.Rule.State = ctx.GetNewState()
				So(ctx.Rule.State, ShouldEqual, models.AlertStateOK)
			})

			Convey("pending -> error(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStatePending
				ctx.Error = dummieError
				ctx.Rule.ExecutionErrorState = models.ExecutionErrorKeepState

				ctx.Rule.State = ctx.GetNewState()
				So(ctx.Rule.State, ShouldEqual, models.AlertStatePending)
			})

			Convey("ok -> no_data(alerting)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.NoDataState = models.NoDataSetAlerting
				ctx.NoDataFound = true

				ctx.Rule.State = ctx.GetNewState()
				So(ctx.Rule.State, ShouldEqual, models.AlertStateAlerting)
			})

			Convey("ok -> no_data(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.NoDataState = models.NoDataKeepState
				ctx.NoDataFound = true

				ctx.Rule.State = ctx.GetNewState()
				So(ctx.Rule.State, ShouldEqual, models.AlertStateOK)
			})

			Convey("pending -> no_data(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStatePending
				ctx.Rule.NoDataState = models.NoDataKeepState
				ctx.NoDataFound = true

				ctx.Rule.State = ctx.GetNewState()
				So(ctx.Rule.State, ShouldEqual, models.AlertStatePending)
			})
		})
	})
}
