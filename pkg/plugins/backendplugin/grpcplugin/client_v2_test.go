package grpcplugin

import (
	"context"
	"errors"
	"io"
	"net"
	"reflect"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
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

// formatDataClient records the format of the last QueryData request and answers with respond.
// QueryChunkedData is Unimplemented, which makes ClientV2 fall back to the unary facade.
type formatDataClient struct {
	pluginv2.DataClient
	gotFormat pluginv2.DataFrameFormat
	respond   func(req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error)
}

func (f *formatDataClient) QueryData(_ context.Context, req *pluginv2.QueryDataRequest, _ ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
	f.gotFormat = req.Format
	return f.respond(req)
}

func (f *formatDataClient) QueryChunkedData(_ context.Context, _ *pluginv2.QueryChunkedDataRequest, _ ...grpc.CallOption) (pluginv2.Data_QueryChunkedDataClient, error) {
	return nil, status.Error(codes.Unimplemented, "chunked not supported")
}

// respondInRequestedFormat behaves like a plugin on an SDK that understands the format field.
func respondInRequestedFormat(resp *backend.QueryDataResponse) func(*pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	return func(req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
		return backend.ToProto().QueryDataResponse(backend.DataFrameFormat(req.Format), resp)
	}
}

// respondInArrow behaves like a plugin on an SDK that predates the format field. It ignores the
// request field, answers Arrow and leaves the reply format at its zero value.
func respondInArrow(resp *backend.QueryDataResponse) func(*pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	return func(_ *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
		return backend.ToProto().QueryDataResponse(backend.DataFrameFormat_ARROW, resp)
	}
}

func testFrame() *data.Frame {
	f := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{time.Unix(1700000000, 0)}),
		data.NewField("Value", data.Labels{"__name__": "up"}, []float64{1.5}),
	)
	f.RefID = "A"
	f.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti, TypeVersion: data.FrameTypeVersion{0, 1}}
	return f
}

func testResponse() *backend.QueryDataResponse {
	return &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{testFrame()}}}}
}

func requireFrameEqual(t *testing.T, want *data.Frame, resp *backend.QueryDataResponse) {
	t.Helper()
	require.Len(t, resp.Responses["A"].Frames, 1)
	require.Empty(t, cmp.Diff(want, resp.Responses["A"].Frames[0], data.FrameTestCompareOptions()...))
}

func TestClientV2QueryDataFormat(t *testing.T) {
	tests := []struct {
		name         string
		clientFormat QueryDataFormat
		setCtx       bool
		ctxFormat    QueryDataFormat
		want         pluginv2.DataFrameFormat
	}{
		{
			name: "zero value requests Arrow",
			want: pluginv2.DataFrameFormat_ARROW,
		},
		{
			name:         "client set to JSON requests JSON",
			clientFormat: QueryDataFormatJSON,
			want:         pluginv2.DataFrameFormat_JSON,
		},
		{
			name:      "context JSON overrides the client zero value",
			setCtx:    true,
			ctxFormat: QueryDataFormatJSON,
			want:      pluginv2.DataFrameFormat_JSON,
		},
		{
			name:         "context Arrow overrides a client set to JSON",
			clientFormat: QueryDataFormatJSON,
			setCtx:       true,
			ctxFormat:    QueryDataFormatArrow,
			want:         pluginv2.DataFrameFormat_ARROW,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			fake := &formatDataClient{respond: respondInRequestedFormat(testResponse())}
			c := &ClientV2{DataClient: fake, QueryDataFormat: tc.clientFormat}

			ctx := context.Background()
			if tc.setCtx {
				ctx = WithQueryDataFormat(ctx, tc.ctxFormat)
			}

			resp, err := c.QueryData(ctx, &backend.QueryDataRequest{Queries: []backend.DataQuery{{RefID: "A"}}})
			require.NoError(t, err)
			require.Equal(t, tc.want, fake.gotFormat)
			requireFrameEqual(t, testFrame(), resp)
		})
	}
}

func TestClientV2QueryDataDecodesByReplyFormat(t *testing.T) {
	fake := &formatDataClient{respond: respondInArrow(testResponse())}
	c := &ClientV2{DataClient: fake, QueryDataFormat: QueryDataFormatJSON}

	resp, err := c.QueryData(context.Background(), &backend.QueryDataRequest{Queries: []backend.DataQuery{{RefID: "A"}}})
	require.NoError(t, err)
	require.Equal(t, pluginv2.DataFrameFormat_JSON, fake.gotFormat)
	requireFrameEqual(t, testFrame(), resp)
}

