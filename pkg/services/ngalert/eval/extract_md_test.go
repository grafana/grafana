package eval

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/classic"
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
				{Metric: "Test", Labels: data.Labels{"host": "foo"}, Value: new(32.3)},
			}, new(1.0)),
			outString: `[ var='0' metric='Test' labels={host=foo} type='classic_conditions' value=32.3 ]`,
		},
		{
			desc: "2 EvalMatches",
			inFrame: newMetaFrame([]classic.EvalMatch{
				{Metric: "Test", Labels: data.Labels{"host": "foo"}, Value: new(32.3)},
				{Metric: "Test", Labels: data.Labels{"host": "baz"}, Value: new(10.0)},
			}, new(1.0), withRefID("A")),
			outString: `[ var='A0' metric='Test' labels={host=foo} type='classic_conditions' value=32.3 ], [ var='A1' metric='Test' labels={host=baz} type='classic_conditions' value=10 ]`,
		},
		{
			desc: "3 EvalMatches",
			inFrame: newMetaFrame([]classic.EvalMatch{
				{Metric: "Test", Labels: data.Labels{"host": "foo"}, Value: new(32.3)},
				{Metric: "Test", Labels: data.Labels{"host": "baz"}, Value: new(10.0)},
				{Metric: "TestA", Labels: data.Labels{"host": "zip"}, Value: new(11.0)},
			}, new(1.0), withRefID("A")),
			outString: `[ var='A0' metric='Test' labels={host=foo} type='classic_conditions' value=32.3 ], [ var='A1' metric='Test' labels={host=baz} type='classic_conditions' value=10 ], [ var='A2' metric='TestA' labels={host=zip} type='classic_conditions' value=11 ]`,
		},
		{
			desc: "Captures are sorted in ascending order of var",
			inFrame: newMetaFrame([]NumberValueCapture{
				{Var: "B", Labels: data.Labels{"host": "foo"}, Value: new(1.0), Type: "reduce"},
				{Var: "A", Labels: data.Labels{"host": "foo"}, Value: new(10.0), Type: "threshold"},
			}, new(1.0)),
			outString: `[ var='A' labels={host=foo} type='threshold' value=10 ], [ var='B' labels={host=foo} type='reduce' value=1 ]`,
		},
	}
	for _, tc := range cases {
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.outString, extractEvalString(tc.inFrame))
		})
	}
}

// TestExtractEvalStringKeepsOrderWithinVar checks that rendering keeps the order the
// captures arrived in. attachCaptureValues sorts the captures of one RefID with
// compareCaptures, and the sort by Var in extractEvalString must not undo that.
//
// Every case carries thirteen captures because sort.Slice and sort.SliceStable only
// differ above twelve elements. Below that both run an insertion sort, which is stable.
//
// This is a separate test rather than another case of TestExtractEvalString because the
// expected value here is an order, and spelling thirteen captures out as one rendered
// string would hide which one moved.
func TestExtractEvalStringKeepsOrderWithinVar(t *testing.T) {
	testCases := []struct {
		name string
		// vars gives the Var of each capture. The value of a capture is its position
		// here, so want can name the captures by the order they went in.
		vars []string
		want []float64
	}{
		{
			name: "already grouped by Var",
			vars: []string{"A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "B"},
			want: []float64{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12},
		},
		{
			name: "interleaved Vars",
			vars: []string{"B", "A", "A", "A", "A", "B", "A", "A", "A", "A", "B", "A", "A"},
			want: []float64{1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 0, 5, 10},
		},
		{
			name: "Vars in reverse order",
			vars: []string{"B", "B", "B", "B", "B", "B", "A", "A", "A", "A", "A", "A", "A"},
			want: []float64{6, 7, 8, 9, 10, 11, 12, 0, 1, 2, 3, 4, 5},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			captures := make([]NumberValueCapture, 0, len(tc.vars))
			for i, v := range tc.vars {
				captures = append(captures, NumberValueCapture{
					Var:    v,
					Labels: data.Labels{"host": strconv.Itoa(i)},
					Type:   "reduce",
					Value:  new(float64(i)),
				})
			}

			frame := newMetaFrame(captures, new(1.0))
			extractEvalString(frame)

			// extractEvalString sorts Meta.Custom in place, so the slice now holds the
			// order the captures were rendered in.
			var order []float64
			for _, c := range frame.Meta.Custom.([]NumberValueCapture) {
				order = append(order, *c.Value)
			}
			require.Equal(t, tc.want, order)
		})
	}
}

