package grpcplugin

import (
	"context"
	"errors"
	"io"
	"net"
	"sync/atomic"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/responsesize"
)

type fakeDataClient struct {
	pluginv2.DataClient
	resp       *pluginv2.QueryDataResponse
	err        error
	chunks     []*pluginv2.QueryChunkedDataResponse
	chunkedErr error
}

func (f fakeDataClient) QueryData(context.Context, *pluginv2.QueryDataRequest, ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
	return f.resp, f.err
}

func (f fakeDataClient) QueryChunkedData(context.Context, *pluginv2.QueryChunkedDataRequest, ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv2.QueryChunkedDataResponse], error) {
	if f.chunkedErr != nil {
		return nil, f.chunkedErr
	}
	return &fakeChunkStream{chunks: f.chunks}, nil
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

// rawDiscardWriter takes chunks as they arrive, so ClientV2 forwards them without decoding.
type rawDiscardWriter struct{}

func (rawDiscardWriter) WriteFrame(context.Context, string, string, *data.Frame) error { return nil }
func (rawDiscardWriter) WriteError(context.Context, string, backend.Status, error) error {
	return nil
}
func (rawDiscardWriter) OnChunk(*pluginv2.QueryChunkedDataResponse) error { return nil }

// encodedResponse is a plugin response with A (two frames), B (one frame) and C (an error),
// and the frame bytes each refID should be reported as.
func encodedResponse(t *testing.T) (*pluginv2.QueryDataResponse, map[string]int64) {
	t.Helper()
	resp, err := backend.ToProto().QueryDataResponse(backend.DataFrameFormat_ARROW, &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{
			data.NewFrame("one", data.NewField("v", nil, []float64{1, 2, 3})),
			data.NewFrame("two", data.NewField("v", nil, []string{"x"})),
		}},
		"B": {Frames: data.Frames{data.NewFrame("three", data.NewField("v", nil, []int64{1}))}},
		"C": {Error: errors.New("boom")},
	}})
	require.NoError(t, err)

	want := map[string]int64{}
	for refID, r := range resp.Responses {
		want[refID] = 0
		for _, f := range r.Frames {
			want[refID] += int64(len(f))
		}
	}
	require.Positive(t, want["A"])
	return resp, want
}

func TestClientV2QueryDataRecordsResponseSizePerRefID(t *testing.T) {
	protoResp, want := encodedResponse(t)
	client := &ClientV2{DataClient: fakeDataClient{resp: protoResp}}
	ctx, recorder := responsesize.WithRecorder(context.Background())

	resp, err := client.QueryData(ctx, &backend.QueryDataRequest{})

	require.NoError(t, err)
	assert.Len(t, resp.Responses, 3)
	assert.Equal(t, want, recorder.Sizes())
}

func TestClientV2QueryChunkedDataRecordsResponseSizePerRefID(t *testing.T) {
	client := &ClientV2{DataClient: fakeDataClient{chunks: []*pluginv2.QueryChunkedDataResponse{
		{RefId: "A", FrameId: "1", Frame: make([]byte, 100)},
		{RefId: "B", FrameId: "1", Frame: make([]byte, 30)},
		{RefId: "A", FrameId: "2", Frame: make([]byte, 50)},
	}}}
	ctx, recorder := responsesize.WithRecorder(context.Background())

	err := client.QueryChunkedData(ctx, &backend.QueryChunkedDataRequest{}, rawDiscardWriter{})

	require.NoError(t, err)
	assert.Equal(t, map[string]int64{"A": 150, "B": 30}, recorder.Sizes())
}

func TestClientV2QueryChunkedDataFallbackRecordsResponseSize(t *testing.T) {
	protoResp, want := encodedResponse(t)
	client := &ClientV2{DataClient: fakeDataClient{resp: protoResp, chunkedErr: status.Error(codes.Unimplemented, "no chunking")}}
	ctx, recorder := responsesize.WithRecorder(context.Background())

	err := client.QueryChunkedData(ctx, &backend.QueryChunkedDataRequest{}, rawDiscardWriter{})

	require.NoError(t, err)
	assert.Equal(t, want, recorder.Sizes())
}

func TestClientV2ReleasesEncodedFramesOnceDecoded(t *testing.T) {
	tests := []struct {
		name  string
		query func(*ClientV2) error
	}{
		{"QueryData", func(c *ClientV2) error {
			_, err := c.QueryData(context.Background(), &backend.QueryDataRequest{})
			return err
		}},
		{"QueryChunkedData fallback", func(c *ClientV2) error {
			return c.QueryChunkedData(context.Background(), &backend.QueryChunkedDataRequest{}, &typedWriter{})
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			protoResp, _ := encodedResponse(t)
			client := &ClientV2{DataClient: fakeDataClient{resp: protoResp, chunkedErr: status.Error(codes.Unimplemented, "no chunking")}}

			require.NoError(t, tc.query(client))
			held := 0
			for _, r := range protoResp.Responses {
				for _, f := range r.Frames {
					if f != nil {
						held++
					}
				}
			}
			assert.Zero(t, held, "encoded frames still held after decoding")
		})
	}
}

