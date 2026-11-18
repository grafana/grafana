package chunked

import (
	"context"
	"encoding/json"
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
