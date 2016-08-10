package conditions

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSimpleReducer(t *testing.T) {
	Convey("Test simple reducer", t, func() {
		Convey("can calculate avg of time serie", func() {
			result := testReducer("avg", 1, 2, 3)
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
