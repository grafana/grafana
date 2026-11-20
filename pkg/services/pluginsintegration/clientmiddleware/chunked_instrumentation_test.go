package clientmiddleware

import (
	"context"
	"errors"
	"io"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
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

	receiver, ok := w.writer().(chunked.RawChunkReceiver)
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

type typedErrorSink struct {
	backend.ChunkedDataWriter
	got     error
	sendErr error
}

func (s *typedErrorSink) WriteError(_ context.Context, _ string, _ backend.Status, err error) error {
	s.got = err
	return s.sendErr
}

func TestErrorRecordingChunkedWriterTypedSource(t *testing.T) {
	for _, tc := range []struct {
		name                                        string
		err                                         error
		responseSource, wantRecorded, wantForwarded backend.ErrorSource
	}{
		{"tagged error", backend.DownstreamError(errors.New("query failed")), "", backend.ErrorSourceDownstream, backend.ErrorSourceDownstream},
		{"unspecified", errors.New("unspecified"), "", "", ""},
		{"explicit response source", backend.PluginError(errors.New("query failed")), backend.ErrorSourceDownstream, backend.ErrorSourceDownstream, backend.ErrorSourceDownstream},
		{"cancellation", context.Canceled, "", backend.ErrorSourceDownstream, ""},
		{"explicit plugin cancellation", backend.PluginError(context.Canceled), "", backend.ErrorSourcePlugin, backend.ErrorSourcePlugin},
	} {
		t.Run(tc.name, func(t *testing.T) {
			next := &typedErrorSink{sendErr: errors.New("writer failed")}
			w := &errorRecordingChunkedWriter{ChunkedDataWriter: next}
			response := &backend.QueryDataResponse{Responses: backend.Responses{
				"A": {Status: backend.StatusBadRequest, Error: tc.err, ErrorSource: tc.responseSource},
			}}
			require.ErrorIs(t, chunked.ProcessTypedResponse(t.Context(), response, w), next.sendErr)
			require.ErrorIs(t, next.got, tc.err)
			require.Equal(t, tc.wantForwarded, backend.ErrorResponseWithErrorSource(next.got).ErrorSource)
			require.Len(t, w.refErrors(), 1)
			require.Equal(t, tc.wantRecorded, w.refErrors()[0].source)
		})
	}
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

// fakeChunkStreamClient streams the given chunks, as a plugin does for QueryChunkedData.
type fakeChunkStreamClient struct {
	pluginv2.DataClient
	chunks []*pluginv2.QueryChunkedDataResponse
}

func (c fakeChunkStreamClient) QueryChunkedData(context.Context, *pluginv2.QueryChunkedDataRequest, ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv2.QueryChunkedDataResponse], error) {
	return &fakeChunkStream{chunks: c.chunks}, nil
}

type fakeChunkStream struct {
	grpc.ClientStream
	chunks []*pluginv2.QueryChunkedDataResponse
}

func (s *fakeChunkStream) Recv() (*pluginv2.QueryChunkedDataResponse, error) {
	if len(s.chunks) == 0 {
		return nil, io.EOF
	}
	chunk := s.chunks[0]
	s.chunks = s.chunks[1:]
	return chunk, nil
}

// typedChunkWriter keeps the refID and the name of each frame, and the refID and the status of each error.
type typedChunkWriter struct {
	frames []string
	errors map[string]backend.Status
}

func (w *typedChunkWriter) WriteFrame(_ context.Context, refID string, _ string, f *data.Frame) error {
	w.frames = append(w.frames, refID+":"+f.Name)
	return nil
}

func (w *typedChunkWriter) WriteError(_ context.Context, refID string, status backend.Status, _ error) error {
	if w.errors == nil {
		w.errors = map[string]backend.Status{}
	}
	w.errors[refID] = status
	return nil
}

func TestChunkedMiddlewareDeliversChunksToTypedWriter(t *testing.T) {
	frame, err := data.NewFrame("one", data.NewField("v", nil, []int64{1})).MarshalArrow()
	require.NoError(t, err)
	client := &grpcplugin.ClientV2{DataClient: fakeChunkStreamClient{chunks: []*pluginv2.QueryChunkedDataResponse{
		{RefId: "A", FrameId: "1", Frame: frame},
		{RefId: "B", Status: int32(backend.StatusBadRequest), Error: "bad query", ErrorSource: "downstream"},
	}}}
	pluginsRegistry := pluginfakes.NewFakePluginRegistry()
	require.NoError(t, pluginsRegistry.Add(t.Context(), &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Backend: true}}))
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(
		NewMetricsMiddleware(prometheus.NewRegistry(), pluginsRegistry),
		NewLoggerMiddleware(pluginlog.NewTestLogger(), pluginsRegistry),
	))
	cdt.TestHandler.QueryChunkedDataFunc = client.QueryChunkedData
	w := &typedChunkWriter{}
	req := &backend.QueryChunkedDataRequest{PluginContext: backend.PluginContext{PluginID: pluginID}}

	require.NoError(t, cdt.MiddlewareHandler.QueryChunkedData(t.Context(), req, w))

	require.Equal(t, []string{"A:one"}, w.frames)
	require.Equal(t, map[string]backend.Status{"B": backend.StatusBadRequest}, w.errors)
}
