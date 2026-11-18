package chunked

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestAccumulator(t *testing.T) {
	rsp, err := AccumulateJSONLines(strings.NewReader(`
	 {"refId":"A","frameId":"f0","frame":{"schema":{"refId":"A","fields":[{"name":"f1","type":"number","typeInfo":{"frame":"int64","nullable":true}},{"name":"f2","type":"string","typeInfo":{"frame":"string","nullable":true}},{"name":"f3","type":"boolean","typeInfo":{"frame":"bool","nullable":true}}]},"data":{"values":[[1],["two"],[false]]}}}
	`))
	require.NoError(t, err)

	out, err := json.MarshalIndent(rsp, "", "  ")
	// fmt.Printf("%s\n", out)
	require.NoError(t, err)
	require.JSONEq(t, `{
		"results": {
			"A": {
				"status": 200,
				"frames": [
					{
						"schema": {
							"refId": "A",
							"fields": [
								{
									"name": "f1",
									"type": "number",
									"typeInfo": {
										"frame": "int64",
										"nullable": true
									}
								},
								{
									"name": "f2",
									"type": "string",
									"typeInfo": {
										"frame": "string",
										"nullable": true
									}
								},
								{
									"name": "f3",
									"type": "boolean",
									"typeInfo": {
										"frame": "bool",
										"nullable": true
									}
								}
							]
						},
						"data": {
							"values": [
								[ 1 ], [ "two" ], [ false ]
							]
						}
					}
				]
			}
		}
	}`, string(out))
}

func TestAccumulatorFrameIDs(t *testing.T) {
	// The JSON writer of the SDK sends the schema only in the first chunk of a frame.
	rsp, err := AccumulateJSONLines(strings.NewReader(`
	 {"refId":"A","frameId":"1","frame":{"schema":{"name":"series1","refId":"A","fields":[{"name":"value","type":"number","typeInfo":{"frame":"int64"}}]},"data":{"values":[[1,2]]}}}
	 {"refId":"A","frameId":"2","frame":{"schema":{"name":"series2","refId":"A","fields":[{"name":"value","type":"number","typeInfo":{"frame":"int64"}}]},"data":{"values":[[10]]}}}
	 {"refId":"A","frameId":"1","frame":{"data":{"values":[[3]]}}}
	 {"refId":"B","frameId":"1","frame":{"schema":{"name":"table","refId":"B","fields":[{"name":"value","type":"number","typeInfo":{"frame":"int64"}}]},"data":{"values":[[4]]}}}
	`))
	require.NoError(t, err)

	frame := func(refID, name string, values ...int64) *data.Frame {
		f := data.NewFrame(name, data.NewField("value", nil, values))
		f.RefID = refID
		return f
	}
	want := map[string]data.Frames{
		"A": {frame("A", "series1", 1, 2, 3), frame("A", "series2", 10)},
		"B": {frame("B", "table", 4)},
	}
	require.Len(t, rsp.Responses, len(want))
	for refID, frames := range want {
		if diff := cmp.Diff(frames, rsp.Responses[refID].Frames, data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("frames of refID %s mismatch (-want +got):\n%s", refID, diff)
		}
	}
}

func TestAccumulatorErrorStatus(t *testing.T) {
	rsp, err := AccumulateJSONLines(strings.NewReader(`
	 {"refId":"A","status":401,"error":"unauthorized","errorSource":"downstream"}
	`))
	require.NoError(t, err)
	require.Equal(t, backend.StatusUnauthorized, rsp.Responses["A"].Status)
	require.EqualError(t, rsp.Responses["A"].Error, "unauthorized")
	require.Equal(t, backend.ErrorSourceDownstream, rsp.Responses["A"].ErrorSource)

	_, err = AccumulateJSONLines(strings.NewReader(`{"refId":"A","status":"bad"}`))
	require.ErrorContains(t, err, "expected number")
}
