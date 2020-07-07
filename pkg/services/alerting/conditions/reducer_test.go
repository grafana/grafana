package conditions

import (
	"math"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/tsdb"
)

func TestSimpleReducer(t *testing.T) {
	Convey("Test simple reducer by calculating", t, func() {
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

		Convey("last", func() {
			result := testReducer("last", 1, 2, 3000)
			So(result, ShouldEqual, float64(3000))
		})

		Convey("median odd amount of numbers", func() {
			result := testReducer("median", 1, 2, 3000)
			So(result, ShouldEqual, float64(2))
		})

		Convey("median even amount of numbers", func() {
			result := testReducer("median", 1, 2, 4, 3000)
			So(result, ShouldEqual, float64(3))
		})

		Convey("median with one values", func() {
			result := testReducer("median", 1)
			So(result, ShouldEqual, float64(1))
		})

		Convey("median should ignore null values", func() {
			reducer := newSimpleReducer("median")
			series := &tsdb.TimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 1))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 2))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 3))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(float64(1)), 4))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(float64(2)), 5))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(float64(3)), 6))

			result := reducer.Reduce(series)
			So(result.Valid, ShouldEqual, true)
			So(result.Float64, ShouldEqual, float64(2))
		})

		Convey("avg", func() {
			result := testReducer("avg", 1, 2, 3)
			So(result, ShouldEqual, float64(2))
		})

		Convey("avg with only nulls", func() {
			reducer := newSimpleReducer("avg")
			series := &tsdb.TimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 1))
			So(reducer.Reduce(series).Valid, ShouldEqual, false)
		})

		Convey("count_non_null", func() {
			Convey("with null values and real values", func() {
				reducer := newSimpleReducer("count_non_null")
				series := &tsdb.TimeSeries{
					Name: "test time series",
				}

				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 1))
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 2))
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(3), 3))
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(3), 4))

				So(reducer.Reduce(series).Valid, ShouldEqual, true)
				So(reducer.Reduce(series).Float64, ShouldEqual, 2)
			})

			Convey("with null values", func() {
				reducer := newSimpleReducer("count_non_null")
				series := &tsdb.TimeSeries{
					Name: "test time series",
				}

				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 1))
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 2))

				So(reducer.Reduce(series).Valid, ShouldEqual, false)
			})
		})

		Convey("avg of number values and null values should ignore nulls", func() {
			reducer := newSimpleReducer("avg")
			series := &tsdb.TimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(3), 1))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 2))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 3))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(3), 4))

			So(reducer.Reduce(series).Float64, ShouldEqual, float64(3))
		})

		// diff function Test Suite
		Convey("diff of one positive point", func() {
			result := testReducer("diff", 30)
			So(result, ShouldEqual, float64(0))
		})

		Convey("diff of one negative point", func() {
			result := testReducer("diff", -30)
			So(result, ShouldEqual, float64(0))
		})

		Convey("diff of two positive points[1]", func() {
			result := testReducer("diff", 30, 40)
			So(result, ShouldEqual, float64(10))
		})

		Convey("diff of two positive points[2]", func() {
			result := testReducer("diff", 30, 20)
			So(result, ShouldEqual, float64(-10))
		})

		Convey("diff of two negative points[1]", func() {
			result := testReducer("diff", -30, -40)
			So(result, ShouldEqual, float64(-10))
		})

		Convey("diff of two negative points[2]", func() {
			result := testReducer("diff", -30, -10)
			So(result, ShouldEqual, float64(20))
		})

		Convey("diff of one positive and one negative point", func() {
			result := testReducer("diff", 30, -40)
			So(result, ShouldEqual, float64(-70))
		})

		Convey("diff of one negative and one positive point", func() {
			result := testReducer("diff", -30, 40)
			So(result, ShouldEqual, float64(70))
		})

		Convey("diff of three positive points", func() {
			result := testReducer("diff", 30, 40, 50)
			So(result, ShouldEqual, float64(20))
		})

		Convey("diff of three negative points", func() {
			result := testReducer("diff", -30, -40, -50)
			So(result, ShouldEqual, float64(-20))
		})

		Convey("diff with only nulls", func() {
			reducer := newSimpleReducer("diff")
			series := &tsdb.TimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 1))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 2))

			So(reducer.Reduce(series).Valid, ShouldEqual, false)
		})

		// diff_abs function Test Suite
		Convey("diff_abs of one positive point", func() {
			result := testReducer("diff_abs", 30)
			So(result, ShouldEqual, float64(0))
		})

		Convey("diff_abs of one negative point", func() {
			result := testReducer("diff_abs", -30)
			So(result, ShouldEqual, float64(0))
		})

		Convey("diff_abs of two positive points[1]", func() {
			result := testReducer("diff_abs", 30, 40)
			So(result, ShouldEqual, float64(10))
		})

		Convey("diff_abs of two positive points[2]", func() {
			result := testReducer("diff_abs", 30, 20)
			So(result, ShouldEqual, float64(10))
		})

		Convey("diff_abs of two negative points[1]", func() {
			result := testReducer("diff_abs", -30, -40)
			So(result, ShouldEqual, float64(10))
		})

		Convey("diff_abs of two negative points[2]", func() {
			result := testReducer("diff_abs", -30, -10)
			So(result, ShouldEqual, float64(20))
		})

		Convey("diff_abs of one positive and one negative point", func() {
			result := testReducer("diff_abs", 30, -40)
			So(result, ShouldEqual, float64(70))
		})

		Convey("diff_abs of one negative and one positive point", func() {
			result := testReducer("diff_abs", -30, 40)
			So(result, ShouldEqual, float64(70))
		})

		Convey("diff_abs of three positive points", func() {
			result := testReducer("diff_abs", 30, 40, 50)
			So(result, ShouldEqual, float64(20))
		})

		Convey("diff_abs of three negative points", func() {
			result := testReducer("diff_abs", -30, -40, -50)
			So(result, ShouldEqual, float64(20))
		})

		Convey("diff_abs with only nulls", func() {
			reducer := newSimpleReducer("diff_abs")
			series := &tsdb.TimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 1))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 2))

			So(reducer.Reduce(series).Valid, ShouldEqual, false)
		})

		// percent_diff function Test Suite
		Convey("percent_diff of one positive point", func() {
			result := testReducer("percent_diff", 30)
			So(result, ShouldEqual, float64(0))
		})

		Convey("percent_diff of one negative point", func() {
			result := testReducer("percent_diff", -30)
			So(result, ShouldEqual, float64(0))
		})

		Convey("percent_diff of two positive points[1]", func() {
			result := testReducer("percent_diff", 30, 40)
			So(result, ShouldEqual, float64(33.33333333333333))
		})

		Convey("percent_diff of two positive points[2]", func() {
			result := testReducer("percent_diff", 30, 20)
			So(result, ShouldEqual, float64(-33.33333333333333))
		})

		Convey("percent_diff of two negative points[1]", func() {
			result := testReducer("percent_diff", -30, -40)
			So(result, ShouldEqual, float64(-33.33333333333333))
		})

		Convey("percent_diff of two negative points[2]", func() {
			result := testReducer("percent_diff", -30, -10)
			So(result, ShouldEqual, float64(66.66666666666666))
		})

		Convey("percent_diff of one positive and one negative point", func() {
			result := testReducer("percent_diff", 30, -40)
			So(result, ShouldEqual, float64(-233.33333333333334))
		})

		Convey("percent_diff of one negative and one positive point", func() {
			result := testReducer("percent_diff", -30, 40)
			So(result, ShouldEqual, float64(233.33333333333334))
		})

		Convey("percent_diff of three positive points", func() {
			result := testReducer("percent_diff", 30, 40, 50)
			So(result, ShouldEqual, float64(66.66666666666666))
		})

		Convey("percent_diff of three negative points", func() {
			result := testReducer("percent_diff", -30, -40, -50)
			So(result, ShouldEqual, float64(-66.66666666666666))
		})

		Convey("percent_diff with only nulls", func() {
			reducer := newSimpleReducer("percent_diff")
			series := &tsdb.TimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 1))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 2))

			So(reducer.Reduce(series).Valid, ShouldEqual, false)
		})

		// percent_diff_abs function Test Suite
		Convey("percent_diff_abs_abs of one positive point", func() {
			result := testReducer("percent_diff_abs", 30)
			So(result, ShouldEqual, float64(0))
		})

		Convey("percent_diff_abs of one negative point", func() {
			result := testReducer("percent_diff_abs", -30)
			So(result, ShouldEqual, float64(0))
		})

		Convey("percent_diff_abs of two positive points[1]", func() {
			result := testReducer("percent_diff_abs", 30, 40)
			So(result, ShouldEqual, float64(33.33333333333333))
		})

		Convey("percent_diff_abs of two positive points[2]", func() {
			result := testReducer("percent_diff_abs", 30, 20)
			So(result, ShouldEqual, float64(33.33333333333333))
		})

		Convey("percent_diff_abs of two negative points[1]", func() {
			result := testReducer("percent_diff_abs", -30, -40)
			So(result, ShouldEqual, float64(33.33333333333333))
		})

		Convey("percent_diff_abs of two negative points[2]", func() {
			result := testReducer("percent_diff_abs", -30, -10)
			So(result, ShouldEqual, float64(66.66666666666666))
		})

		Convey("percent_diff_abs of one positive and one negative point", func() {
			result := testReducer("percent_diff_abs", 30, -40)
			So(result, ShouldEqual, float64(233.33333333333334))
		})

		Convey("percent_diff_abs of one negative and one positive point", func() {
			result := testReducer("percent_diff_abs", -30, 40)
			So(result, ShouldEqual, float64(233.33333333333334))
		})

		Convey("percent_diff_abs of three positive points", func() {
			result := testReducer("percent_diff_abs", 30, 40, 50)
			So(result, ShouldEqual, float64(66.66666666666666))
		})

		Convey("percent_diff_abs of three negative points", func() {
			result := testReducer("percent_diff_abs", -30, -40, -50)
			So(result, ShouldEqual, float64(66.66666666666666))
		})

		Convey("percent_diff_abs with only nulls", func() {
			reducer := newSimpleReducer("percent_diff_abs")
			series := &tsdb.TimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 1))
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), 2))

			So(reducer.Reduce(series).Valid, ShouldEqual, false)
		})

		Convey("min should work with NaNs", func() {
			result := testReducer("min", math.NaN(), math.NaN(), math.NaN())
			So(result, ShouldEqual, float64(0))
		})

		Convey("isValid should treat NaN as invalid", func() {
			result := isValid(null.FloatFrom(math.NaN()))
			So(result, ShouldBeFalse)
		})

		Convey("isValid should treat invalid null.Float as invalid", func() {
			result := isValid(null.FloatFromPtr(nil))
			So(result, ShouldBeFalse)
		})
	})
}

func testReducer(reducerType string, datapoints ...float64) float64 {
	reducer := newSimpleReducer(reducerType)
	series := &tsdb.TimeSeries{
		Name: "test time series",
	}

	for idx := range datapoints {
		series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(datapoints[idx]), 1234134))
	}

	return reducer.Reduce(series).Float64
}
