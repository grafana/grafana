package conditions

import (
	"math"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

func TestSimpleReducer(t *testing.T) {
	t.Run("sum", func(t *testing.T) {
		result := testReducer("sum", 1, 2, 3)
		require.Equal(t, float64(6), result)
	})

	t.Run("min", func(t *testing.T) {
		result := testReducer("min", 3, 2, 1)
		require.Equal(t, float64(1), result)
	})

	t.Run("max", func(t *testing.T) {
		result := testReducer("max", 1, 2, 3)
		require.Equal(t, float64(3), result)
	})

	t.Run("count", func(t *testing.T) {
		result := testReducer("count", 1, 2, 3000)
		require.Equal(t, float64(3), result)
	})

	t.Run("last", func(t *testing.T) {
		result := testReducer("last", 1, 2, 3000)
		require.Equal(t, float64(3000), result)
	})

	t.Run("median odd amount of numbers", func(t *testing.T) {
		result := testReducer("median", 1, 2, 3000)
		require.Equal(t, float64(2), result)
	})

	t.Run("median even amount of numbers", func(t *testing.T) {
		result := testReducer("median", 1, 2, 4, 3000)
		require.Equal(t, float64(3), result)
	})

	t.Run("median with one values", func(t *testing.T) {
		result := testReducer("median", 1)
		require.Equal(t, float64(1), result)
	})

	t.Run("median should ignore null values", func(t *testing.T) {
		reducer := newSimpleReducer("median")
		series := legacydata.DataTimeSeries{
			Name: "test time series",
		}

		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(1)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(2)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(3)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFrom(float64(1)), null.FloatFrom(4)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFrom(float64(2)), null.FloatFrom(5)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFrom(float64(3)), null.FloatFrom(6)})

		result := reducer.Reduce(series)
		require.Equal(t, true, result.Valid)
		require.Equal(t, float64(2), result.Float64)
	})

	t.Run("avg", func(t *testing.T) {
		result := testReducer("avg", 1, 2, 3)
		require.Equal(t, float64(2), result)
	})

	t.Run("avg with only nulls", func(t *testing.T) {
		reducer := newSimpleReducer("avg")
		series := legacydata.DataTimeSeries{
			Name: "test time series",
		}

		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(1)})
		require.Equal(t, false, reducer.Reduce(series).Valid)
	})

	t.Run("count_non_null", func(t *testing.T) {
		t.Run("with null values and real values", func(t *testing.T) {
			reducer := newSimpleReducer("count_non_null")
			series := legacydata.DataTimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(1)})
			series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(2)})
			series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFrom(3), null.FloatFrom(3)})
			series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFrom(3), null.FloatFrom(4)})

			require.Equal(t, true, reducer.Reduce(series).Valid)
			require.Equal(t, 2.0, reducer.Reduce(series).Float64)
		})

		t.Run("with null values", func(t *testing.T) {
			reducer := newSimpleReducer("count_non_null")
			series := legacydata.DataTimeSeries{
				Name: "test time series",
			}

			series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(1)})
			series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(2)})

			require.Equal(t, false, reducer.Reduce(series).Valid)
		})
	})

	t.Run("avg of number values and null values should ignore nulls", func(t *testing.T) {
		reducer := newSimpleReducer("avg")
		series := legacydata.DataTimeSeries{
			Name: "test time series",
		}

		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFrom(3), null.FloatFrom(1)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(2)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(3)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFrom(3), null.FloatFrom(4)})

		require.Equal(t, float64(3), reducer.Reduce(series).Float64)
	})

	// diff function Test Suite
	t.Run("diff of one positive point", func(t *testing.T) {
		result := testReducer("diff", 30)
		require.Equal(t, float64(0), result)
	})

	t.Run("diff of one negative point", func(t *testing.T) {
		result := testReducer("diff", -30)
		require.Equal(t, float64(0), result)
	})

	t.Run("diff of two positive points[1]", func(t *testing.T) {
		result := testReducer("diff", 30, 40)
		require.Equal(t, float64(10), result)
	})

	t.Run("diff of two positive points[2]", func(t *testing.T) {
		result := testReducer("diff", 30, 20)
		require.Equal(t, float64(-10), result)
	})

	t.Run("diff of two negative points[1]", func(t *testing.T) {
		result := testReducer("diff", -30, -40)
		require.Equal(t, float64(-10), result)
	})

	t.Run("diff of two negative points[2]", func(t *testing.T) {
		result := testReducer("diff", -30, -10)
		require.Equal(t, float64(20), result)
	})

	t.Run("diff of one positive and one negative point", func(t *testing.T) {
		result := testReducer("diff", 30, -40)
		require.Equal(t, float64(-70), result)
	})

	t.Run("diff of one negative and one positive point", func(t *testing.T) {
		result := testReducer("diff", -30, 40)
		require.Equal(t, float64(70), result)
	})

	t.Run("diff of three positive points", func(t *testing.T) {
		result := testReducer("diff", 30, 40, 50)
		require.Equal(t, float64(20), result)
	})

	t.Run("diff of three negative points", func(t *testing.T) {
		result := testReducer("diff", -30, -40, -50)
		require.Equal(t, float64(-20), result)
	})

	t.Run("diff with only nulls", func(t *testing.T) {
		reducer := newSimpleReducer("diff")
		series := legacydata.DataTimeSeries{
			Name: "test time series",
		}

		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(1)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(2)})

		require.Equal(t, false, reducer.Reduce(series).Valid)
	})

	// diff_abs function Test Suite
	t.Run("diff_abs of one positive point", func(t *testing.T) {
		result := testReducer("diff_abs", 30)
		require.Equal(t, float64(0), result)
	})

	t.Run("diff_abs of one negative point", func(t *testing.T) {
		result := testReducer("diff_abs", -30)
		require.Equal(t, float64(0), result)
	})

	t.Run("diff_abs of two positive points[1]", func(t *testing.T) {
		result := testReducer("diff_abs", 30, 40)
		require.Equal(t, float64(10), result)
	})

	t.Run("diff_abs of two positive points[2]", func(t *testing.T) {
		result := testReducer("diff_abs", 30, 20)
		require.Equal(t, float64(10), result)
	})

	t.Run("diff_abs of two negative points[1]", func(t *testing.T) {
		result := testReducer("diff_abs", -30, -40)
		require.Equal(t, float64(10), result)
	})

	t.Run("diff_abs of two negative points[2]", func(t *testing.T) {
		result := testReducer("diff_abs", -30, -10)
		require.Equal(t, float64(20), result)
	})

	t.Run("diff_abs of one positive and one negative point", func(t *testing.T) {
		result := testReducer("diff_abs", 30, -40)
		require.Equal(t, float64(70), result)
	})

	t.Run("diff_abs of one negative and one positive point", func(t *testing.T) {
		result := testReducer("diff_abs", -30, 40)
		require.Equal(t, float64(70), result)
	})

	t.Run("diff_abs of three positive points", func(t *testing.T) {
		result := testReducer("diff_abs", 30, 40, 50)
		require.Equal(t, float64(20), result)
	})

	t.Run("diff_abs of three negative points", func(t *testing.T) {
		result := testReducer("diff_abs", -30, -40, -50)
		require.Equal(t, float64(20), result)
	})

	t.Run("diff_abs with only nulls", func(t *testing.T) {
		reducer := newSimpleReducer("diff_abs")
		series := legacydata.DataTimeSeries{
			Name: "test time series",
		}

		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(1)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(2)})

		require.Equal(t, false, reducer.Reduce(series).Valid)
	})

	// percent_diff function Test Suite
	t.Run("percent_diff of one positive point", func(t *testing.T) {
		result := testReducer("percent_diff", 30)
		require.Equal(t, float64(0), result)
	})

	t.Run("percent_diff of one negative point", func(t *testing.T) {
		result := testReducer("percent_diff", -30)
		require.Equal(t, float64(0), result)
	})

	t.Run("percent_diff of two positive points[1]", func(t *testing.T) {
		result := testReducer("percent_diff", 30, 40)
		require.Equal(t, float64(33.33333333333333), result)
	})

	t.Run("percent_diff of two positive points[2]", func(t *testing.T) {
		result := testReducer("percent_diff", 30, 20)
		require.Equal(t, float64(-33.33333333333333), result)
	})

	t.Run("percent_diff of two negative points[1]", func(t *testing.T) {
		result := testReducer("percent_diff", -30, -40)
		require.Equal(t, float64(-33.33333333333333), result)
	})

	t.Run("percent_diff of two negative points[2]", func(t *testing.T) {
		result := testReducer("percent_diff", -30, -10)
		require.Equal(t, float64(66.66666666666666), result)
	})

	t.Run("percent_diff of one positive and one negative point", func(t *testing.T) {
		result := testReducer("percent_diff", 30, -40)
		require.Equal(t, float64(-233.33333333333334), result)
	})

	t.Run("percent_diff of one negative and one positive point", func(t *testing.T) {
		result := testReducer("percent_diff", -30, 40)
		require.Equal(t, float64(233.33333333333334), result)
	})

	t.Run("percent_diff of three positive points", func(t *testing.T) {
		result := testReducer("percent_diff", 30, 40, 50)
		require.Equal(t, float64(66.66666666666666), result)
	})

	t.Run("percent_diff of three negative points", func(t *testing.T) {
		result := testReducer("percent_diff", -30, -40, -50)
		require.Equal(t, float64(-66.66666666666666), result)
	})

	t.Run("percent_diff with only nulls", func(t *testing.T) {
		reducer := newSimpleReducer("percent_diff")
		series := legacydata.DataTimeSeries{
			Name: "test time series",
		}

		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(1)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(2)})

		require.Equal(t, false, reducer.Reduce(series).Valid)
	})

	// percent_diff_abs function Test Suite
	t.Run("percent_diff_abs_abs of one positive point", func(t *testing.T) {
		result := testReducer("percent_diff_abs", 30)
		require.Equal(t, float64(0), result)
	})

	t.Run("percent_diff_abs of one negative point", func(t *testing.T) {
		result := testReducer("percent_diff_abs", -30)
		require.Equal(t, float64(0), result)
	})

	t.Run("percent_diff_abs of two positive points[1]", func(t *testing.T) {
		result := testReducer("percent_diff_abs", 30, 40)
		require.Equal(t, float64(33.33333333333333), result)
	})

	t.Run("percent_diff_abs of two positive points[2]", func(t *testing.T) {
		result := testReducer("percent_diff_abs", 30, 20)
		require.Equal(t, float64(33.33333333333333), result)
	})

	t.Run("percent_diff_abs of two negative points[1]", func(t *testing.T) {
		result := testReducer("percent_diff_abs", -30, -40)
		require.Equal(t, float64(33.33333333333333), result)
	})

	t.Run("percent_diff_abs of two negative points[2]", func(t *testing.T) {
		result := testReducer("percent_diff_abs", -30, -10)
		require.Equal(t, float64(66.66666666666666), result)
	})

	t.Run("percent_diff_abs of one positive and one negative point", func(t *testing.T) {
		result := testReducer("percent_diff_abs", 30, -40)
		require.Equal(t, float64(233.33333333333334), result)
	})

	t.Run("percent_diff_abs of one negative and one positive point", func(t *testing.T) {
		result := testReducer("percent_diff_abs", -30, 40)
		require.Equal(t, float64(233.33333333333334), result)
	})

	t.Run("percent_diff_abs of three positive points", func(t *testing.T) {
		result := testReducer("percent_diff_abs", 30, 40, 50)
		require.Equal(t, float64(66.66666666666666), result)
	})

	t.Run("percent_diff_abs of three negative points", func(t *testing.T) {
		result := testReducer("percent_diff_abs", -30, -40, -50)
		require.Equal(t, float64(66.66666666666666), result)
	})

	t.Run("percent_diff_abs with only nulls", func(t *testing.T) {
		reducer := newSimpleReducer("percent_diff_abs")
		series := legacydata.DataTimeSeries{
			Name: "test time series",
		}

		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(1)})
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFromPtr(nil), null.FloatFrom(2)})

		require.Equal(t, false, reducer.Reduce(series).Valid)
	})

	t.Run("min should work with NaNs", func(t *testing.T) {
		result := testReducer("min", math.NaN(), math.NaN(), math.NaN())
		require.Equal(t, float64(0), result)
	})

	t.Run("isValid should treat NaN as invalid", func(t *testing.T) {
		result := isValid(null.FloatFrom(math.NaN()))
		require.False(t, result)
	})

	t.Run("isValid should treat invalid null.Float as invalid", func(t *testing.T) {
		result := isValid(null.FloatFromPtr(nil))
		require.False(t, result)
	})
}

func testReducer(reducerType string, datapoints ...float64) float64 {
	reducer := newSimpleReducer(reducerType)
	series := legacydata.DataTimeSeries{
		Name: "test time series",
	}

	for idx := range datapoints {
		series.Points = append(series.Points, legacydata.DataTimePoint{null.FloatFrom(datapoints[idx]), null.FloatFrom(1234134)})
	}

	return reducer.Reduce(series).Float64
}
