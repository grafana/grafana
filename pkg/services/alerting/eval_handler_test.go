package alerting

import (
	"context"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

type conditionStub struct {
	firing   bool
	operator string
	matches  []*EvalMatch
}

func (c *conditionStub) Eval(context *EvalContext) (*ConditionResult, error) {
	return &ConditionResult{Firing: c.firing, EvalMatches: c.matches, Operator: c.operator}, nil
}

func TestAlertingExecutor(t *testing.T) {
	Convey("Test alert execution", t, func() {
		handler := NewEvalHandler()

		Convey("Show return triggered with single passing condition", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{&conditionStub{
					firing: true,
				}},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, true)
		})

		Convey("Show return false with not passing asdf", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true, matches: []*EvalMatch{&EvalMatch{}, &EvalMatch{}}},
					&conditionStub{firing: false},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, false)
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
		})
	})
}
