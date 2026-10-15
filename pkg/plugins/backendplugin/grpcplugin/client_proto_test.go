package grpcplugin

import (
	"context"
	"errors"
	"io"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/hashicorp/go-plugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/responsesize"
)

// protoClientWith builds a protoClient whose plugin is "running" with the given data client.
func protoClientWith(data fakeDataClient) *protoClient {
	return &protoClient{plugin: &grpcPlugin{client: &plugin.Client{}, pluginClient: &ClientV2{DataClient: data}}}
}

func TestProtoClientQueryDataRecordsResponseSizePerRefID(t *testing.T) {
	protoResp, want := encodedResponse(t)
	client := protoClientWith(fakeDataClient{resp: protoResp})
	ctx, recorder := responsesize.WithRecorder(context.Background())

	resp, err := client.QueryData(ctx, &pluginv2.QueryDataRequest{})

	require.NoError(t, err)
	assert.Same(t, protoResp, resp, "the response is handed back as is")
	assert.Equal(t, want, recorder.Sizes())
}

func TestProtoClientQueryDataWorksWithoutARecorder(t *testing.T) {
	protoResp, _ := encodedResponse(t)

	resp, err := protoClientWith(fakeDataClient{resp: protoResp}).QueryData(context.Background(), &pluginv2.QueryDataRequest{})

	require.NoError(t, err)
	assert.Same(t, protoResp, resp)
}

func TestProtoClientQueryDataRecordsNothingWhenTheCallFails(t *testing.T) {
	client := protoClientWith(fakeDataClient{err: errors.New("unavailable")})
	ctx, recorder := responsesize.WithRecorder(context.Background())

	_, err := client.QueryData(ctx, &pluginv2.QueryDataRequest{})

	require.Error(t, err)
	assert.Empty(t, recorder.Sizes())
}

func TestProtoClientQueryChunkedDataRecordsChunksAsTheyAreRead(t *testing.T) {
	client := protoClientWith(fakeDataClient{chunks: []*pluginv2.QueryChunkedDataResponse{
		{RefId: "A", Frame: make([]byte, 100)},
		{RefId: "B", Frame: make([]byte, 30)},
		{RefId: "A", Frame: make([]byte, 50)},
	}})
	ctx, recorder := responsesize.WithRecorder(context.Background())

	stream, err := client.QueryChunkedData(ctx, &pluginv2.QueryChunkedDataRequest{})
	require.NoError(t, err)
	assert.Empty(t, recorder.Sizes(), "opening the stream reads nothing")
	for {
		if _, err := stream.Recv(); err != nil {
			require.ErrorIs(t, err, io.EOF)
			break
		}
	}

	assert.Equal(t, map[string]int64{"A": 150, "B": 30}, recorder.Sizes())
}

func TestProtoClientQueryChunkedDataWithoutARecorderReturnsTheRawStream(t *testing.T) {
	client := protoClientWith(fakeDataClient{})

	stream, err := client.QueryChunkedData(context.Background(), &pluginv2.QueryChunkedDataRequest{})

	require.NoError(t, err)
	_, isFake := stream.(*fakeChunkStream)
	assert.True(t, isFake, "no recorder means no wrapper")
}
