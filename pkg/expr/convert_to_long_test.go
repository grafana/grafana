package expr

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestConvertNumericMultiToLong(t *testing.T) {
	input := data.Frames{
		data.NewFrame("test",
			data.NewField("Value", data.Labels{"city": "MIA"}, []int64{5})),
		data.NewFrame("test",
			data.NewField("Value", data.Labels{"city": "LGA"}, []int64{7}),
		),
	}
	expectedFrame := data.NewFrame("",
		data.NewField("Value", nil, []int64{5, 7}),
		data.NewField("city", nil, []string{"MIA", "LGA"}),
	)
	output, err := convertNumericMultiToNumericLong(input)
	require.NoError(t, err)

	if diff := cmp.Diff(expectedFrame, output[0], data.FrameTestCompareOptions()...); diff != "" {
		require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
	}
}

func TestConvertNumericWideToLong(t *testing.T) {
	input := data.Frames{
		data.NewFrame("test",
			data.NewField("Value", data.Labels{"city": "MIA"}, []int64{5}),
			data.NewField("Value", data.Labels{"city": "LGA"}, []int64{7}),
		),
	}
	expectedFrame := data.NewFrame("",
		data.NewField("Value", nil, []int64{5, 7}),
		data.NewField("city", nil, []string{"MIA", "LGA"}),
	)
	output, err := convertNumericWideToNumericLong(input)
	require.NoError(t, err)

	if diff := cmp.Diff(expectedFrame, output[0], data.FrameTestCompareOptions()...); diff != "" {
		require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
	}
}

func TestConvertTimeSeriesMultiToLong(t *testing.T) {
	t.Run("UnalignedTimestampsWithNamedFields", func(t *testing.T) {
		tLGA := []time.Time{
			time.UnixMilli(1664901845976),
			time.UnixMilli(1664902845976),
		}
		valLGA := []float64{3, 5}

		tMIA := []time.Time{
			time.UnixMilli(1664901855976),
			time.UnixMilli(1664902455976),
			time.UnixMilli(1664902855976),
		}
		valMIA := []float64{6, 7, 9}

		input := data.Frames{
			data.NewFrame("frameLGA",
				data.NewField("t", nil, tLGA),
				data.NewField("slothCount", data.Labels{"city": "LGA"}, valLGA),
			),
			data.NewFrame("frameMIA",
				data.NewField("t", nil, tMIA),
				data.NewField("slothCount", data.Labels{"city": "MIA"}, valMIA),
			),
		}

		expected := data.NewFrame("time_series_long",
			data.NewField("t", nil, []time.Time{
				tLGA[0],
				tMIA[0],
				tMIA[1],
				tLGA[1],
				tMIA[2],
			}),
			data.NewField("slothCount", nil, []float64{
				3, 6, 7, 5, 9,
			}),
			data.NewField("city", nil, []string{
				"LGA", "MIA", "MIA", "LGA", "MIA",
			}),
		)
		expected.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesLong}

		output, err := convertTimeSeriesMultiToTimeSeriesLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)

		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "UnalignedTimestampsWithNamedFields mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("LabelOverwrite", func(t *testing.T) {
		times := []time.Time{
			time.Unix(0, 0),
			time.Unix(15, 0),
		}

		input := data.Frames{
			data.NewFrame("frame1",
				data.NewField("ts", nil, times),
				data.NewField("val", data.Labels{"namespace": "foo"}, []float64{1, 2}),
			),
			data.NewFrame("frame2",
				data.NewField("ts", nil, times),
				data.NewField("val", data.Labels{"namespace": "bar"}, []float64{3, 4}),
			),
		}

		expected := data.NewFrame("time_series_long",
			data.NewField("ts", nil, []time.Time{
				times[0], // 0s - foo
				times[0], // 0s - bar
				times[1], // 15s - foo
				times[1], // 15s - bar
			}),
			data.NewField("val", nil, []float64{
				1, 3, 2, 4,
			}),
			data.NewField("namespace", nil, []string{
				"foo", "bar", "foo", "bar",
			}),
		)
		expected.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesLong}

		output, err := convertTimeSeriesMultiToTimeSeriesLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)

		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "LabelOverwrite mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("UnalignedTimestamps", func(t *testing.T) {
		t1 := []time.Time{
			time.Unix(0, 0),
			time.Unix(30, 0),
		}
		t2 := []time.Time{
			time.Unix(15, 0),
			time.Unix(30, 0),
		}

		input := data.Frames{
			data.NewFrame("frame1",
				data.NewField("ts", nil, t1),
				data.NewField("val", data.Labels{"namespace": "foo"}, []float64{10, 20}),
			),
			data.NewFrame("frame2",
				data.NewField("ts", nil, t2),
				data.NewField("val", data.Labels{"namespace": "bar"}, []float64{30, 40}),
			),
		}

		expected := data.NewFrame("time_series_long",
			data.NewField("ts", nil, []time.Time{
				time.Unix(0, 0),  // foo
				time.Unix(15, 0), // bar
				time.Unix(30, 0), // foo
				time.Unix(30, 0), // bar
			}),
			data.NewField("val", nil, []float64{
				10, 30, 20, 40,
			}),
			data.NewField("namespace", nil, []string{
				"foo", "bar", "foo", "bar",
			}),
		)
		expected.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesLong}

		output, err := convertTimeSeriesMultiToTimeSeriesLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)

		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "UnalignedTimestamps mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("MultipleMetricsAndLabels", func(t *testing.T) {
		times := []time.Time{
			time.Unix(100, 0),
			time.Unix(200, 0),
		}

		input := data.Frames{
			data.NewFrame("metrics",
				data.NewField("t", nil, times),
				data.NewField("cpu", data.Labels{"host": "node-a"}, []float64{0.6, 0.7}),
				data.NewField("mem", data.Labels{"env": "prod"}, []float64{1280, 1310}),
			),
		}

		expected := data.NewFrame("time_series_long",
			data.NewField("t", nil, []time.Time{
				times[0],
				times[0],
				times[1],
				times[1],
			}),
			data.NewField("cpu", nil, []float64{
				0.6, 0, 0.7, 0,
			}),
			data.NewField("mem", nil, []float64{
				0, 1280, 0, 1310,
			}),
			data.NewField("env", nil, []string{
				"", "prod", "", "prod",
			}),
			data.NewField("host", nil, []string{
				"node-a", "", "node-a", "",
			}),
		)
		expected.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesLong}

		output, err := convertTimeSeriesMultiToTimeSeriesLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)

		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "MultipleMetricsAndLabels mismatch (-want +got):\n%s", diff)
		}
	})
}
