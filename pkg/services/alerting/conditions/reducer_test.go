package conditions

import (
	"testing"

	"gopkg.in/guregu/null.v3"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSimpleReducer(t *testing.T) {
	Convey("Test simple reducer by calculating", t, func() {
		Convey("avg", func() {
			result := testReducer("avg", 1, 2, 3)
			So(result, ShouldEqual, float64(2))
		})

		Convey("sum", func() {
			result := testReducer("sum", 1, 2, 3)
			So(result, ShouldEqual, float64(6))
		})

		Convey("min", func() {
			result := testReducer("min", 3, 2, 1)
			So(result, ShouldEqual, float64(1))
		})

		Convey("max", func() {
			result := testReducer("max", 1, 2, 3)
			So(result, ShouldEqual, float64(3))
		})

		Convey("count", func() {
			result := testReducer("count", 1, 2, 3000)
			So(result, ShouldEqual, float64(3))
		})
	})
}

func testReducer(typ string, datapoints ...float64) float64 {
	reducer := NewSimpleReducer(typ)
	series := &tsdb.TimeSeries{
		Name: "test time serie",
	}

	for idx := range datapoints {
		series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(datapoints[idx]), 1234134))
	}

	return reducer.Reduce(series).Float64
}
