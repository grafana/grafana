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
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(2.0), new(3.0)}),
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
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(3.0), new(2.0), new(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu", "cpu", "cpu"}),
			data.NewField("host", nil, []*string{new("a"), new("b"), new("a"), new("b")}),
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
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(3.0), new(2.0), new(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "mem", "cpu", "mem"}),
			data.NewField("host", nil, []*string{new("a"), new("a"), new("a"), new("a")}),
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
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(3.0), new(2.0), new(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu", "cpu", "cpu"}),
			data.NewField("env", nil, []*string{nil, new("prod"), nil, new("prod")}),
			data.NewField("host", nil, []*string{new("a"), new("b"), new("a"), new("b")}),
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
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(3.0), new(2.0), new(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "mem", "cpu", "mem"}),
			data.NewField("host", nil, []*string{new("a"), new("b"), new("a"), new("b")}),
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
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(3.0), new(2.0), new(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "mem", "cpu", "mem"}),
			data.NewField("env", nil, []*string{nil, new("prod"), nil, new("prod")}),
			data.NewField("host", nil, []*string{new("a"), new("b"), new("a"), new("b")}),
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
				new(1.0), new(9.0), new(2.0), new(3.0), new(10.0), new(4.0),
			}),
			data.NewField(SQLMetricFieldName, nil, []string{
				"cpu", "cpu", "cpu", "mem", "cpu", "mem",
			}),
			data.NewField("env", nil, []*string{
				nil, nil, nil, new("prod"), nil, new("prod"),
			}),
			data.NewField("host", nil, []*string{
				new("a"), nil, new("a"), new("b"), nil, new("b"),
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
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(2.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLDisplayFieldName, nil, []*string{new("CPU Display"), new("CPU Display")}),
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
				new(1.0), new(3.0), new(2.0), new(4.0),
			}),
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu", "cpu", "cpu"}),
			data.NewField(SQLDisplayFieldName, nil, []*string{
				new("CPU A"), nil, new("CPU A"), nil,
			}),
			data.NewField("host", nil, []*string{
				new("a"), new("b"), new("a"), new("b"),
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

func TestConvertToFullLongLabelNamedLikeGeneratedColumn(t *testing.T) {
	times := []time.Time{time.Unix(0, 0)}

	tests := []struct {
		name     string
		input    data.Frames
		expected *data.Frame
	}{
		{
			name: "TimeSeriesMulti label named time",
			input: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, times),
					data.NewField("cpu", data.Labels{"time": "nightly", "host": "a"}, []float64{1}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			},
			expected: data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField(SQLValueFieldName, nil, []*float64{new(1.0)}),
				data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
				data.NewField("host", nil, []*string{new("a")}),
				data.NewField("label_time", nil, []*string{new("nightly")}),
			).SetMeta(&data.FrameMeta{Type: timeseriesFullLongType}),
		},
		{
			name: "TimeSeriesMulti label named like generated column in another case",
			input: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, times),
					data.NewField("cpu", data.Labels{"Time": "nightly", "__VALUE__": "v"}, []float64{1}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			},
			expected: data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField(SQLValueFieldName, nil, []*float64{new(1.0)}),
				data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
				data.NewField("label_Time", nil, []*string{new("nightly")}),
				data.NewField("label___VALUE__", nil, []*string{new("v")}),
			).SetMeta(&data.FrameMeta{Type: timeseriesFullLongType}),
		},
		{
			name: "TimeSeriesMulti renamed label skips a name another label already uses",
			input: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, times),
					data.NewField("cpu", data.Labels{"time": "nightly", "label_time": "x"}, []float64{1}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			},
			expected: data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField(SQLValueFieldName, nil, []*float64{new(1.0)}),
				data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
				data.NewField("label_time", nil, []*string{new("x")}),
				data.NewField("label_label_time", nil, []*string{new("nightly")}),
			).SetMeta(&data.FrameMeta{Type: timeseriesFullLongType}),
		},
		{
			name: "TimeSeriesWide labels named __value__ and __metric_name__",
			input: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, times),
					data.NewField("cpu", data.Labels{SQLValueFieldName: "v", SQLMetricFieldName: "m"}, []float64{1}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesWide}),
			},
			expected: data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField(SQLValueFieldName, nil, []*float64{new(1.0)}),
				data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
				data.NewField("label___metric_name__", nil, []*string{new("m")}),
				data.NewField("label___value__", nil, []*string{new("v")}),
			).SetMeta(&data.FrameMeta{Type: timeseriesFullLongType}),
		},
		{
			name: "TimeSeriesWide label named __display_name__ next to a display name column",
			input: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, times),
					data.NewField("cpu", data.Labels{SQLDisplayFieldName: "d"}, []float64{1}).
						SetConfig(&data.FieldConfig{DisplayNameFromDS: "CPU"}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesWide}),
			},
			expected: data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField(SQLValueFieldName, nil, []*float64{new(1.0)}),
				data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
				data.NewField(SQLDisplayFieldName, nil, []*string{new("CPU")}),
				data.NewField("label___display_name__", nil, []*string{new("d")}),
			).SetMeta(&data.FrameMeta{Type: timeseriesFullLongType}),
		},
		{
			name: "TimeSeriesWide label named __display_name__ without a display name column keeps its name",
			input: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, times),
					data.NewField("cpu", data.Labels{SQLDisplayFieldName: "d"}, []float64{1}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesWide}),
			},
			expected: data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField(SQLValueFieldName, nil, []*float64{new(1.0)}),
				data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
				data.NewField(SQLDisplayFieldName, nil, []*string{new("d")}),
			).SetMeta(&data.FrameMeta{Type: timeseriesFullLongType}),
		},
		{
			name: "NumericWide label named __value__, and time keeps its name",
			input: data.Frames{
				data.NewFrame("",
					data.NewField("cpu", data.Labels{SQLValueFieldName: "v", "time": "nightly"}, []float64{1}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericWide}),
			},
			expected: data.NewFrame("",
				data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
				data.NewField(SQLValueFieldName, nil, []*float64{new(1.0)}),
				data.NewField("label___value__", nil, []*string{new("v")}),
				data.NewField("time", nil, []*string{new("nightly")}),
			).SetMeta(&data.FrameMeta{Type: numericFullLongType}),
		},
		{
			name: "NumericMulti label named __metric_name__",
			input: data.Frames{
				data.NewFrame("",
					data.NewField("cpu", data.Labels{SQLMetricFieldName: "m"}, []float64{1}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericMulti}),
			},
			expected: data.NewFrame("",
				data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
				data.NewField(SQLValueFieldName, nil, []*float64{new(1.0)}),
				data.NewField("label___metric_name__", nil, []*string{new("m")}),
			).SetMeta(&data.FrameMeta{Type: numericFullLongType}),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			output, err := ConvertToFullLong(tc.input)
			require.NoError(t, err)
			require.Len(t, output, 1)
			if diff := cmp.Diff(tc.expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
				require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
			}
		})
	}
}

