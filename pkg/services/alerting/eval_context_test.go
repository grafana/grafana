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
		err := fmt.Errorf("Dummie error!")

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

		Convey("Should send notifications", func() {
			Convey("pending -> ok", func() {
				ctx.PrevAlertState = models.AlertStatePending
				ctx.Rule.State = models.AlertStateOK

				So(ctx.ShouldSendNotification(), ShouldBeFalse)
			})

			Convey("ok -> alerting", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.State = models.AlertStateAlerting

				So(ctx.ShouldSendNotification(), ShouldBeTrue)
			})

			Convey("alerting -> ok", func() {
				ctx.PrevAlertState = models.AlertStateAlerting
				ctx.Rule.State = models.AlertStateOK

				So(ctx.ShouldSendNotification(), ShouldBeTrue)
			})

			Convey("ok -> no_data(alerting)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.NoDataState = models.NoDataSetAlerting
				ctx.Rule.State = models.AlertStateAlerting

				So(ctx.ShouldSendNotification(), ShouldBeTrue)
			})

			Convey("ok -> no_data(ok)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.NoDataState = models.NoDataSetOK
				ctx.NoDataFound = true
				ctx.Rule.State = models.AlertStateNoData

				So(ctx.ShouldSendNotification(), ShouldBeFalse)
			})

			Convey("ok -> no_data(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.NoDataState = models.NoDataKeepState
				ctx.Rule.State = models.AlertStateNoData
				ctx.NoDataFound = true

				So(ctx.ShouldSendNotification(), ShouldBeFalse)
			})

			Convey("ok -> execution_error(alerting)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.State = models.AlertStateExecError
				ctx.Rule.ExecutionErrorState = models.NoDataSetAlerting
				ctx.Error = err

				So(ctx.ShouldSendNotification(), ShouldBeTrue)
			})

			Convey("ok -> execution_error(ok)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.State = models.AlertStateExecError
				ctx.Rule.ExecutionErrorState = models.NoDataSetOK
				ctx.Error = err

				So(ctx.ShouldSendNotification(), ShouldBeFalse)
			})

			Convey("ok -> execution_error(keep_last)", func() {
				ctx.PrevAlertState = models.AlertStateOK
				ctx.Rule.State = models.AlertStateExecError
				ctx.Rule.ExecutionErrorState = models.NoDataKeepState
				ctx.Error = err

				So(ctx.ShouldSendNotification(), ShouldBeFalse)
			})
		})
	})
}
