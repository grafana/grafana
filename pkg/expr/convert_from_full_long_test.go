package expr

import (
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestConvertFromFullLongToNumericMulti(t *testing.T) {
	t.Run("SingleRowNoLabels", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(3.14)}),
		)
		input.Meta = &data.FrameMeta{Type: numericFullLongType}

		out, err := ConvertFromFullLongToNumericMulti(data.Frames{input})
		require.NoError(t, err)
		require.Len(t, out, 1)

		expected := data.NewFrame("",
			data.NewField("cpu", nil, []*float64{fp(3.14)}),
		)
		expected.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}

		if diff := cmp.Diff(expected, out[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("TwoRowsWithLabelsAndDisplay", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), fp(2.0)}),
			data.NewField(SQLDisplayFieldName, nil, []*string{sp("CPU A"), sp("CPU A")}),
			data.NewField("host", nil, []*string{sp("a"), sp("a")}),
		)
		input.Meta = &data.FrameMeta{Type: numericFullLongType}

		out, err := ConvertFromFullLongToNumericMulti(data.Frames{input})
		require.NoError(t, err)
		require.Len(t, out, 1)

		expected := data.NewFrame("",
			func() *data.Field {
				f := data.NewField("cpu", data.Labels{"host": "a"}, []*float64{fp(1.0), fp(2.0)})
				f.Config = &data.FieldConfig{DisplayNameFromDS: "CPU A"}
				return f
			}(),
		)
		expected.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}

		if diff := cmp.Diff(expected, out[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("SkipsNullValues", func(t *testing.T) {
		input := data.NewFrame("",
			data.NewField(SQLMetricFieldName, nil, []string{"cpu", "cpu"}),
			data.NewField(SQLValueFieldName, nil, []*float64{fp(1.0), nil}),
		)
		input.Meta = &data.FrameMeta{Type: numericFullLongType}

		out, err := ConvertFromFullLongToNumericMulti(data.Frames{input})
		require.NoError(t, err)
		require.Len(t, out, 1)

		expected := data.NewFrame("",
			data.NewField("cpu", nil, []*float64{fp(1.0)}),
		)
		expected.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}

		if diff := cmp.Diff(expected, out[0], data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestConvertNumericMultiRoundTripToFullLongAndBack(t *testing.T) {
	t.Run("TwoFieldsWithSparseLabels", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "a"}, []*float64{fp(1.0)}),
			),
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "b", "env": "prod"}, []*float64{fp(2.0)}),
			),
		}
		for _, f := range input {
			f.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}
		}

		fullLong, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, fullLong, 1)

		roundTrip, err := ConvertFromFullLongToNumericMulti(fullLong)
		require.NoError(t, err)

		expected := data.Frames{
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "a"}, []*float64{fp(1.0)}),
			),
			data.NewFrame("",
				data.NewField("cpu", data.Labels{"host": "b", "env": "prod"}, []*float64{fp(2.0)}),
			),
		}
		for _, f := range expected {
			f.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}
		}

		sortFramesByMetricDisplayAndLabels(expected)
		sortFramesByMetricDisplayAndLabels(roundTrip)

		require.Len(t, roundTrip, len(expected))
		for i := range expected {
			if diff := cmp.Diff(expected[i], roundTrip[i], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Mismatch on frame %d (-want +got):\n%s", i, diff)
			}
		}
	})

	t.Run("PreservesDisplayName", func(t *testing.T) {
		input := data.Frames{
			data.NewFrame("",
				func() *data.Field {
					f := data.NewField("cpu", data.Labels{"host": "a"}, []*float64{fp(1.0)})
					f.Config = &data.FieldConfig{DisplayNameFromDS: "CPU A"}
					return f
				}(),
			),
		}
		input[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}

		fullLong, err := ConvertToFullLong(input)
		require.NoError(t, err)
		require.Len(t, fullLong, 1)

		roundTrip, err := ConvertFromFullLongToNumericMulti(fullLong)
		require.NoError(t, err)

		expected := data.Frames{
			data.NewFrame("",
				func() *data.Field {
					f := data.NewField("cpu", data.Labels{"host": "a"}, []*float64{fp(1.0)})
					f.Config = &data.FieldConfig{DisplayNameFromDS: "CPU A"}
					return f
				}(),
			),
		}
		expected[0].Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}

		sortFramesByMetricDisplayAndLabels(expected)
		sortFramesByMetricDisplayAndLabels(roundTrip)

		require.Len(t, roundTrip, 1)
		if diff := cmp.Diff(expected[0], roundTrip[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Mismatch (-want +got):\n%s", diff)
		}
	})
}

func sortFramesByMetricDisplayAndLabels(frames data.Frames) {
	sort.Slice(frames, func(i, j int) bool {
		fi := frames[i].Fields[0]
		fj := frames[j].Fields[0]

		// 1. Metric name
		if fi.Name != fj.Name {
			return fi.Name < fj.Name
		}

		// 2. Display name (if set)
		var di, dj string
		if fi.Config != nil {
			di = fi.Config.DisplayNameFromDS
		}
		if fj.Config != nil {
			dj = fj.Config.DisplayNameFromDS
		}
		if di != dj {
			return di < dj
		}

		// 3. Labels fingerprint
		return fi.Labels.Fingerprint() < fj.Labels.Fingerprint()
	})
}