// Prometheus "Both" queries return numeric-multi (instant) and timeseries-multi
// (range) frames under one RefID, in either order.
func TestConvertMixedNumericAndTimeSeriesMultiToFullLong(t *testing.T) {
	instant := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{time.Unix(30, 0)}),
		data.NewField("up", data.Labels{"job": "a"}, []float64{1.0}),
	).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericMulti})
	rng := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{time.Unix(10, 0), time.Unix(20, 0)}),
		data.NewField("up", data.Labels{"job": "a"}, []float64{2.0, 3.0}),
	).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})

	expected := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(10, 0), time.Unix(20, 0), time.Unix(30, 0)}),
		data.NewField(SQLValueFieldName, nil, []*float64{new(2.0), new(3.0), new(1.0)}),
		data.NewField(SQLMetricFieldName, nil, []string{"up", "up", "up"}),
		data.NewField("job", nil, []*string{new("a"), new("a"), new("a")}),
	)
	expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

	for name, input := range map[string]data.Frames{
		"instant first": {instant, rng},
		"range first":   {rng, instant},
	} {
		t.Run(name, func(t *testing.T) {
			output, err := ConvertToFullLong(input)
			require.NoError(t, err)
			require.Len(t, output, 1)
			if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
				require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
			}
		})
	}
}

// Prometheus and Tempo append exemplar frames with no frame type after the series.
func TestConvertTimeSeriesMultiToFullLongSkipsOtherFrameTypes(t *testing.T) {
	series := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{time.Unix(10, 0), time.Unix(20, 0)}),
		data.NewField("rate", data.Labels{"job": "a"}, []float64{1.0, 2.0}),
	).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})
	exemplars := data.NewFrame("exemplar",
		data.NewField("Time", nil, []time.Time{time.Unix(15, 0)}),
		data.NewField("Value", nil, []float64{9.0}),
		data.NewField("trace_id", nil, []string{"abc"}),
	)
	table := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{time.Unix(15, 0)}),
		data.NewField("other", nil, []float64{7.0}),
	).SetMeta(&data.FrameMeta{Type: data.FrameTypeTable})

	expected := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(10, 0), time.Unix(20, 0)}),
		data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(2.0)}),
		data.NewField(SQLMetricFieldName, nil, []string{"rate", "rate"}),
		data.NewField("job", nil, []*string{new("a"), new("a")}),
	)
	expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

	output, err := ConvertToFullLong(data.Frames{series, exemplars, table})
	require.NoError(t, err)
	require.Len(t, output, 1)
	if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
		require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
	}
}

