package pluginroute

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/kube-openapi/pkg/spec3"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

// answeringRouteClient answers every route call with a status, a header and a
// body, so a test can see what reaches the caller.
type answeringRouteClient struct {
	appclientv3.Client
	method string
}

func (c *answeringRouteClient) CallRoute(_ context.Context, req *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	c.method = req.GetMethod()
	return &answeringRouteStream{}, nil
}

type answeringRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
	sent bool
}

func (s *answeringRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	if s.sent {
		return nil, io.EOF
	}
	s.sent = true
	rsp := &pluginv3.CallRouteResponse{}
	rsp.SetCode(http.StatusOK)
	rsp.SetHeaders(map[string]*pluginv3.StringList{"X-Report": pluginv3.StringList_builder{Values: []string{"ready"}}.Build()})
	rsp.SetBody([]byte("the report"))
	return rsp, nil
}

// ServeMux matches HEAD against a GET pattern, so a route that declares only
// GET is called for HEAD too. The plugin is asked for the GET it declared,
// since a plugin that finds its handler by method has none for HEAD, and the
// caller gets the status and headers without the body.
func TestRouteMuxHeadOnAGetRoute(t *testing.T) {
	manifest := testManifest(t)
	op := &spec3.Operation{}
	manifest.Versions[1].OpenAPI.Paths["/both"] = spec3.PathProps{Get: op, Head: op}
	client := &answeringRouteClient{}
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app", clientV3: client}
	handler := b.routeMux(http.NotFoundHandler(), prometheus.NewRegistry())
	root := "/apis/example.ext.grafana.app/v1alpha1/"
	serve := func(method, path string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(method, root+path, nil))
		return rec
	}

	rec := serve(http.MethodHead, "foobar")
	require.Equal(t, http.MethodGet, client.method, "the plugin is asked for the GET it declared")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "ready", rec.Header().Get("X-Report"))
	require.Empty(t, rec.Body.String(), "a HEAD response has no body")

	rec = serve(http.MethodGet, "foobar")
	require.Equal(t, http.MethodGet, client.method)
	require.Equal(t, "the report", rec.Body.String())

	// A route that declares HEAD itself is asked for HEAD.
	serve(http.MethodHead, "both")
	require.Equal(t, http.MethodHead, client.method)
}
