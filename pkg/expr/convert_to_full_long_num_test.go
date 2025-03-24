package expr

import (
	"testing"
	"time"

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

	t.Run("MultiRowShouldError", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("numeric",
				data.NewField("cpu", nil, []float64{1.0, 2.0}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}

		_, err := ConvertToFullLong(input)
		require.Error(t, err)
		require.Contains(t, err.Error(), "no more than one row")
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

	t.Run("ExtraTimeFieldIsDropped", func(t *testing.T) {
		// Note we may consider changing this behavior and looking into keeping
		// remainder fields in the future.
		input := data.Frames{
			data.NewFrame("numeric",
				data.NewField("timestamp", nil, []time.Time{time.Now()}), // extra time field
				data.NewField("cpu", nil, []float64{1.23}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}

		expected := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.23)}),
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

func TestConvertNumericMultiToFullLong(t *testing.T) {
	t.Run("SingleItemNoLabels", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("",
				data.NewField("cpu", nil, []float64{3.14}),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}

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
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0}),
			),
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "b"}, []float64{2.0}),
			),
		}
		for _, f := range input {
			f.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}
		}

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
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0}),
			),
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "b", "env": "prod"}, []float64{2.0}),
			),
		}
		for _, f := range input {
			f.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}
		}

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
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0}),
			),
			data.NewFrame("",
				data.NewField("mem", data.Labels{"host": "a"}, []float64{4.0}),
			),
		}
		for _, f := range input {
			f.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}
		}

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
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1.0}),
			),
			data.NewFrame("",
				data.NewField("mem", data.Labels{"env": "prod"}, []float64{4.0}),
			),
		}
		for _, f := range input {
			f.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}
		}

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