func TestConvertTimeSeriesToFullLongNonNumericFields(t *testing.T) {
	times := []time.Time{time.Unix(10, 0), time.Unix(20, 0)}
	updatedA := []*time.Time{new(time.Unix(11, 0)), new(time.Unix(21, 0))}
	updatedB := []*time.Time{new(time.Unix(12, 0)), nil}

	t.Run("multi: second time field and string field become columns", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField("value", data.Labels{"host": "a"}, []float64{1, 2}),
				data.NewField("updated", nil, updatedA),
				data.NewField("note", nil, []string{"x", "y"}),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField("value", data.Labels{"host": "b"}, []float64{3, 4}),
				data.NewField("updated", nil, updatedB),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
		}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{times[0], times[0], times[1], times[1]}),
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(3.0), new(2.0), new(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"value", "value", "value", "value"}),
			data.NewField("updated", nil, []*time.Time{updatedA[0], updatedB[0], updatedA[1], nil}),
			data.NewField("note", nil, []*string{new("x"), nil, new("y"), nil}),
			data.NewField("host", nil, []*string{new("a"), new("b"), new("a"), new("b")}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	// data.LongToWide output for a long frame with columns time, host, value, updated.
	t.Run("wide: each series keeps its own non-numeric values", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("",
				data.NewField("time", nil, times),
				data.NewField("value", data.Labels{"host": "a"}, []float64{1, 2}),
				data.NewField("updated", data.Labels{"host": "a"}, updatedA),
				data.NewField("value", data.Labels{"host": "b"}, []float64{3, 4}),
				data.NewField("updated", data.Labels{"host": "b"}, updatedB),
				data.NewField("note", data.Labels{"host": "b"}, []string{"x", "y"}),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesWide}),
		}

		expected := data.NewFrame("",
			data.NewField("time", nil, []time.Time{times[0], times[0], times[1], times[1]}),
			data.NewField(SQLValueFieldName, nil, []*float64{new(1.0), new(3.0), new(2.0), new(4.0)}),
			data.NewField(SQLMetricFieldName, nil, []string{"value", "value", "value", "value"}),
			data.NewField("updated", nil, []*time.Time{updatedA[0], updatedB[0], updatedA[1], nil}),
			data.NewField("note", nil, []*string{nil, new("x"), nil, new("y")}),
			data.NewField("host", nil, []*string{new("a"), new("b"), new("a"), new("b")}),
		)
		expected.Meta = &data.FrameMeta{Type: timeseriesFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("wide: unlabeled series do not take fields of labeled series", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("",
				data.NewField("time", nil, times[:1]),
				data.NewField("total", nil, []float64{1}),
				data.NewField("value", data.Labels{"host": "a"}, []float64{2}),
				data.NewField("updated", data.Labels{"host": "a"}, updatedA[:1]),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesWide}),
		}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		updated, idx := output[0].FieldByName("updated")
		require.NotEqual(t, -1, idx)
		metrics, idx := output[0].FieldByName(SQLMetricFieldName)
		require.NotEqual(t, -1, idx)
		require.Equal(t, "total", metrics.At(0))
		require.Nil(t, updated.At(0))
		require.Equal(t, "value", metrics.At(1))
		require.Equal(t, updatedA[0], updated.At(1))
	})

	t.Run("names that clash with generated columns or labels get a field_ prefix", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("",
				data.NewField("time", nil, times[:1]),
				data.NewField("value", data.Labels{"host": "a"}, []float64{1}),
				data.NewField("Time", nil, []string{"t"}),
				data.NewField("host", nil, []string{"h"}),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesWide}),
		}
		input[0].Fields[2].Labels = data.Labels{"host": "a"}
		input[0].Fields[3].Labels = data.Labels{"host": "a"}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		names := make([]string, 0, len(output[0].Fields))
		for _, f := range output[0].Fields {
			names = append(names, f.Name)
		}
		require.Equal(t, []string{"time", SQLValueFieldName, SQLMetricFieldName, "field_Time", "field_host", "host"}, names)
	})

	t.Run("one field name with two types errors", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("",
				data.NewField("time", nil, times[:1]),
				data.NewField("value", data.Labels{"host": "a"}, []float64{1}),
				data.NewField("updated", nil, []string{"x"}),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			data.NewFrame("",
				data.NewField("time", nil, times[:1]),
				data.NewField("value", data.Labels{"host": "b"}, []float64{2}),
				data.NewField("updated", nil, updatedA[:1]),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
		}

		_, err := ConvertToFullLong(input)
		require.ErrorContains(t, err, `field "updated" has type`)
	})
}
