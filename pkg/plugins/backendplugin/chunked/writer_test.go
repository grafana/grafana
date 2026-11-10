package chunked

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

func TestIsRequestingChunkedResponse(t *testing.T) {
	tests := []struct {
		name     string
		accept   string
		expected bool
	}{
		{"exact match", "text/jsonl", true},
		{"with parameters", "text/jsonl; charset=utf-8", true},
		{"multiple types", "application/json, text/jsonl", true},
		{"multiple with params", "application/json, text/jsonl; q=0.9", true},
		{"not matching", "application/json", false},
		{"empty", "", false},
		{"partial match", "text/json", false},
		{"case sensitive", "TEXT/JSONL", false}, // slices.Contains is case-sensitive
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsRequestingChunkedResponse(tt.accept)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNewChunkedHTTPWriter(t *testing.T) {
	w := httptest.NewRecorder()
	writer := NewChunkedHTTPWriter(w)
	assert.NotNil(t, writer)
	assert.Equal(t, CONTENT_TYPE, w.Header().Get("Content-Type"))
}

func TestRawChunkWriter_OnChunk(t *testing.T) {
	w := httptest.NewRecorder()
	writer := NewChunkedHTTPWriter(w)

	t.Run("basic chunk", func(t *testing.T) {
		chunk := &pluginv2.QueryChunkedDataResponse{
			RefId: "test-ref",
		}
		err := writer.OnChunk(chunk)
		require.NoError(t, err)
		body := w.Body.String()
		assert.Contains(t, body, `{"refId":"test-ref"}`+"\n")
	})

	t.Run("chunk with frameId", func(t *testing.T) {
		w := httptest.NewRecorder()
		writer := NewChunkedHTTPWriter(w)
		chunk := &pluginv2.QueryChunkedDataResponse{
			RefId:   "test-ref",
			FrameId: "frame-1",
		}
		err := writer.OnChunk(chunk)
		require.NoError(t, err)
		body := w.Body.String()
		assert.Contains(t, body, `{"refId":"test-ref","frameId":"frame-1"}`+"\n")
	})

	t.Run("chunk with frame", func(t *testing.T) {
		w := httptest.NewRecorder()
		writer := NewChunkedHTTPWriter(w)
		frame := data.NewFrame("test", data.NewField("value", nil, []int64{1}))
		frameJSON, _ := frame.MarshalJSON()
		chunk := &pluginv2.QueryChunkedDataResponse{
			RefId:  "test-ref",
			Frame:  frameJSON,
			Format: pluginv2.DataFrameFormat_JSON,
		}
		err := writer.OnChunk(chunk)
		require.NoError(t, err)
		body := w.Body.String()
		assert.Contains(t, body, `{"refId":"test-ref","frame":`)
		assert.True(t, strings.HasSuffix(body, "}\n"))
	})

	t.Run("chunk with error", func(t *testing.T) {
		w := httptest.NewRecorder()
		writer := NewChunkedHTTPWriter(w)
		chunk := &pluginv2.QueryChunkedDataResponse{
			RefId:       "test-ref",
			Error:       "test error",
			ErrorSource: "source",
		}
		err := writer.OnChunk(chunk)
		require.NoError(t, err)
		body := w.Body.String()
		assert.Contains(t, body, `{"refId":"test-ref","error":"test error","errorSource":"source"}`+"\n")
	})

	t.Run("chunk with arrow frame", func(t *testing.T) {
		w := httptest.NewRecorder()
		writer := NewChunkedHTTPWriter(w)
		frame := data.NewFrame("test", data.NewField("value", nil, []int64{1}))
		arrowBytes, _ := frame.MarshalArrow()
		chunk := &pluginv2.QueryChunkedDataResponse{
			RefId:  "test-ref",
			Frame:  arrowBytes,
			Format: pluginv2.DataFrameFormat_ARROW,
		}
		err := writer.OnChunk(chunk)
		require.NoError(t, err)
		body := w.Body.String()
		assert.Contains(t, body, `{"refId":"test-ref","frame":`)
	})
}

func TestRawChunkWriter_WriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writer := NewChunkedHTTPWriter(w)
	err := writer.WriteError(context.Background(), "ref", backend.StatusOK, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rawChunkWriter does not support: WriteError")
}

func TestRawChunkWriter_WriteFrame(t *testing.T) {
	w := httptest.NewRecorder()
	writer := NewChunkedHTTPWriter(w)
	frame := data.NewFrame("test")
	err := writer.WriteFrame(context.Background(), "ref", "frame-id", frame)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rawChunkWriter does not support: WriteFrame")
}

func TestRawChunkWriter_ArrowChunksOfOneFrame(t *testing.T) {
	arrowChunk := func(t *testing.T, refID, frameID, name string, values ...int64) *pluginv2.QueryChunkedDataResponse {
		t.Helper()
		frame := data.NewFrame(name, data.NewField("value", nil, values))
		frame.RefID = refID
		b, err := frame.MarshalArrow()
		require.NoError(t, err)
		return &pluginv2.QueryChunkedDataResponse{
			RefId:   refID,
			FrameId: frameID,
			Frame:   b,
			Format:  pluginv2.DataFrameFormat_ARROW,
			Status:  http.StatusOK,
		}
	}
	wantFrame := func(refID, name string, values ...int64) *data.Frame {
		frame := data.NewFrame(name, data.NewField("value", nil, values))
		frame.RefID = refID
		return frame
	}

	tests := []struct {
		name   string
		chunks func(t *testing.T) []*pluginv2.QueryChunkedDataResponse
		// withSchema tells for each line whether it has the schema.
		withSchema []bool
		// want is the result of AccumulateJSONLines. It is nil when that function cannot read the lines.
		want map[string]data.Frames
	}{
		{
			name: "one frame in many chunks",
			chunks: func(t *testing.T) []*pluginv2.QueryChunkedDataResponse {
				return []*pluginv2.QueryChunkedDataResponse{
					arrowChunk(t, "A", "1", "table", 1, 2),
					arrowChunk(t, "A", "1", "table", 3),
					arrowChunk(t, "A", "1", "table", 4),
				}
			},
			withSchema: []bool{true, false, false},
			want:       map[string]data.Frames{"A": {wantFrame("A", "table", 1, 2, 3, 4)}},
		},
		{
			name: "first chunk without rows",
			chunks: func(t *testing.T) []*pluginv2.QueryChunkedDataResponse {
				return []*pluginv2.QueryChunkedDataResponse{
					arrowChunk(t, "A", "1", "table"),
					arrowChunk(t, "A", "1", "table", 1, 2),
					arrowChunk(t, "A", "1", "table", 3),
				}
			},
			withSchema: []bool{true, false, false},
			want:       map[string]data.Frames{"A": {wantFrame("A", "table", 1, 2, 3)}},
		},
		{
			name: "alternating frame IDs",
			chunks: func(t *testing.T) []*pluginv2.QueryChunkedDataResponse {
				return []*pluginv2.QueryChunkedDataResponse{
					arrowChunk(t, "A", "x", "x", 1),
					arrowChunk(t, "A", "y", "y", 10),
					arrowChunk(t, "A", "x", "x", 2),
				}
			},
			withSchema: []bool{true, true, false},
			want:       map[string]data.Frames{"A": {wantFrame("A", "x", 1, 2), wantFrame("A", "y", 10)}},
		},
		{
			name: "same frame ID for two refIDs",
			chunks: func(t *testing.T) []*pluginv2.QueryChunkedDataResponse {
				return []*pluginv2.QueryChunkedDataResponse{
					arrowChunk(t, "A", "1", "a", 1),
					arrowChunk(t, "B", "1", "b", 2),
					arrowChunk(t, "A", "1", "a", 3),
				}
			},
			withSchema: []bool{true, true, false},
			want: map[string]data.Frames{
				"A": {wantFrame("A", "a", 1, 3)},
				"B": {wantFrame("B", "b", 2)},
			},
		},
		{
			// A chunk without a frame ID is a separate frame. AccumulateJSONLines puts these chunks into
			// one frame, so this case checks only the lines.
			name: "chunks without a frame ID",
			chunks: func(t *testing.T) []*pluginv2.QueryChunkedDataResponse {
				return []*pluginv2.QueryChunkedDataResponse{
					arrowChunk(t, "A", "", "first", 1),
					arrowChunk(t, "A", "", "second", 2),
				}
			},
			withSchema: []bool{true, true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			writer := NewChunkedHTTPWriter(w)
			for _, chunk := range tt.chunks(t) {
				require.NoError(t, writer.OnChunk(chunk))
			}

			lines := strings.Split(strings.TrimSuffix(w.Body.String(), "\n"), "\n")
			require.Len(t, lines, len(tt.withSchema))
			for i, line := range lines {
				var record struct {
					Frame map[string]json.RawMessage `json:"frame"`
				}
				require.NoError(t, json.Unmarshal([]byte(line), &record))
				_, hasSchema := record.Frame["schema"]
				require.Equal(t, tt.withSchema[i], hasSchema, "schema in line %d: %s", i, line)
			}

			if tt.want == nil {
				return
			}
			rsp, err := AccumulateJSONLines(strings.NewReader(w.Body.String()))
			require.NoError(t, err)
			require.Len(t, rsp.Responses, len(tt.want))
			for refID, want := range tt.want {
				if diff := cmp.Diff(want, rsp.Responses[refID].Frames, data.FrameTestCompareOptions()...); diff != "" {
					t.Errorf("frames of refID %s mismatch (-want +got):\n%s", refID, diff)
				}
			}
		})
	}
}

func TestRawChunkWriter_ArrowChunksKeepMetadataOfFirstChunk(t *testing.T) {
	newFrame := func(meta *data.FrameMeta, values ...int64) *data.Frame {
		field := data.NewField("value", data.Labels{"host": "a"}, values).SetConfig(&data.FieldConfig{Unit: "ms"})
		frame := data.NewFrame("table", field).SetMeta(meta)
		frame.RefID = "A"
		return frame
	}
	first := &data.FrameMeta{
		ExecutedQueryString: "SELECT value FROM metrics",
		Notices:             []data.Notice{{Severity: data.NoticeSeverityInfo, Text: "first"}},
	}
	later := &data.FrameMeta{Notices: []data.Notice{{Severity: data.NoticeSeverityWarning, Text: "later"}}}

	w := httptest.NewRecorder()
	writer := NewChunkedHTTPWriter(w)
	for _, frame := range []*data.Frame{newFrame(first, 1), newFrame(later, 2)} {
		b, err := frame.MarshalArrow()
		require.NoError(t, err)
		require.NoError(t, writer.OnChunk(&pluginv2.QueryChunkedDataResponse{
			RefId:   "A",
			FrameId: "1",
			Frame:   b,
			Format:  pluginv2.DataFrameFormat_ARROW,
		}))
	}

	rsp, err := AccumulateJSONLines(strings.NewReader(w.Body.String()))
	require.NoError(t, err)
	// A line without the schema has no meta, so the meta of the later chunk is dropped.
	want := data.Frames{newFrame(first, 1, 2)}
	if diff := cmp.Diff(want, rsp.Responses["A"].Frames, data.FrameTestCompareOptions()...); diff != "" {
		t.Errorf("frames mismatch (-want +got):\n%s", diff)
	}
}

func TestRawChunkWriter_JSONChunksPassThrough(t *testing.T) {
	frame := data.NewFrame("table", data.NewField("value", nil, []int64{1}))
	first, err := data.FrameToJSON(frame, data.IncludeAll)
	require.NoError(t, err)
	later, err := data.FrameToJSON(frame, data.IncludeDataOnly)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	writer := NewChunkedHTTPWriter(w)
	chunks := [][]byte{first, later}
	for _, b := range chunks {
		require.NoError(t, writer.OnChunk(&pluginv2.QueryChunkedDataResponse{
			RefId:   "A",
			FrameId: "1",
			Frame:   b,
			Format:  pluginv2.DataFrameFormat_JSON,
		}))
	}

	lines := strings.Split(strings.TrimSuffix(w.Body.String(), "\n"), "\n")
	require.Len(t, lines, len(chunks))
	for i, want := range chunks {
		var record struct {
			Frame json.RawMessage `json:"frame"`
		}
		require.NoError(t, json.Unmarshal([]byte(lines[i]), &record))
		require.Equal(t, string(want), string(record.Frame), "line %d", i)
	}
}

func TestRawChunkWriterPreservesStatus(t *testing.T) {
	for _, tc := range []struct {
		name    string
		status  int32
		message string
		source  string
	}{
		{name: "unset status"},
		{name: "successful frame", status: http.StatusOK},
		{name: "downstream bad request", status: http.StatusBadRequest, message: "invalid query", source: "downstream"},
		{name: "unauthorized", status: http.StatusUnauthorized, message: "unauthorized", source: "plugin"},
		{name: "plugin failure", status: http.StatusInternalServerError, message: "plugin failed", source: "plugin"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			writer := NewChunkedHTTPWriter(recorder)
			chunk := &pluginv2.QueryChunkedDataResponse{RefId: "A", Status: tc.status, Error: tc.message, ErrorSource: tc.source}
			if tc.status == http.StatusOK {
				frame, err := data.NewFrame("result", data.NewField("value", nil, []int64{42})).MarshalJSON()
				require.NoError(t, err)
				chunk.Frame = frame
				chunk.Format = pluginv2.DataFrameFormat_JSON
			}
			require.NoError(t, writer.OnChunk(chunk))
			require.Equal(t, http.StatusOK, recorder.Code, "the JSONL transport remains HTTP 200")
			var record map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &record))
			status, present := record["status"]
			if tc.status == 0 {
				require.False(t, present)
			} else {
				require.True(t, present)
				var actual int32
				require.NoError(t, json.Unmarshal(status, &actual), "status must be a JSON number")
				require.Equal(t, tc.status, actual)
			}
			if tc.message != "" {
				require.JSONEq(t, `"`+tc.message+`"`, string(record["error"]))
				require.JSONEq(t, `"`+tc.source+`"`, string(record["errorSource"]))
			}
			require.True(t, recorder.Flushed)
		})
	}
}

