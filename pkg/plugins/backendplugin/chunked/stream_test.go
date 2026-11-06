package chunked

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/stretchr/testify/require"
)

func TestChunkedRoundTrip(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer := NewChunkedHTTPWriter(recorder)
	for _, tc := range []struct {
		ref, id string
		value   int64
	}{
		{"A", "0", 1}, {"A", "1", 2}, {"A", "0", 3}, {"B", "0", 4}, {"A", "", 5}, {"A", "", 6},
	} {
		include := data.IncludeAll
		if tc.ref == "A" && tc.id == "0" && tc.value == 3 {
			include = data.IncludeDataOnly
		}
		frame, err := data.FrameToJSON(data.NewFrame("result", data.NewField("value", nil, []int64{tc.value})), include)
		require.NoError(t, err)
		require.NoError(t, writer.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: tc.ref, FrameId: tc.id, Frame: frame, Format: pluginv2.DataFrameFormat_JSON}))
	}
	require.NoError(t, writer.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "B", Status: 403, Error: "denied", ErrorSource: "downstream"}))
	require.NoError(t, writer.Complete())
	require.True(t, recorder.Flushed)
	response, err := AccumulateJSONLines(recorder.Body)
	require.NoError(t, err)
	require.Len(t, response.Responses["A"].Frames, 4)
	for i, value := range []int64{1, 2, 5, 6} {
		frame := response.Responses["A"].Frames[i]
		require.Equal(t, "A", frame.RefID)
		require.EqualValues(t, value, frame.Fields[0].At(0))
	}
	require.EqualValues(t, 3, response.Responses["A"].Frames[0].Fields[0].At(1))
	require.Equal(t, 2, response.Responses["A"].Frames[0].Fields[0].Len())
	require.Equal(t, backend.StatusOK, response.Responses["A"].Status)
	require.Equal(t, backend.StatusForbidden, response.Responses["B"].Status)
	require.EqualError(t, response.Responses["B"].Error, "denied")
	require.Equal(t, backend.ErrorSourceDownstream, response.Responses["B"].ErrorSource)
}

func TestChunkedCompletion(t *testing.T) {
	for _, tc := range []struct{ name, body, message string }{
		{"empty EOF", "", "without a completion record"},
		{"clean EOF after event", `{"refId":"A"}` + "\n", "without a completion record"},
		{"partial event", `{"refId":`, "unexpected EOF"},
		{"malformed event", "broken", "invalid character"},
		{"missing refId", `{}`, "missing refId"},
		{"null event", `null`, "null"},
		{"unknown type", `{"type":"unknown"}`, "unsupported"},
		{"failed stream", `{"type":"error","error":"connection lost"}`, "connection lost"},
		{"error without message", `{"type":"error"}`, "missing its message"},
		{"invalid completion", `{"type":"complete","refId":"A"}`, "invalid"},
		{"event after completion", `{"type":"complete"}` + "\n" + `{"refId":"A"}`, "after completion"},
		{"duplicate completion", `{"type":"complete"}` + "\n" + `{"type":"complete"}`, "after completion"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response, err := AccumulateJSONLines(strings.NewReader(tc.body))
			require.ErrorContains(t, err, tc.message)
			require.Nil(t, response)
		})
	}
	response, err := AccumulateJSONLines(strings.NewReader(`{"type":"complete"}` + "\n"))
	require.NoError(t, err)
	require.Empty(t, response.Responses)
}

type receiverFunc func(*pluginv2.QueryChunkedDataResponse) error

func (f receiverFunc) OnChunk(c *pluginv2.QueryChunkedDataResponse) error { return f(c) }

func TestChunkedReceiverStopsReading(t *testing.T) {
	stop := errors.New("consumer stopped")
	require.ErrorIs(t, ReadJSONLines(strings.NewReader(`{"refId":"A"}`+"\n"), receiverFunc(func(*pluginv2.QueryChunkedDataResponse) error { return stop })), stop)
}

type failingWriter struct{ header http.Header }

func (w failingWriter) Header() http.Header       { return w.header }
func (w failingWriter) WriteHeader(int)           {}
func (w failingWriter) Write([]byte) (int, error) { return 0, io.ErrClosedPipe }

func TestChunkedWriterFailure(t *testing.T) {
	writer := NewChunkedHTTPWriter(failingWriter{header: http.Header{}})
	require.ErrorIs(t, writer.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A"}), io.ErrClosedPipe)
	require.ErrorIs(t, writer.Complete(), io.ErrClosedPipe)
}

func TestChunkedStreamError(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer := NewChunkedHTTPWriter(recorder)
	require.NoError(t, writer.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A"}))
	require.NoError(t, writer.WriteStreamError(errors.New("plugin failed")))
	require.Error(t, writer.Complete())
	response, err := AccumulateJSONLines(recorder.Body)
	require.ErrorContains(t, err, "plugin failed")
	require.Nil(t, response)
	require.NotContains(t, recorder.Body.String(), `"type":"complete"`)
}

func TestChunkedSchemaRequiredBeforeData(t *testing.T) {
	response, err := AccumulateJSONLines(strings.NewReader(`{"refId":"A","frameId":"0","frame":{"data":{"values":[[1]]}}}` + "\n" + `{"type":"complete"}` + "\n"))
	require.ErrorContains(t, err, "requires schema and data")
	require.Nil(t, response)
}
