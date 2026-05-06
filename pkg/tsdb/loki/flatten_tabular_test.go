package loki

import (
	"encoding/json"
	"testing"
	"time"

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

	out := flattenLogsToTabular(data.Frames{f}, false)
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

	out := flattenLogsToTabular(data.Frames{f}, true)
	require.Len(t, out, 1)
	require.Equal(t, want, out[0])
}
