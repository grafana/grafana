package chunked

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

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
