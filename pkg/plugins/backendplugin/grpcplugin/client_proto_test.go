package grpcplugin

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/hashicorp/go-plugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/responsesize"
)

func protoClientWith(data fakeDataClient) *protoClient {
	return &protoClient{plugin: &grpcPlugin{client: &plugin.Client{}, pluginClient: &ClientV2{DataClient: data}}}
}

func TestProtoClientQueryDataRecordsResponseSizePerRefID(t *testing.T) {
	protoResp, want := encodedResponse(t)
	ctx, recorder := responsesize.WithRecorder(context.Background())

	resp, err := protoClientWith(fakeDataClient{resp: protoResp}).QueryData(ctx, &pluginv2.QueryDataRequest{})

	require.NoError(t, err)
	assert.Same(t, protoResp, resp, "the response is handed back as is")
	assert.Equal(t, want, recorder.Sizes())
}

func TestProtoClientQueryDataRecordsNothingWhenTheCallFails(t *testing.T) {
	protoResp, _ := encodedResponse(t)
	ctx, recorder := responsesize.WithRecorder(context.Background())

	_, err := protoClientWith(fakeDataClient{resp: protoResp, err: errors.New("unavailable")}).QueryData(ctx, &pluginv2.QueryDataRequest{})

	require.Error(t, err)
	assert.Empty(t, recorder.Sizes())
}
