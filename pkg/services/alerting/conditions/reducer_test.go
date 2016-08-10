package conditions

import (
	"testing"

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

		Convey("mean odd numbers", func() {
			result := testReducer("mean", 1, 2, 3000)
			So(result, ShouldEqual, float64(2))
		})

	})
}

func testReducer(typ string, datapoints ...float64) float64 {
	reducer := NewSimpleReducer(typ)
	var timeserie [][2]float64
	dummieTimestamp := float64(521452145)

	for _, v := range datapoints {
		timeserie = append(timeserie, [2]float64{v, dummieTimestamp})
	}

	tsdb := &tsdb.TimeSeries{
		Name:   "test time serie",
		Points: timeserie,
	}
	return reducer.Reduce(tsdb)
}
