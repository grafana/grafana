package conditions

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func evaluatorScenario(json string, reducedValue float64, datapoints ...float64) bool {
	jsonModel, err := simplejson.NewJson([]byte(json))
	So(err, ShouldBeNil)

	evaluator, err := NewAlertEvaluator(jsonModel)
	So(err, ShouldBeNil)

	return evaluator.Eval(null.FloatFrom(reducedValue))
}

func TestEvaluators(t *testing.T) {
	Convey("greater then", t, func() {
		So(evaluatorScenario(`{"type": "gt", "params": [1] }`, 3), ShouldBeTrue)
		So(evaluatorScenario(`{"type": "gt", "params": [3] }`, 1), ShouldBeFalse)
	})

	Convey("less then", t, func() {
		So(evaluatorScenario(`{"type": "lt", "params": [1] }`, 3), ShouldBeFalse)
		So(evaluatorScenario(`{"type": "lt", "params": [3] }`, 1), ShouldBeTrue)
	})

	Convey("within_range", t, func() {
		So(evaluatorScenario(`{"type": "within_range", "params": [1, 100] }`, 3), ShouldBeTrue)
		So(evaluatorScenario(`{"type": "within_range", "params": [1, 100] }`, 300), ShouldBeFalse)
		So(evaluatorScenario(`{"type": "within_range", "params": [100, 1] }`, 3), ShouldBeTrue)
		So(evaluatorScenario(`{"type": "within_range", "params": [100, 1] }`, 300), ShouldBeFalse)
	})

	Convey("outside_range", t, func() {
		So(evaluatorScenario(`{"type": "outside_range", "params": [1, 100] }`, 1000), ShouldBeTrue)
		So(evaluatorScenario(`{"type": "outside_range", "params": [1, 100] }`, 50), ShouldBeFalse)
		So(evaluatorScenario(`{"type": "outside_range", "params": [100, 1] }`, 1000), ShouldBeTrue)
		So(evaluatorScenario(`{"type": "outside_range", "params": [100, 1] }`, 50), ShouldBeFalse)
	})

	Convey("no_value", t, func() {
		Convey("should be false if series have values", func() {
			So(evaluatorScenario(`{"type": "no_value", "params": [] }`, 50), ShouldBeFalse)
		})

		Convey("should be true when the series have no value", func() {
			jsonModel, err := simplejson.NewJson([]byte(`{"type": "no_value", "params": [] }`))
			So(err, ShouldBeNil)

			evaluator, err := NewAlertEvaluator(jsonModel)
			So(err, ShouldBeNil)

			So(evaluator.Eval(null.FloatFromPtr(nil)), ShouldBeTrue)
		})
	})
}
