package loki

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestFlattenLogsToTabular_LegacyLayout(t *testing.T) {
	labels := json.RawMessage(`{"app":"shop","env":"prod"}`)
	t1 := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)
	f := &data.Frame{
		Fields: data.Fields{
			data.NewField("labels", nil, []json.RawMessage{labels}),
			data.NewField("ts", nil, []time.Time{t1}),
			data.NewField("line", nil, []string{"log line 1"}),
			data.NewField("tsNs", nil, []string{"123"}),
		},
		Meta: &data.FrameMeta{ExecutedQueryString: "Expr: {x=\"y\"}"},
	}

	app := "shop"
	env := "prod"
	want := data.NewFrame("",
		data.NewField("timestamp", nil, []time.Time{t1}),
		data.NewField("line", nil, []string{"log line 1"}),
		data.NewField("app", nil, []*string{&app}),
		data.NewField("env", nil, []*string{&env}),
	)
	want.Meta = &data.FrameMeta{ExecutedQueryString: "Expr: {x=\"y\"}"}

	out := flattenLogsToTabular(data.Frames{f}, false, log.NewNullLogger())
	require.Len(t, out, 1)
	require.Equal(t, want, out[0])
}

func TestFlattenLogsToTabular_DataplaneLayout(t *testing.T) {
	labels := json.RawMessage(`{"app":"shop","env":"prod","zz":"tail"}`)
	t1 := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)
	f := &data.Frame{
		Fields: data.Fields{
			data.NewField("labels", nil, []json.RawMessage{labels}),
			data.NewField("timestamp", nil, []time.Time{t1}),
			data.NewField("body", nil, []string{"hello"}),
			data.NewField("tsNs", nil, []string{"123"}),
		},
		Meta: &data.FrameMeta{ExecutedQueryString: "Expr: {service=\"carts\"}"},
	}

	app := "shop"
	env := "prod"
	zz := "tail"
	want := data.NewFrame("",
		data.NewField("timestamp", nil, []time.Time{t1}),
		data.NewField("line", nil, []string{"hello"}),
		data.NewField("app", nil, []*string{&app}),
		data.NewField("env", nil, []*string{&env}),
		data.NewField("zz", nil, []*string{&zz}),
	)
	want.Meta = &data.FrameMeta{ExecutedQueryString: "Expr: {service=\"carts\"}"}

	out := flattenLogsToTabular(data.Frames{f}, true, log.NewNullLogger())
	require.Len(t, out, 1)
	require.Equal(t, want, out[0])
}

func TestLabelJSONValueToString(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		in   interface{}
		want string
	}{
		{name: "nil", in: nil, want: ""},
		{name: "string", in: "hello", want: "hello"},
		{name: "bool true", in: true, want: "true"},
		{name: "bool false", in: false, want: "false"},
		{name: "float64 int", in: float64(42), want: "42"},
		{name: "float64 frac", in: 1.25, want: "1.25"},
		{name: "object", in: map[string]interface{}{"a": float64(1)}, want: `{"a":1}`},
		{name: "array", in: []interface{}{float64(1), "x"}, want: `[1,"x"]`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := labelJSONValueToString(tc.in)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}

	t.Run("json.Number", func(t *testing.T) {
		t.Parallel()
		got, err := labelJSONValueToString(json.Number("9007199254740993"))
		require.NoError(t, err)
		require.Equal(t, "9007199254740993", got)
	})
}

func TestFlattenLogsToTabular_LabelJSONScalars(t *testing.T) {
	labels := json.RawMessage(`{"arr":[1,"x"],"nested":{"a":1},"nul":null,"num":42,"plain":"z","tf":true}`)
	t1 := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)
	f := &data.Frame{
		Fields: data.Fields{
			data.NewField("labels", nil, []json.RawMessage{labels}),
			data.NewField("ts", nil, []time.Time{t1}),
			data.NewField("line", nil, []string{"one"}),
			data.NewField("tsNs", nil, []string{"123"}),
		},
	}

	arr := `[1,"x"]`
	nested := `{"a":1}`
	empty := ""
	fortytwo := "42"
	plain := "z"
	tf := "true"

	want := data.NewFrame("",
		data.NewField("timestamp", nil, []time.Time{t1}),
		data.NewField("line", nil, []string{"one"}),
		data.NewField("arr", nil, []*string{&arr}),
		data.NewField("nested", nil, []*string{&nested}),
		data.NewField("nul", nil, []*string{&empty}),
		data.NewField("num", nil, []*string{&fortytwo}),
		data.NewField("plain", nil, []*string{&plain}),
		data.NewField("tf", nil, []*string{&tf}),
	)

	out := flattenLogsToTabular(data.Frames{f}, false, log.NewNullLogger())
	require.Len(t, out, 1)
	require.Equal(t, want, out[0])
}
