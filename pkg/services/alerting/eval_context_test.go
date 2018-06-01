package alerting

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestStateIsUpdatedWhenNeeded(t *testing.T) {
	ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})

	t.Run("ok -> alerting", func(t *testing.T) {
		ctx.PrevAlertState = models.AlertStateOK
		ctx.Rule.State = models.AlertStateAlerting

		if !ctx.ShouldUpdateAlertState() {
			t.Fatalf("expected should updated to be true")
		}
	})

	t.Run("ok -> ok", func(t *testing.T) {
		ctx.PrevAlertState = models.AlertStateOK
		ctx.Rule.State = models.AlertStateOK

		if ctx.ShouldUpdateAlertState() {
			t.Fatalf("expected should updated to be false")
		}
	})
}

func TestAlertingEvalContext(t *testing.T) {
	Convey("Should compute and replace properly new rule state", t, func() {
		ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})
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
}