func TestClientV2QueryDataJSONTimesMatchArrow(t *testing.T) {
	first := time.Unix(1700000000, 123456789)
	second := time.Unix(1700000015, 987654321)
	frame := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{first, second}),
		data.NewField("NullableTime", nil, []*time.Time{&second, nil}),
		data.NewField("Value", nil, []float64{1, 2}),
	)
	frame.RefID = "A"
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}

	decode := func(format QueryDataFormat) *data.Frame {
		fake := &formatDataClient{respond: respondInRequestedFormat(resp)}
		c := &ClientV2{DataClient: fake, QueryDataFormat: format}
		decoded, err := c.QueryData(context.Background(), &backend.QueryDataRequest{Queries: []backend.DataQuery{{RefID: "A"}}})
		require.NoError(t, err)
		require.Len(t, decoded.Responses["A"].Frames, 1)
		return decoded.Responses["A"].Frames[0]
	}
	arrowFrame := decode(QueryDataFormatArrow)
	jsonFrame := decode(QueryDataFormatJSON)

	require.True(t, reflect.DeepEqual(arrowFrame, jsonFrame), "JSON and Arrow decode to different frames")
	for i := range 2 {
		require.Equal(t, time.Local, jsonFrame.Fields[0].At(i).(time.Time).Location())
	}
	require.Equal(t, time.Local, jsonFrame.Fields[1].At(0).(*time.Time).Location())
	require.Nil(t, jsonFrame.Fields[1].At(1))
}

func TestClientV2QueryChunkedDataFacadeKeepsChunkedFormat(t *testing.T) {
	tests := []struct {
		name   string
		writer backend.ChunkedDataWriter
		want   pluginv2.DataFrameFormat
	}{
		{
			name:   "typed writer requests Arrow",
			writer: &typedChunkedWriter{},
			want:   pluginv2.DataFrameFormat_ARROW,
		},
		{
			name:   "raw receiver keeps the requested JSON",
			writer: &rawChunkedWriter{},
			want:   pluginv2.DataFrameFormat_JSON,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			fake := &formatDataClient{respond: respondInRequestedFormat(testResponse())}
			c := &ClientV2{DataClient: fake, QueryDataFormat: QueryDataFormatJSON}
			ctx := WithQueryDataFormat(context.Background(), QueryDataFormatJSON)

			req := &backend.QueryChunkedDataRequest{
				Queries: []backend.DataQuery{{RefID: "A"}},
				Format:  backend.DataFrameFormat_JSON,
			}
			require.NoError(t, c.QueryChunkedData(ctx, req, tc.writer))
			require.Equal(t, tc.want, fake.gotFormat)
		})
	}
}

type typedChunkedWriter struct{}

func (typedChunkedWriter) WriteFrame(_ context.Context, _ string, _ string, _ *data.Frame) error {
	return nil
}

func (typedChunkedWriter) WriteError(_ context.Context, _ string, _ backend.Status, _ error) error {
	return nil
}

type rawChunkedWriter struct {
	typedChunkedWriter
}

func (rawChunkedWriter) OnChunk(_ *pluginv2.QueryChunkedDataResponse) error {
	return nil
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

// typedWriter keeps the refID and the name of each frame, and the refID and the message of each error.
type typedWriter struct {
	writes []string
}

func (w *typedWriter) written() []string {
	return w.writes
}

func (w *typedWriter) WriteFrame(_ context.Context, refID string, _ string, f *data.Frame) error {
	w.writes = append(w.writes, refID+":"+f.Name)
	return nil
}

func (w *typedWriter) WriteError(_ context.Context, refID string, _ backend.Status, err error) error {
	w.writes = append(w.writes, refID+":error:"+err.Error())
	return nil
}

// rawWriter takes the chunks without decoding them in ClientV2, as the datasource API server does.
type rawWriter struct {
	typedWriter
}

func (w *rawWriter) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	if chunk.Error != "" {
		return w.WriteError(context.Background(), chunk.RefId, backend.Status(chunk.Status), errors.New(chunk.Error))
	}
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

			t.Run("delivers the errors of the plugin", func(t *testing.T) {
				plugin := &sdkPlugin{chunked: func(ctx context.Context, _ *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
					if err := w.WriteFrame(ctx, "A", "1", namedFrame("chunked")); err != nil {
						return err
					}
					return w.WriteError(ctx, "A", backend.StatusBadRequest, errors.New("bad query"))
				}}
				w := tc.writer()

				require.NoError(t, plugin.client(t).QueryChunkedData(context.Background(), req, w))

				assert.Equal(t, []string{"A:chunked", "A:error:bad query"}, w.written())
			})
		})
	}
}
