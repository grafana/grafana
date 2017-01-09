package alerting

import (
	"context"
	"testing"

	"fmt"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingResultHandler(t *testing.T) {
	Convey("Result handler", t, func() {
		ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})
		dummieError := fmt.Errorf("dummie")
		handler := NewResultHandler()

		Convey("Should update alert state", func() {

			Convey("ok -> alerting", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Firing = true

				So(handler.GetStateFromEvaluation(ctx), ShouldEqual, models.AlertStateAlerting)
				So(ctx.ShouldUpdateAlertState(), ShouldBeTrue)
			})

			Convey("ok -> error(alerting)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Error = dummieError
				ctx.Rule.ExecutionErrorState = models.ExecutionErrorSetAlerting

				ctx.Rule.State = handler.GetStateFromEvaluation(ctx)
				So(ctx.Rule.State, ShouldEqual, models.AlertStateAlerting)
				So(ctx.ShouldUpdateAlertState(), ShouldBeTrue)
			})

			Convey("ok -> error(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Error = dummieError
				ctx.Rule.ExecutionErrorState = models.ExecutionErrorKeepState

				ctx.Rule.State = handler.GetStateFromEvaluation(ctx)
				So(ctx.Rule.State, ShouldEqual, models.AlertStateOK)
				So(ctx.ShouldUpdateAlertState(), ShouldBeFalse)
			})

			Convey("pending -> error(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStatePending
				ctx.Error = dummieError
				ctx.Rule.ExecutionErrorState = models.ExecutionErrorKeepState

				ctx.Rule.State = handler.GetStateFromEvaluation(ctx)
				So(ctx.Rule.State, ShouldEqual, models.AlertStatePending)
				So(ctx.ShouldUpdateAlertState(), ShouldBeFalse)
			})

			Convey("ok -> no_data(alerting)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.NoDataState = models.NoDataSetAlerting
				ctx.NoDataFound = true

				ctx.Rule.State = handler.GetStateFromEvaluation(ctx)
				So(ctx.Rule.State, ShouldEqual, models.AlertStateAlerting)
				So(ctx.ShouldUpdateAlertState(), ShouldBeTrue)
			})

			Convey("ok -> no_data(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.NoDataState = models.NoDataKeepState
				ctx.NoDataFound = true

				ctx.Rule.State = handler.GetStateFromEvaluation(ctx)
				So(ctx.Rule.State, ShouldEqual, models.AlertStateOK)
				So(ctx.ShouldUpdateAlertState(), ShouldBeFalse)
			})

			Convey("pending -> no_data(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStatePending
				ctx.Rule.NoDataState = models.NoDataKeepState
				ctx.NoDataFound = true

				ctx.Rule.State = handler.GetStateFromEvaluation(ctx)
				So(ctx.Rule.State, ShouldEqual, models.AlertStatePending)
				So(ctx.ShouldUpdateAlertState(), ShouldBeFalse)
			})
		})
	})
}