type typedResponseErrorWriter struct {
	refID  string
	status backend.Status
	err    error
}

func (*typedResponseErrorWriter) WriteFrame(context.Context, string, string, *data.Frame) error {
	return nil
}

func (w *typedResponseErrorWriter) WriteError(_ context.Context, refID string, status backend.Status, err error) error {
	w.refID, w.status, w.err = refID, status, err
	return nil
}

func TestProcessTypedResponsePreservesErrorSource(t *testing.T) {
	for _, tc := range []struct {
		name                                   string
		source, embeddedSource, expectedSource backend.ErrorSource
		status                                 backend.Status
	}{
		{name: "explicit downstream", source: backend.ErrorSourceDownstream, expectedSource: backend.ErrorSourceDownstream, status: backend.StatusBadRequest},
		{name: "explicit plugin", source: backend.ErrorSourcePlugin, expectedSource: backend.ErrorSourcePlugin, status: backend.StatusInternal},
		{name: "unset source", status: backend.StatusUnauthorized},
		{name: "existing error source", embeddedSource: backend.ErrorSourceDownstream, expectedSource: backend.ErrorSourceDownstream, status: backend.StatusBadRequest},
		{name: "explicit source takes precedence", source: backend.ErrorSourcePlugin, embeddedSource: backend.ErrorSourceDownstream, expectedSource: backend.ErrorSourcePlugin, status: backend.StatusInternal},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cause := errors.New("query failed")
			var queryErr error = cause
			if tc.embeddedSource != "" {
				queryErr = backend.NewErrorWithSource(queryErr, tc.embeddedSource)
			}
			response := &backend.QueryDataResponse{Responses: backend.Responses{
				"A": {Status: tc.status, Error: queryErr, ErrorSource: tc.source},
			}}
			writer := &typedResponseErrorWriter{}
			require.NoError(t, ProcessTypedResponse(context.Background(), response, writer))
			require.Equal(t, "A", writer.refID)
			require.Equal(t, tc.status, writer.status)
			require.ErrorIs(t, writer.err, cause)
			require.EqualError(t, writer.err, cause.Error())
			require.Equal(t, tc.expectedSource, backend.ErrorResponseWithErrorSource(writer.err).ErrorSource)
		})
	}
}
