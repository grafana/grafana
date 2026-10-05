package pluginroute

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/kube-openapi/pkg/spec3"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

func TestHandlerStreamsCustomRouteAndCancels(t *testing.T) {
	plugin := testPlugin()
	plugin.Manifest.Versions[0].OpenAPI.Paths = map[string]spec3.PathProps{
		"/namespaces/{namespace}/stream": {Get: testOperation("stream")},
	}
	client := &streamingRouteClient{cancelled: make(chan struct{}), request: make(chan *pluginv3.CallRouteRequest, 1)}
	opts := allowAll(testOptions())
	opts.ClientV3 = client
	server := httptest.NewServer(withRequester(loadHandler(t, plugin, opts)))
	defer server.Close()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/apis/example.ext.grafana.app/v1alpha1/namespaces/default/stream?speed=1s&count=10", nil)
	require.NoError(t, err)
	res, err := server.Client().Do(req)
	require.NoError(t, err)
	defer res.Body.Close()
	require.Equal(t, http.StatusOK, res.StatusCode)
	require.Equal(t, "text/plain", res.Header.Get("Content-Type"))
	line, err := bufio.NewReader(res.Body).ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "first line\n", line)
	forwarded := <-client.request
	require.Equal(t, "stream", forwarded.GetPath())
	require.Equal(t, "default", forwarded.GetNamespace())
	require.Contains(t, forwarded.GetUrl(), "?speed=1s&count=10")
	// Recv blocks after the first chunk, so a buffered response cannot reach this point.
	cancel()
	select {
	case <-client.cancelled:
	case <-time.After(time.Second):
		t.Fatal("client disconnect did not cancel the plugin stream")
	}
}

type streamingRouteClient struct {
	stubClientV3
	cancelled chan struct{}
	request   chan *pluginv3.CallRouteRequest
}

func (c *streamingRouteClient) CallRoute(ctx context.Context, req *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	c.request <- req
	return &blockingRouteStream{ctx: ctx, cancelled: c.cancelled}, nil
}

type blockingRouteStream struct {
	grpc.ClientStream
	ctx       context.Context
	cancelled chan struct{}
	sent      bool
}

func (s *blockingRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	if !s.sent {
		s.sent = true
		response := &pluginv3.CallRouteResponse{}
		response.SetCode(http.StatusOK)
		response.SetHeaders(map[string]*pluginv3.StringList{"Content-Type": pluginv3.StringList_builder{Values: []string{"text/plain"}}.Build()})
		response.SetBody([]byte("first line\n"))
		return response, nil
	}
	<-s.ctx.Done()
	close(s.cancelled)
	return nil, s.ctx.Err()
}
