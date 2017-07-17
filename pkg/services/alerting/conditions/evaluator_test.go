package conditions

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func evalutorScenario(json string, seriesName string, reducedValue float64, datapoints ...float64) bool {
	jsonModel, err := simplejson.NewJson([]byte(json))
	So(err, ShouldBeNil)

	evaluator, err := NewAlertEvaluator(nil, jsonModel)
	So(err, ShouldBeNil)

	return evaluator.Eval(seriesName, null.FloatFrom(reducedValue))
}

func TestEvalutors(t *testing.T) {
	Convey("greater then", t, func() {
		So(evalutorScenario(`{"type": "gt", "params": [1] }`, "series", 3), ShouldBeTrue)
		So(evalutorScenario(`{"type": "gt", "params": [3] }`, "series", 1), ShouldBeFalse)
	})

	Convey("less then", t, func() {
		So(evalutorScenario(`{"type": "lt", "params": [1] }`, "series", 3), ShouldBeFalse)
		So(evalutorScenario(`{"type": "lt", "params": [3] }`, "series", 1), ShouldBeTrue)
	})

	Convey("within_range", t, func() {
		So(evalutorScenario(`{"type": "within_range", "params": [1, 100] }`, "series", 3), ShouldBeTrue)
		So(evalutorScenario(`{"type": "within_range", "params": [1, 100] }`, "series", 300), ShouldBeFalse)
		So(evalutorScenario(`{"type": "within_range", "params": [100, 1] }`, "series", 3), ShouldBeTrue)
		So(evalutorScenario(`{"type": "within_range", "params": [100, 1] }`, "series", 300), ShouldBeFalse)
	})

	Convey("outside_range", t, func() {
		So(evalutorScenario(`{"type": "outside_range", "params": [1, 100] }`, "series", 1000), ShouldBeTrue)
		So(evalutorScenario(`{"type": "outside_range", "params": [1, 100] }`, "series", 50), ShouldBeFalse)
		So(evalutorScenario(`{"type": "outside_range", "params": [100, 1] }`, "series", 1000), ShouldBeTrue)
		So(evalutorScenario(`{"type": "outside_range", "params": [100, 1] }`, "series", 50), ShouldBeFalse)
	})

	Convey("no_value", t, func() {
		Convey("should be false if serie have values", func() {
			So(evalutorScenario(`{"type": "no_value", "params": [] }`, "series", 50), ShouldBeFalse)
		})

		Convey("should be true when the serie have no value", func() {
			jsonModel, err := simplejson.NewJson([]byte(`{"type": "no_value", "params": [] }`))
			So(err, ShouldBeNil)

			evaluator, err := NewAlertEvaluator(nil, jsonModel)
			So(err, ShouldBeNil)

			So(evaluator.Eval("series", null.FloatFromPtr(nil)), ShouldBeTrue)

		})
	})
}
