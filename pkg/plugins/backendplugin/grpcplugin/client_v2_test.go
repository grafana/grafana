package grpcplugin

import (
	"context"
	"errors"
	"io"
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
	"google.golang.org/grpc/status"

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
			name: "zero value requests JSON",
			want: pluginv2.DataFrameFormat_JSON,
		},
		{
			name:         "client set to Arrow requests Arrow",
			clientFormat: QueryDataFormatArrow,
			want:         pluginv2.DataFrameFormat_ARROW,
		},
		{
			name:      "context Arrow overrides the client zero value",
			setCtx:    true,
			ctxFormat: QueryDataFormatArrow,
			want:      pluginv2.DataFrameFormat_ARROW,
		},
		{
			name:         "context JSON overrides a client set to Arrow",
			clientFormat: QueryDataFormatArrow,
			setCtx:       true,
			ctxFormat:    QueryDataFormatJSON,
			want:         pluginv2.DataFrameFormat_JSON,
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
	c := &ClientV2{DataClient: fake}

	resp, err := c.QueryData(context.Background(), &backend.QueryDataRequest{Queries: []backend.DataQuery{{RefID: "A"}}})
	require.NoError(t, err)
	require.Equal(t, pluginv2.DataFrameFormat_JSON, fake.gotFormat)
	requireFrameEqual(t, testFrame(), resp)
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
			c := &ClientV2{DataClient: fake, QueryDataFormat: QueryDataFormatArrow}
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
