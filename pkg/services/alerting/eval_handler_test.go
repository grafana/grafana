package alerting

import (
	"context"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

type conditionStub struct {
	firing bool
}

func (c *conditionStub) Eval(context *EvalContext) {
	context.Firing = c.firing
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

		Convey("Show return false with not passing condition", func() {
			context := NewEvalContext(context.TODO(), &Rule{
				Conditions: []Condition{
					&conditionStub{firing: true},
					&conditionStub{firing: false},
				},
			})

			handler.Eval(context)
			So(context.Firing, ShouldEqual, false)
		})
	})
}
