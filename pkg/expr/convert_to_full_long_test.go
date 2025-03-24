package expr

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestConvertNumericWideToFullLong(t *testing.T) {
	t.Run("SingleItemNoLabels", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("numeric",
				data.NewField("cpu", nil, []float64{3.14}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}

		expected := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(3.14)}),
		)
		expected.Meta = &data.FrameMeta{Type: numericFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoItemsWithSingleLabel", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("numeric",
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0}),
				data.NewField("cpu", data.Labels{"host": "b"}, []float64{2.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}

		expected := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField("host", nil, []*string{sp("a"), sp("b")}),
		)
		expected.Meta = &data.FrameMeta{Type: numericFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoItemsWithSparseLabels", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("numeric",
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0}),
				data.NewField("cpu", data.Labels{"host": "b", "env": "prod"}, []float64{2.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}

		expected := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField("env", nil, []*string{nil, sp("prod")}),
			data.NewField("host", nil, []*string{sp("a"), sp("b")}),
		)
		expected.Meta = &data.FrameMeta{Type: numericFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoDifferentMetricsWithSharedLabels", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("numeric",
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0}),
				data.NewField("mem", data.Labels{"host": "a"}, []float64{4.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}

		expected := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "mem"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(4.0)}),
			data.NewField("host", nil, []*string{sp("a"), sp("a")}),
		)
		expected.Meta = &data.FrameMeta{Type: numericFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})

	t.Run("TwoSparseMetricsAndLabels", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("numeric",
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0}),
				data.NewField("mem", data.Labels{"env": "prod"}, []float64{4.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}

		expected := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "mem"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(4.0)}),
			data.NewField("env", nil, []*string{nil, sp("prod")}),
			data.NewField("host", nil, []*string{sp("a"), nil}),
		)
		expected.Meta = &data.FrameMeta{Type: numericFullLongType}

		output, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, output, 1)
		if diff := cmp.Diff(expected, output[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
		}
	})
}

func sp(s string) *string {
	return &s
}
