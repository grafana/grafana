package alerting

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

type conditionStub struct {
	firing   bool
	operator string
	matches  []*EvalMatch
	noData   bool
}

func (c *conditionStub) Eval(context *EvalContext) (*ConditionResult, error) {
	return &ConditionResult{Firing: c.firing, EvalMatches: c.matches, Operator: c.operator, NoDataFound: c.noData}, nil
}

func TestAlertingEvaluationHandler(t *testing.T) {
	Convey("Test alert evaluation handler", t, func() {
		handler := NewEvalHandler()

		Convey("Show return triggered with single passing condition", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{&conditionStub{
					firing: true,
				}},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, true)
			So(context.ConditionEvals, ShouldEqual, "true = true")
		})

		Convey("Show return false with not passing asdf", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true, operator: "and", matches: []*EvalMatch{{}, {}}},
					&conditionStub{firing: false, operator: "and"},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, false)
			So(context.ConditionEvals, ShouldEqual, "[true AND false] = false")
		})

		Convey("Show return true if any of the condition is passing with OR operator", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true, operator: "and"},
					&conditionStub{firing: false, operator: "or"},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, true)
			So(context.ConditionEvals, ShouldEqual, "[true OR false] = true")
		})

		Convey("Show return false if any of the condition is failing with AND operator", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true, operator: "and"},
					&conditionStub{firing: false, operator: "and"},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, false)
			So(context.ConditionEvals, ShouldEqual, "[true AND false] = false")
		})

		Convey("Show return true if one condition is failing with nested OR operator", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true, operator: "and"},
					&conditionStub{firing: true, operator: "and"},
					&conditionStub{firing: false, operator: "or"},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, true)
			So(context.ConditionEvals, ShouldEqual, "[[true AND true] OR false] = true")
		})

		Convey("Show return false if one condition is passing with nested OR operator", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true, operator: "and"},
					&conditionStub{firing: false, operator: "and"},
					&conditionStub{firing: false, operator: "or"},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, false)
			So(context.ConditionEvals, ShouldEqual, "[[true AND false] OR false] = false")
		})

		Convey("Show return false if a condition is failing with nested AND operator", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true, operator: "and"},
					&conditionStub{firing: false, operator: "and"},
					&conditionStub{firing: true, operator: "and"},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, false)
			So(context.ConditionEvals, ShouldEqual, "[[true AND false] AND true] = false")
		})

		Convey("Show return true if a condition is passing with nested OR operator", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true, operator: "and"},
					&conditionStub{firing: false, operator: "or"},
					&conditionStub{firing: true, operator: "or"},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, true)
			So(context.ConditionEvals, ShouldEqual, "[[true OR false] OR true] = true")
		})

		Convey("Should return no data if one condition has nodata", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{operator: "and", noData: true},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, false)
			So(context.NoDataFound, ShouldBeTrue)
		})

		Convey("Should return no data if both conditions have no data and using AND", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{operator: "and", noData: true},
					&conditionStub{operator: "and", noData: false},
				},
			})

			handler.Eval(context)
			So(context.NoDataFound, ShouldBeFalse)
		})

		Convey("Should not return no data if both conditions have no data and using OR", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{operator: "or", noData: true},
					&conditionStub{operator: "or", noData: false},
				},
			})

			handler.Eval(context)
			So(context.NoDataFound, ShouldBeTrue)
		})

		Convey("EvalHandler can replace alert state based for errors and no_data", func() {
			ctx := NewEvalContext(context.TODO(), &Rule{Conditions: []Condition{&conditionStub{firing: true}}})
			dummieError := fmt.Errorf("dummie error")
			Convey("Should update alert state", func() {

				Convey("ok -> alerting", func() {
					ctx.PrevAlertState = models.AlertStateOK
					ctx.Firing = true

					So(handler.getNewState(ctx), ShouldEqual, models.AlertStateAlerting)
				})

				Convey("ok -> error(alerting)", func() {
					ctx.PrevAlertState = models.AlertStateOK
					ctx.Error = dummieError
					ctx.Rule.ExecutionErrorState = models.ExecutionErrorSetAlerting

					ctx.Rule.State = handler.getNewState(ctx)
					So(ctx.Rule.State, ShouldEqual, models.AlertStateAlerting)
				})

				Convey("ok -> error(keep_last)", func() {
					ctx.PrevAlertState = models.AlertStateOK
					ctx.Error = dummieError
					ctx.Rule.ExecutionErrorState = models.ExecutionErrorKeepState

					ctx.Rule.State = handler.getNewState(ctx)
					So(ctx.Rule.State, ShouldEqual, models.AlertStateOK)
				})

				Convey("pending -> error(keep_last)", func() {
					ctx.PrevAlertState = models.AlertStatePending
					ctx.Error = dummieError
					ctx.Rule.ExecutionErrorState = models.ExecutionErrorKeepState

					ctx.Rule.State = handler.getNewState(ctx)
					So(ctx.Rule.State, ShouldEqual, models.AlertStatePending)
				})

				Convey("ok -> no_data(alerting)", func() {
					ctx.PrevAlertState = models.AlertStateOK
					ctx.Rule.NoDataState = models.NoDataSetAlerting
					ctx.NoDataFound = true

					ctx.Rule.State = handler.getNewState(ctx)
					So(ctx.Rule.State, ShouldEqual, models.AlertStateAlerting)
				})

				Convey("ok -> no_data(keep_last)", func() {
					ctx.PrevAlertState = models.AlertStateOK
					ctx.Rule.NoDataState = models.NoDataKeepState
					ctx.NoDataFound = true

					ctx.Rule.State = handler.getNewState(ctx)
					So(ctx.Rule.State, ShouldEqual, models.AlertStateOK)
				})

				Convey("pending -> no_data(keep_last)", func() {
					ctx.PrevAlertState = models.AlertStatePending
					ctx.Rule.NoDataState = models.NoDataKeepState
					ctx.NoDataFound = true

					ctx.Rule.State = handler.getNewState(ctx)
					So(ctx.Rule.State, ShouldEqual, models.AlertStatePending)
				})
			})
		})
	})
}
