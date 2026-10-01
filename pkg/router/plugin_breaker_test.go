package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/sony/gobreaker/v2"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute"
)

type failingPluginClient struct {
	appclientv3.Client
	err    error
	calls  int
	stream grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
}

func (c *failingPluginClient) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	c.calls++
	return &pluginv3.AdmissionReviewResponse{}, c.err
}
func (c *failingPluginClient) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	c.calls++
	return &pluginv3.ConvertObjectsResponse{}, c.err
}
func (c *failingPluginClient) CallRoute(context.Context, *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	c.calls++
	return c.stream, c.err
}

func TestPluginBreakerLeavesStorageReadsAvailable(t *testing.T) {
	cb := newGroupBreaker("plugin")
	raw := &failingPluginClient{err: status.Error(codes.Unavailable, "offline")}
	client := &breakerPluginClientV3{Client: raw}
	storageReads := 0
	handler := &tracedPluginHandler{Handler: &pluginroute.Handler{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/saved" {
			storageReads++
			w.WriteHeader(http.StatusOK)
			return
		}
		_, err := client.AdmissionReview(r.Context(), &pluginv3.AdmissionReviewRequest{})
		if err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	})}}
	for i := 0; i < 7; i++ {
		response := httptest.NewRecorder()
		serveThroughBreaker(cb, "plugin", handler, response, httptest.NewRequest(http.MethodPost, "/plugin", nil))
		require.Equal(t, http.StatusServiceUnavailable, response.Code)
	}
	require.Equal(t, gobreaker.StateOpen, cb.State())
	require.Equal(t, 6, raw.calls)
	response := httptest.NewRecorder()
	serveThroughBreaker(cb, "plugin", handler, response, httptest.NewRequest(http.MethodGet, "/saved", nil))
	require.Equal(t, http.StatusOK, response.Code)
	require.Equal(t, 1, storageReads)
	require.Equal(t, gobreaker.StateOpen, cb.State())
	response = httptest.NewRecorder()
	serveThroughBreaker(cb, "plugin", handler, response, httptest.NewRequest(http.MethodGet, "/plugin", nil))
	require.Equal(t, http.StatusServiceUnavailable, response.Code)
	require.Equal(t, 6, raw.calls)
}

func TestPluginClientOutcome(t *testing.T) {
	for _, err := range []error{status.Error(codes.Unavailable, "offline"), status.Error(codes.DeadlineExceeded, "timeout"), plugins.ErrPluginUnavailable, plugins.ErrPluginNotRegistered, plugins.ErrPluginGrpcConnectionUnavailableBaseFn(t.Context()).Errorf("offline"), apierrors.NewServiceUnavailable("not loaded")} {
		require.ErrorIs(t, pluginClientOutcome(t.Context(), err), err)
	}
	for _, err := range []error{nil, io.EOF, errors.New("plugin application error"), status.Error(codes.Internal, "application error"), status.Error(codes.InvalidArgument, "bad input")} {
		require.NoError(t, pluginClientOutcome(t.Context(), err))
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	require.ErrorIs(t, pluginClientOutcome(ctx, status.Error(codes.Unavailable, "offline")), errCallerGone)
}

type pluginRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
	err error
}

func (s *pluginRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	res := &pluginv3.CallRouteResponse{}
	res.SetCode(http.StatusServiceUnavailable)
	return res, s.err
}

func TestPluginStreamBreaker(t *testing.T) {
	cb := newGroupBreaker("plugin")
	ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
	stream := &pluginRouteStream{err: status.Error(codes.Unavailable, "offline")}
	client := &breakerPluginClientV3{Client: &failingPluginClient{stream: stream}}
	for i := 0; i < 6; i++ {
		result, err := client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
		require.NoError(t, err)
		_, err = result.Recv()
		require.Error(t, err)
	}
	require.Equal(t, gobreaker.StateOpen, cb.State())
}

func TestPluginResponsesDoNotTripBreaker(t *testing.T) {
	cb := newGroupBreaker("plugin")
	ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
	stream := &pluginRouteStream{}
	client := &breakerPluginClientV3{Client: &failingPluginClient{stream: stream}}
	for i := 0; i < 7; i++ {
		_, err := client.AdmissionReview(ctx, &pluginv3.AdmissionReviewRequest{})
		require.NoError(t, err)
		result, err := client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
		require.NoError(t, err)
		res, err := result.Recv()
		require.NoError(t, err)
		require.Equal(t, int32(503), res.GetCode())
		// Later stream failures do not change the outcome already recorded.
		stream.err = status.Error(codes.Unavailable, "stream ended")
		_, err = result.Recv()
		require.Error(t, err)
		stream.err = nil
	}
	require.Equal(t, gobreaker.StateClosed, cb.State())
	require.Zero(t, cb.Counts().TotalFailures)
}

type legacyPluginClient struct {
	plugins.Client
	err error
}

func (c *legacyPluginClient) CallResource(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if c.err != nil {
		return c.err
	}
	return sender.Send(&backend.CallResourceResponse{Status: http.StatusServiceUnavailable})
}

type discardPluginResponse struct{}

func (discardPluginResponse) Send(*backend.CallResourceResponse) error { return nil }

func TestLegacyPluginBreaker(t *testing.T) {
	for _, err := range []error{nil, plugins.ErrPluginUnavailable} {
		cb := newGroupBreaker("plugin")
		ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
		client := &breakerPluginClient{Client: &legacyPluginClient{err: err}}
		for i := 0; i < 6; i++ {
			_ = client.CallResource(ctx, &backend.CallResourceRequest{}, discardPluginResponse{})
		}
		if err == nil {
			require.Equal(t, gobreaker.StateClosed, cb.State())
		} else {
			require.Equal(t, gobreaker.StateOpen, cb.State())
		}
	}
}
