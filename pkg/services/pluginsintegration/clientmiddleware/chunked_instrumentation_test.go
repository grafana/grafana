package clientmiddleware

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/plugins/instrumentationutils"
	pluginlog "github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
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
		RefId:       "B",
		Error:       "boom",
		ErrorSource: "downstream",
		Status:      int32(backend.StatusBadRequest),
	}))

	// Chunks are forwarded to the underlying raw writer unchanged.
	require.Len(t, raw.chunks, 2)
	require.Equal(t, "A", raw.chunks[0].RefId)
	require.Equal(t, "B", raw.chunks[1].RefId)

	// Per-refID errors carried in chunks are recorded so status derivation works on
	// the raw path, where errors never flow through WriteError.
	errs := w.refErrors()
	require.Len(t, errs, 1)
	require.Equal(t, backend.ErrorSourceDownstream, errs[0].source)
	require.Equal(t, "B", errs[0].refID)
	require.Equal(t, backend.StatusBadRequest, errs[0].status)
	require.Equal(t, instrumentationutils.RequestStatusError, w.requestStatus(nil))
}

func TestErrorRecordingChunkedWriterTypedSource(t *testing.T) {
	sentinel := errors.New("writer failed")
	next := backend.NewChunkedDataWriter(backend.DataFrameFormat_JSON, func(*pluginv2.QueryChunkedDataResponse) error { return sentinel })
	w := &errorRecordingChunkedWriter{ChunkedDataWriter: next}
	require.ErrorIs(t, w.WriteError(t.Context(), "A", backend.StatusBadRequest, backend.DownstreamError(errors.New("query failed"))), sentinel)
	require.ErrorIs(t, w.WriteError(t.Context(), "B", backend.StatusInternal, errors.New("unspecified")), sentinel)
	require.Equal(t, backend.ErrorSourceDownstream, w.refErrors()[0].source)
	require.Empty(t, w.refErrors()[1].source)
	err := errors.New("source supplied separately")
	require.ErrorIs(t, w.WriteErrorWithSource(t.Context(), "C", backend.StatusBadRequest, err, backend.ErrorSourceDownstream), sentinel)
	require.Equal(t, backend.ErrorSourceDownstream, w.refErrors()[2].source)
	require.Same(t, err, w.refErrors()[2].err)
}

type partialFailureLog struct {
	*pluginlog.TestLogger
	fields map[string]any
}

func (l *partialFailureLog) FromContext(context.Context) pluginlog.Logger { return l }
func (l *partialFailureLog) Error(message string, args ...any) {
	if message != "Partial data response error" {
		return
	}
	l.fields = make(map[string]any)
	for i := 0; i < len(args); i += 2 {
		l.fields[args[i].(string)] = args[i+1]
	}
}

func TestChunkedLoggerIncludesPartialErrorSource(t *testing.T) {
	logger := &partialFailureLog{TestLogger: pluginlog.NewTestLogger()}
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewLoggerMiddleware(logger, pluginfakes.NewFakePluginRegistry())))
	sent := &pluginv2.QueryChunkedDataResponse{RefId: "B", Status: 400, Error: "bad query", ErrorSource: "downstream"}
	cdt.TestHandler.QueryChunkedDataFunc = func(_ context.Context, _ *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
		return w.(chunked.RawChunkReceiver).OnChunk(sent)
	}
	raw := &fakeRawChunkWriter{}
	require.NoError(t, cdt.MiddlewareHandler.QueryChunkedData(t.Context(), &backend.QueryChunkedDataRequest{}, raw))
	require.Equal(t, "downstream", logger.fields["statusSource"])
	require.Equal(t, "B", logger.fields["refID"])
	require.Len(t, raw.chunks, 1)
	require.Same(t, sent, raw.chunks[0])
}
