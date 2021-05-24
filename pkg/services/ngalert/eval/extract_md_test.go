package eval

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"
)

func TestExtractEvalString(t *testing.T) {
	cases := []struct {
		desc      string
		inFrame   *data.Frame
		outString string
	}{
		{
			desc: "1 EvalMatch",
			inFrame: newMetaFrame([]classic.EvalMatch{
				{Metric: "Test", Labels: data.Labels{"host": "foo"}, Value: ptr.Float64(32.3)},
			}, ptr.Float64(1)),
			outString: `[ metric='Test' labels={host=foo} value=32.3 ]`,
		},
		{
			desc: "2 EvalMatches",
			inFrame: newMetaFrame([]classic.EvalMatch{
				{Metric: "Test", Labels: data.Labels{"host": "foo"}, Value: ptr.Float64(32.3)},
				{Metric: "Test", Labels: data.Labels{"host": "baz"}, Value: ptr.Float64(10)},
			}, ptr.Float64(1)),
			outString: `[ metric='Test' labels={host=foo} value=32.3 ], [ metric='Test' labels={host=baz} value=10 ]`,
		},
		{
			desc: "3 EvalMatches",
			inFrame: newMetaFrame([]classic.EvalMatch{
				{Metric: "Test", Labels: data.Labels{"host": "foo"}, Value: ptr.Float64(32.3)},
				{Metric: "Test", Labels: data.Labels{"host": "baz"}, Value: ptr.Float64(10)},
				{Metric: "TestA", Labels: data.Labels{"host": "zip"}, Value: ptr.Float64(11)},
			}, ptr.Float64(1)),
			outString: `[ metric='Test' labels={host=foo} value=32.3 ], [ metric='Test' labels={host=baz} value=10 ], [ metric='TestA' labels={host=zip} value=11 ]`,
		},
	}
	for _, tc := range cases {
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.outString, extractEvalString(tc.inFrame))
		})
	}
}

func newMetaFrame(custom interface{}, val *float64) *data.Frame {
	return data.NewFrame("",
		data.NewField("", nil, []*float64{val})).
		SetMeta(&data.FrameMeta{
			Custom: custom,
		})
}