func TestExtractValues(t *testing.T) {
	cases := []struct {
		desc    string
		inFrame *data.Frame
		values  map[string]NumberValueCapture
	}{{
		desc:    "No values in frame returns nil",
		inFrame: newMetaFrame(nil, new(1.0)),
		values:  nil,
	}, {
		desc: "Classic condition frame with one match",
		inFrame: newMetaFrame([]classic.EvalMatch{
			{Metric: "A", Labels: data.Labels{"host": "foo"}, Value: new(1.0)},
		}, new(1.0), withRefID("A")),
		values: map[string]NumberValueCapture{
			"A0": {Var: "A", Labels: data.Labels{"host": "foo"}, Value: new(1.0), Type: "classic_conditions"},
		},
	}, {
		desc: "Classic condition frame with multiple matches",
		inFrame: newMetaFrame([]classic.EvalMatch{
			{Metric: "A", Labels: data.Labels{"host": "foo"}, Value: new(1.0)},
			{Metric: "A", Labels: data.Labels{"host": "foo"}, Value: new(3.0)},
		}, new(1.0), withRefID("A")),
		values: map[string]NumberValueCapture{
			"A0": {Var: "A", Labels: data.Labels{"host": "foo"}, Value: new(1.0), Type: "classic_conditions"},
			"A1": {Var: "A", Labels: data.Labels{"host": "foo"}, Value: new(3.0), Type: "classic_conditions"},
		},
	}, {
		desc: "Nil value",
		inFrame: newMetaFrame([]NumberValueCapture{
			{Var: "A", Labels: data.Labels{"host": "foo"}, Value: nil},
		}, new(1.0)),
		values: map[string]NumberValueCapture{
			"A": {Var: "A", Labels: data.Labels{"host": "foo"}, Value: nil},
		},
	}, {
		desc: "1 value",
		inFrame: newMetaFrame([]NumberValueCapture{
			{Var: "A", Labels: data.Labels{"host": "foo"}, Value: new(1.0)},
		}, new(1.0)),
		values: map[string]NumberValueCapture{
			"A": {Var: "A", Labels: data.Labels{"host": "foo"}, Value: new(1.0)},
		},
	}, {
		desc: "2 values",
		inFrame: newMetaFrame([]NumberValueCapture{
			{Var: "A", Labels: data.Labels{"host": "foo"}, Value: new(1.0)},
			{Var: "B", Labels: nil, Value: new(2.0)},
		}, new(1.0)),
		values: map[string]NumberValueCapture{
			"A": {Var: "A", Labels: data.Labels{"host": "foo"}, Value: new(1.0)},
			"B": {Var: "B", Value: new(2.0)},
		},
	}}
	for _, tc := range cases {
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.values, extractValues(tc.inFrame))
		})
	}
}

type frameCallback func(frame *data.Frame)

func withRefID(refID string) frameCallback {
	return func(frame *data.Frame) {
		frame.RefID = refID
	}
}

func newMetaFrame(custom any, val *float64, callbacks ...frameCallback) *data.Frame {
	f := data.NewFrame("",
		data.NewField("", nil, []*float64{val})).
		SetMeta(&data.FrameMeta{
			Custom: custom,
		})

	for _, cb := range callbacks {
		cb(f)
	}

	return f
}
