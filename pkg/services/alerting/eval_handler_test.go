package alerting

import (
	"context"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

type conditionStub struct {
	firing  bool
	matches []*EvalMatch
}

func (c *conditionStub) Eval(context *EvalContext) (*ConditionResult, error) {
	return &ConditionResult{Firing: c.firing, EvalMatches: c.matches}, nil
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
	})
}
