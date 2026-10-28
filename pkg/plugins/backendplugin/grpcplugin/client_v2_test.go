package grpcplugin

import (
	"context"
	"errors"
	"io"
	"testing"

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
