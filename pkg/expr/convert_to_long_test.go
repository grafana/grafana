package expr

import (
	"testing"

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
