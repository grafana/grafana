package conditions

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func test(json string, reducedValue float64) bool {
	jsonModel, err := simplejson.NewJson([]byte(json))
	So(err, ShouldBeNil)

	evaluator, err := NewAlertEvaluator(jsonModel)
	So(err, ShouldBeNil)

	return evaluator.Eval(&tsdb.TimeSeries{}, reducedValue)
}

func TestEvalutors(t *testing.T) {
	Convey("greater then", t, func() {
		So(test(`{"type": "gt", "params": [1] }`, 3), ShouldBeTrue)
		So(test(`{"type": "gt", "params": [3] }`, 1), ShouldBeFalse)
	})

	Convey("less then", t, func() {
		So(test(`{"type": "lt", "params": [1] }`, 3), ShouldBeFalse)
		So(test(`{"type": "lt", "params": [3] }`, 1), ShouldBeTrue)
	})

	Convey("within_range", t, func() {
		So(test(`{"type": "within_range", "params": [1, 100] }`, 3), ShouldBeTrue)
		So(test(`{"type": "within_range", "params": [1, 100] }`, 300), ShouldBeFalse)
		So(test(`{"type": "within_range", "params": [100, 1] }`, 3), ShouldBeTrue)
		So(test(`{"type": "within_range", "params": [100, 1] }`, 300), ShouldBeFalse)
	})

	Convey("outside_range", t, func() {
		So(test(`{"type": "outside_range", "params": [1, 100] }`, 1000), ShouldBeTrue)
		So(test(`{"type": "outside_range", "params": [1, 100] }`, 50), ShouldBeFalse)
		So(test(`{"type": "outside_range", "params": [100, 1] }`, 1000), ShouldBeTrue)
		So(test(`{"type": "outside_range", "params": [100, 1] }`, 50), ShouldBeFalse)
	})
}
