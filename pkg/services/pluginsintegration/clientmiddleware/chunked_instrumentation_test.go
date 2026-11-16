package clientmiddleware

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/plugins/instrumentationutils"
)

// fakeRawChunkWriter mimics chunked.rawChunkWriter: it implements both
// backend.ChunkedDataWriter and chunked.RawChunkReceiver, and only the OnChunk
// path actually accepts writes (WriteFrame/WriteError are unsupported), matching
// the real raw HTTP streaming writer used by the datasource apiserver.
type fakeRawChunkWriter struct {
	chunks []*pluginv2.QueryChunkedDataResponse
}

var (
	_ backend.ChunkedDataWriter = (*fakeRawChunkWriter)(nil)
	_ chunked.RawChunkReceiver  = (*fakeRawChunkWriter)(nil)
)

func (w *fakeRawChunkWriter) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	w.chunks = append(w.chunks, chunk)
	return nil
}

func (w *fakeRawChunkWriter) WriteFrame(context.Context, string, string, *data.Frame) error {
	return errors.New("WriteFrame not supported")
}

func (w *fakeRawChunkWriter) WriteError(context.Context, string, backend.Status, error) error {
	return errors.New("WriteError not supported")
}

// The raw HTTP streaming fast path in coreplugin type-asserts the writer to
// chunked.RawChunkReceiver; the instrumentation wrapper must stay transparent to
// that assertion, otherwise the raw writer is bypassed and frames are dropped.
func TestErrorRecordingChunkedWriterForwardsOnChunk(t *testing.T) {
	raw := &fakeRawChunkWriter{}
	w := &errorRecordingChunkedWriter{ChunkedDataWriter: raw}

	receiver, ok := interface{}(w).(chunked.RawChunkReceiver)
	require.True(t, ok, "wrapper must satisfy chunked.RawChunkReceiver")

	require.NoError(t, receiver.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A"}))
	require.NoError(t, receiver.OnChunk(&pluginv2.QueryChunkedDataResponse{
		RefId:  "B",
		Error:  "boom",
		Status: int32(backend.StatusBadRequest),
	}))

	// Chunks are forwarded to the underlying raw writer unchanged.
	require.Len(t, raw.chunks, 2)
	require.Equal(t, "A", raw.chunks[0].RefId)
	require.Equal(t, "B", raw.chunks[1].RefId)

	// Per-refID errors carried in chunks are recorded so status derivation works on
	// the raw path, where errors never flow through WriteError.
	errs := w.refErrors()
	require.Len(t, errs, 1)
	require.Equal(t, "B", errs[0].refID)
	require.Equal(t, backend.StatusBadRequest, errs[0].status)
	require.Equal(t, instrumentationutils.RequestStatusError, w.requestStatus(nil))
}
