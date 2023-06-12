package dataframe

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestDataFrameSummary(t *testing.T) {
	df := data.NewFrame("http_requests_total",
		data.NewField("timestamp", nil, []time.Time{time.Now(), time.Now(), time.Now()}).SetConfig(&data.FieldConfig{
			DisplayName: "A time Column.",
		}),
		data.NewField("value", data.Labels{"service": "auth"}, []float64{1.0, 2.0, 3.0}),
		data.NewField("category", data.Labels{"service": "auth"}, []string{"foo", "bar", "test"}),
		data.NewField("valid", data.Labels{"service": "auth"}, []bool{true, false, true}),
	)

	in, err := data.FrameToJSON(df, data.IncludeAll)
	require.NoError(t, err)

	summary, out, err := GetEntitySummaryBuilder()(context.Background(), "somthing", in)
	require.NoError(t, err)
	require.Equal(t, in, out) // same json

	asjson, err := json.MarshalIndent(summary, "", "  ")
	// fmt.Printf(string(asjson))
	require.NoError(t, err)
	require.JSONEq(t, `{
		"uid": "somthing",
		"kind": "frame",
		"name": "http_requests_total",
		"fields": {
		  "cols": 4,
		  "rows": 3
		}
	  }`, string(asjson))
}
