package expr

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestConvertTimeSeriesMultiToFullLong(t *testing.T) {
	t.Run("SingleSeriesNoLabels", func(t *testing.T) {
		times := []time.Time{
			time.Unix(0, 0),
			time.Unix(10, 0),
			time.Unix(20, 0),
		}
		values := []float64{1.0, 2.0, 3.0}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", nil, values),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}

		expected := data.NewFrame("",
			data.NewField("time", nil, times),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0), fp(3.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu", "cpu"}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoSeriesOneLabel", func(t *testing.T) {
		times := []time.Time{
			time.Unix(0, 0),
			time.Unix(10, 0),
		}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0, 2.0}),
			),
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", data.Labels{"host": "b"}, []float64{3.0, 4.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}
		input[1].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{
				time.Unix(0, 0), time.Unix(0, 0), time.Unix(10, 0), time.Unix(10, 0),
			}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(3.0), fp(2.0), fp(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu", "cpu", "cpu"}),
			data.NewField("host", nil, []*string{sp("a"), sp("b"), sp("a"), sp("b")}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoMetricsWithSharedLabels", func(t *testing.T) {
		times := []time.Time{
			time.Unix(0, 0),
			time.Unix(10, 0),
		}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0, 2.0}),
			),
			data.NewFrame("mem",
				data.NewField("time", nil, times),
				data.NewField("mem", data.Labels{"host": "a"}, []float64{3.0, 4.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}
		input[1].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{
				time.Unix(0, 0), time.Unix(0, 0), time.Unix(10, 0), time.Unix(10, 0),
			}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(3.0), fp(2.0), fp(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "mem", "cpu", "mem"}),
			data.NewField("host", nil, []*string{sp("a"), sp("a"), sp("a"), sp("a")}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoSeriesSparseLabels", func(t *testing.T) {
		times := []time.Time{
			time.Unix(0, 0),
			time.Unix(10, 0),
		}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0, 2.0}),
			),
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", data.Labels{"host": "b", "env": "prod"}, []float64{3.0, 4.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}
		input[1].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{
				time.Unix(0, 0), time.Unix(0, 0), time.Unix(10, 0), time.Unix(10, 0),
			}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(3.0), fp(2.0), fp(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu", "cpu", "cpu"}),
			data.NewField("env", nil, []*string{nil, sp("prod"), nil, sp("prod")}),
			data.NewField("host", nil, []*string{sp("a"), sp("b"), sp("a"), sp("b")}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoSeriesSparseMetrics", func(t *testing.T) {
		times := []time.Time{
			time.Unix(0, 0),
			time.Unix(10, 0),
		}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0, 2.0}),
			),
			data.NewFrame("mem",
				data.NewField("time", nil, times),
				data.NewField("mem", data.Labels{"host": "b"}, []float64{3.0, 4.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}
		input[1].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{
				time.Unix(0, 0), time.Unix(0, 0), time.Unix(10, 0), time.Unix(10, 0),
			}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(3.0), fp(2.0), fp(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "mem", "cpu", "mem"}),
			data.NewField("host", nil, []*string{sp("a"), sp("b"), sp("a"), sp("b")}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoSeriesSparseMetricsAndLabels", func(t *testing.T) {
		times := []time.Time{
			time.Unix(0, 0),
			time.Unix(10, 0),
		}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0, 2.0}),
			),
			data.NewFrame("mem",
				data.NewField("time", nil, times),
				data.NewField("mem", data.Labels{"host": "b", "env": "prod"}, []float64{3.0, 4.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}
		input[1].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{
				time.Unix(0, 0), time.Unix(0, 0), time.Unix(10, 0), time.Unix(10, 0),
			}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(3.0), fp(2.0), fp(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "mem", "cpu", "mem"}),
			data.NewField("env", nil, []*string{nil, sp("prod"), nil, sp("prod")}),
			data.NewField("host", nil, []*string{sp("a"), sp("b"), sp("a"), sp("b")}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("ThreeSeriesSparseTimeLabelsMetrics", func(t *testing.T) {
		timesA := []time.Time{
			time.Unix(0, 0),
			time.Unix(10, 0),
		}
		timesB := []time.Time{
			time.Unix(5, 0),
			time.Unix(15, 0),
		}
		timesMem := []time.Time{
			time.Unix(10, 0),
			time.Unix(30, 0),
		}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, timesA),
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0, 2.0}),
			),
			data.NewFrame("cpu",
				data.NewField("time", nil, timesB),
				data.NewField("cpu", nil, []float64{9.0, 10.0}), // no labels
			),
			data.NewFrame("mem",
				data.NewField("time", nil, timesMem),
				data.NewField("mem", data.Labels{"host": "b", "env": "prod"}, []float64{3.0, 4.0}),
			),
		}
		for _, f := range input {
			f.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}
		}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{
				time.Unix(0, 0),  // cpu a
				time.Unix(5, 0),  // cpu no label
				time.Unix(10, 0), // cpu a
				time.Unix(10, 0), // mem
				time.Unix(15, 0), // cpu no label
				time.Unix(30, 0), // mem
			}),
			data.NewField(SQLValueFieldName, nil, []*float64{
				fp(1.0), fp(9.0), fp(2.0), fp(3.0), fp(10.0), fp(4.0),
			}),
			data.NewField(SQLMetricFieldName, nil, []string{
				"cpu", "cpu", "cpu", "mem", "cpu", "mem",
			}),
			data.NewField("env", nil, []*string{
				nil, nil, nil, sp("prod"), nil, sp("prod"),
			}),
			data.NewField("host", nil, []*string{
				sp("a"), nil, sp("a"), sp("b"), nil, sp("b"),
			}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})
}

func TestConvertTimeSeriesMultiToFullLongWithDisplayName(t *testing.T) {
	t.Run("SingleSeriesWithDisplayName", func(t *testing.T) {
		times := []time.Time{time.Unix(0, 0), time.Unix(10, 0)}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				func() *data.Field {
					f := data.NewField("cpu", nil, []float64{1.0, 2.0})
					f.Config = &data.FieldConfig{DisplayNameFromDS: "CPU Display"}
					return f
				}(),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}

		expected := data.NewFrame("",
			data.NewField("time", nil, times),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLDisplayFieldName, nil, []*string{sp("CPU Display"), sp("CPU Display")}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("TwoSeriesMixedDisplayNames", func(t *testing.T) {
		times := []time.Time{time.Unix(0, 0), time.Unix(10, 0)}

		input := data.Frames{
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				func() *data.Field {
					f := data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0, 2.0})
					f.Config = &data.FieldConfig{DisplayNameFromDS: "CPU A"}
					return f
				}(),
			),
			data.NewFrame("cpu",
				data.NewField("time", nil, times),
				data.NewField("cpu", data.Labels{"host": "b"}, []float64{3.0, 4.0}),
			),
		}
		for _, f := range input {
			f.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}
		}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{
				times[0], times[0], times[1], times[1],
			}),
			data.NewField(SQLValueFieldName, nil, []*float64{
				fp(1.0), fp(3.0), fp(2.0), fp(4.0),
			}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu", "cpu", "cpu"}),
			data.NewField(SQLDisplayFieldName, nil, []*string{
				sp("CPU A"), nil, sp("CPU A"), nil,
			}),
			data.NewField("host", nil, []*string{
				sp("a"), sp("b"), sp("a"), sp("b"),
			}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Mismatch (-want +got):\n%s", diff)
		}
	})
}