// sdkPlugin serves QueryData and QueryChunkedData with the data server of the plugin SDK.
type sdkPlugin struct {
	queryDataCalls atomic.Int32
	chunkedCalls   atomic.Int32
	chunked        backend.QueryChunkedDataHandlerFunc
}

func namedFrame(name string) *data.Frame {
	return data.NewFrame(name, data.NewField("v", nil, []int64{1}))
}

// client connects to the plugin over an in-memory connection. A fake DataClient cannot show
// when a real server stream reports an error.
func (p *sdkPlugin) client(t *testing.T) *ClientV2 {
	t.Helper()
	opts, err := backend.GRPCServeOpts(backend.ServeOpts{
		QueryDataHandler: backend.QueryDataHandlerFunc(func(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			p.queryDataCalls.Add(1)
			resp := backend.NewQueryDataResponse()
			for _, q := range req.Queries {
				resp.Responses[q.RefID] = backend.DataResponse{Frames: data.Frames{namedFrame("query-data")}}
			}
			return resp, nil
		}),
		QueryChunkedDataHandler: backend.QueryChunkedDataHandlerFunc(func(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
			p.chunkedCalls.Add(1)
			return p.chunked(ctx, req, w)
		}),
	})
	require.NoError(t, err)

	listener := bufconn.Listen(1 << 20)
	server := grpc.NewServer()
	pluginv2.RegisterDataServer(server, opts.DataServer)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return listener.DialContext(ctx) }),
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	return &ClientV2{DataClient: pluginv2.NewDataClient(conn)}
}

type recordingWriter interface {
	backend.ChunkedDataWriter
	written() []string
}

// typedWriter keeps the refID and the name of each frame.
type typedWriter struct {
	frames []string
}

func (w *typedWriter) written() []string {
	return w.frames
}

func (w *typedWriter) WriteFrame(_ context.Context, refID string, _ string, f *data.Frame) error {
	w.frames = append(w.frames, refID+":"+f.Name)
	return nil
}

func (w *typedWriter) WriteError(context.Context, string, backend.Status, error) error {
	return nil
}

// rawWriter takes the chunks without decoding them in ClientV2, as the datasource API server does.
type rawWriter struct {
	typedWriter
}

func (w *rawWriter) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	f, err := data.UnmarshalArrowFrame(chunk.Frame)
	if err != nil {
		return err
	}
	return w.WriteFrame(context.Background(), chunk.RefId, chunk.FrameId, f)
}

func TestClientV2QueryChunkedDataWithSDKPlugin(t *testing.T) {
	req := &backend.QueryChunkedDataRequest{Queries: []backend.DataQuery{{RefID: "A"}}}
	writers := []struct {
		name   string
		writer func() recordingWriter
	}{
		{name: "typed writer", writer: func() recordingWriter { return &typedWriter{} }},
		{name: "raw writer", writer: func() recordingWriter { return &rawWriter{} }},
	}

	for _, tc := range writers {
		t.Run(tc.name, func(t *testing.T) {
			t.Run("falls back to QueryData if the plugin returns Unimplemented", func(t *testing.T) {
				plugin := &sdkPlugin{chunked: func(context.Context, *backend.QueryChunkedDataRequest, backend.ChunkedDataWriter) error {
					return status.Error(codes.Unimplemented, "unimplemented")
				}}
				client := plugin.client(t)

				for range 2 {
					w := tc.writer()
					require.NoError(t, client.QueryChunkedData(context.Background(), req, w))
					assert.Equal(t, []string{"A:query-data"}, w.written())
				}
				assert.Equal(t, int32(1), plugin.chunkedCalls.Load())
				assert.Equal(t, int32(2), plugin.queryDataCalls.Load())
			})

			t.Run("returns Unimplemented after a chunk", func(t *testing.T) {
				plugin := &sdkPlugin{chunked: func(ctx context.Context, _ *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
					if err := w.WriteFrame(ctx, "A", "1", namedFrame("chunked")); err != nil {
						return err
					}
					return status.Error(codes.Unimplemented, "unimplemented")
				}}
				w := tc.writer()

				err := plugin.client(t).QueryChunkedData(context.Background(), req, w)

				assert.Equal(t, codes.Unimplemented, status.Code(err))
				assert.Equal(t, []string{"A:chunked"}, w.written())
				assert.Zero(t, plugin.queryDataCalls.Load())
			})

			t.Run("uses QueryChunkedData if the plugin implements it", func(t *testing.T) {
				plugin := &sdkPlugin{chunked: func(ctx context.Context, _ *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
					return w.WriteFrame(ctx, "A", "1", namedFrame("chunked"))
				}}
				w := tc.writer()

				require.NoError(t, plugin.client(t).QueryChunkedData(context.Background(), req, w))

				assert.Equal(t, []string{"A:chunked"}, w.written())
				assert.Zero(t, plugin.queryDataCalls.Load())
			})
		})
	}
}
