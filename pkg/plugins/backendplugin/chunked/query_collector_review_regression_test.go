package chunked

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/stretchr/testify/require"
)

func TestCollectorPreservesSilentQueries(t *testing.T) {
	collector := NewQueryResponseCollector("A", "B")
	require.NoError(t, collector.WriteFrame(context.Background(), "A", "0", data.NewFrame("result", data.NewField("value", nil, []int64{1}))))
	for _, id := range []string{"A", "B"} {
		response, exists := collector.Response().Responses[id]
		require.True(t, exists)
		require.Equal(t, backend.StatusOK, response.Status)
	}
	require.Empty(t, collector.Response().Responses["B"].Frames)
}

func TestCollectorRejectsMalformedContinuationsWithoutMutation(t *testing.T) {
	frame := data.NewFrame("result", data.NewField("number", nil, []int64{1}), data.NewField("text", nil, []string{"one"}))
	first, err := frame.MarshalJSON()
	require.NoError(t, err)
	for _, tc := range []struct{ name, frame string }{
		{"too many columns", `{"data":{"values":[[2],["two"],[3]]}}`},
		{"too few columns", `{"data":{"values":[[2]]}}`},
		{"different row counts", `{"data":{"values":[[2,3],["two"]]}}`},
		{"too many nanos columns", `{"data":{"values":[[2],["two"]],"nanos":[null,null,null]}}`},
		{"entity out of range", `{"data":{"values":[[2],["two"]],"entities":[{"NaN":[2]},null]}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			collector := NewQueryResponseCollector("A")
			require.NoError(t, collector.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A", FrameId: "0", Frame: first, Format: pluginv2.DataFrameFormat_JSON}))
			before, err := json.Marshal(collector.Response())
			require.NoError(t, err)
			require.NotPanics(t, func() {
				require.Error(t, collector.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A", FrameId: "0", Frame: []byte(tc.frame), Format: pluginv2.DataFrameFormat_JSON}))
			})
			after, err := json.Marshal(collector.Response())
			require.NoError(t, err)
			require.JSONEq(t, string(before), string(after))
		})
	}
}

func TestCollectorRejectsMalformedInitialFrame(t *testing.T) {
	frame := `{"schema":{"fields":[{"name":"value","type":"number"}]},"data":{"values":[[1],[2]]}}`
	collector := NewQueryResponseCollector("A")
	require.NotPanics(t, func() {
		require.Error(t, collector.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A", FrameId: "0", Frame: []byte(frame), Format: pluginv2.DataFrameFormat_JSON}))
	})
	require.Empty(t, collector.Response().Responses["A"].Frames)
}

type typedErrorRecorder struct {
	backend.ChunkedDataWriter
	source backend.ErrorSource
}

func (r *typedErrorRecorder) WriteError(_ context.Context, _ string, _ backend.Status, err error) error {
	r.source = backend.ErrorResponseWithErrorSource(err).ErrorSource
	return nil
}

func TestProcessTypedResponsePreservesSource(t *testing.T) {
	for _, tc := range []struct {
		name   string
		err    error
		source backend.ErrorSource
	}{
		{"explicit source", errors.New("bad query"), backend.ErrorSourceDownstream},
		{"wrapped source", backend.DownstreamError(errors.New("bad query")), ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := &typedErrorRecorder{}
			require.NoError(t, ProcessTypedResponse(context.Background(), &backend.QueryDataResponse{Responses: backend.Responses{"A": {Error: tc.err, Status: backend.StatusInternal, ErrorSource: tc.source}}}, recorder))
			require.Equal(t, backend.ErrorSourceDownstream, recorder.source)
		})
	}
}

// Identical schemas do not imply identical logical frames. Only the (refId,
// frameId) pair determines where a continuation belongs, even if interleaved.
func TestCollectorKeepsLogicalFrameIdentity(t *testing.T) {
	collector := NewQueryResponseCollector("A", "B")
	for _, chunk := range []struct {
		refID, frameID string
		value          int64
	}{
		{"A", "first", 1}, {"A", "second", 10}, {"B", "first", 100},
		{"A", "first", 2}, {"A", "second", 20}, {"B", "first", 200},
	} {
		require.NoError(t, collector.WriteFrame(context.Background(), chunk.refID, chunk.frameID,
			data.NewFrame("result", data.NewField("value", nil, []int64{chunk.value}))))
	}
	response := collector.Response()
	require.Equal(t, data.Frames{
		{Name: "result", RefID: "A", Fields: []*data.Field{data.NewField("value", nil, []int64{1, 2})}},
		{Name: "result", RefID: "A", Fields: []*data.Field{data.NewField("value", nil, []int64{10, 20})}},
	}, response.Responses["A"].Frames)
	require.Equal(t, data.Frames{
		{Name: "result", RefID: "B", Fields: []*data.Field{data.NewField("value", nil, []int64{100, 200})}},
	}, response.Responses["B"].Frames)
}
