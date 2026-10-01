package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

type stubPluginClientV3 struct {
	appclientv3.Client
	err    error
	calls  int
	stream grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
}

func (c *stubPluginClientV3) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	c.calls++
	return &pluginv3.AdmissionReviewResponse{}, c.err
}

func (c *stubPluginClientV3) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	c.calls++
	return &pluginv3.ConvertObjectsResponse{}, c.err
}

func (c *stubPluginClientV3) CallRoute(context.Context, *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	c.calls++
	return c.stream, c.err
}

func TestPluginBreakerLeavesStorageReadsAvailable(t *testing.T) {
	cb := newGroupBreaker("plugin")
	raw := &stubPluginClientV3{err: status.Error(codes.Unavailable, "offline")}
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
	tests := []struct {
		name        string
		err         error
		wantFailure bool
	}{
		{"unavailable", status.Error(codes.Unavailable, "offline"), true},
		{"timeout", status.Error(codes.DeadlineExceeded, "timeout"), true},
		{"plugin unavailable", plugins.ErrPluginUnavailable, true},
		{"plugin not registered", plugins.ErrPluginNotRegistered, true},
		{"legacy connection unavailable", plugins.ErrPluginGrpcConnectionUnavailableBaseFn(t.Context()).Errorf("offline"), true},
		{"plugin not loaded", apierrors.NewServiceUnavailable("not loaded"), true},
		{"success", nil, false},
		{"end of stream", io.EOF, false},
		{"application error", errors.New("plugin application error"), false},
		{"internal error", status.Error(codes.Internal, "application error"), false},
		{"invalid argument", status.Error(codes.InvalidArgument, "bad input"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			outcome := pluginClientOutcome(t.Context(), tt.err)
			if tt.wantFailure {
				require.ErrorIs(t, outcome, tt.err)
			} else {
				require.NoError(t, outcome)
			}
		})
	}
	t.Run("caller canceled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		cancel()
		require.ErrorIs(t, pluginClientOutcome(ctx, status.Error(codes.Unavailable, "offline")), errCallerGone)
	})
}

type stubPluginRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
	err error
}

func (s *stubPluginRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	res := &pluginv3.CallRouteResponse{}
	res.SetCode(http.StatusServiceUnavailable)
	return res, s.err
}

func TestPluginStreamBreaker(t *testing.T) {
	cb := newGroupBreaker("plugin")
	ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
	stream := &stubPluginRouteStream{err: status.Error(codes.Unavailable, "offline")}
	client := &breakerPluginClientV3{Client: &stubPluginClientV3{stream: stream}}
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
	stream := &stubPluginRouteStream{}
	client := &breakerPluginClientV3{Client: &stubPluginClientV3{stream: stream}}
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

type stubLegacyPluginClient struct {
	plugins.Client
	err error
}

func (c *stubLegacyPluginClient) CallResource(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if c.err != nil {
		return c.err
	}
	return sender.Send(&backend.CallResourceResponse{Status: http.StatusServiceUnavailable})
}

func TestLegacyPluginBreaker(t *testing.T) {
	tests := []struct {
		name      string
		err       error
		wantState gobreaker.State
	}{
		{"HTTP error response", nil, gobreaker.StateClosed},
		{"connection failure", plugins.ErrPluginUnavailable, gobreaker.StateOpen},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cb := newGroupBreaker("plugin")
			ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
			client := &breakerPluginClient{Client: &stubLegacyPluginClient{err: tt.err}}
			sender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
				require.Equal(t, http.StatusServiceUnavailable, res.Status)
				return nil
			})
			for i := 0; i < 6; i++ {
				err := client.CallResource(ctx, &backend.CallResourceRequest{}, sender)
				if tt.err != nil {
					require.ErrorIs(t, err, tt.err)
				} else {
					require.NoError(t, err)
				}
			}
			require.Equal(t, tt.wantState, cb.State())
		})
	}
}

func TestPluginStreamClosesHalfOpenBreakerOnFirstResponse(t *testing.T) {
	cb := gobreaker.NewTwoStepCircuitBreaker[struct{}](gobreaker.Settings{
		ReadyToTrip: func(counts gobreaker.Counts) bool { return counts.ConsecutiveFailures >= 1 },
		Timeout:     20 * time.Millisecond,
	})
	ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
	stream := &stubPluginRouteStream{err: status.Error(codes.Unavailable, "offline")}
	client := &breakerPluginClientV3{Client: &stubPluginClientV3{stream: stream}}
	response, err := client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
	require.NoError(t, err)
	_, err = response.Recv()
	require.Error(t, err)
	require.Equal(t, gobreaker.StateOpen, cb.State())
	require.Eventually(t, func() bool { return cb.State() == gobreaker.StateHalfOpen }, time.Second, time.Millisecond)

	stream.err = nil
	response, err = client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
	require.NoError(t, err)
	_, err = client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
	require.True(t, apierrors.IsServiceUnavailable(err), "only one trial call is allowed")
	_, err = response.Recv()
	require.NoError(t, err)
	require.Equal(t, gobreaker.StateClosed, cb.State(), "the stream need not end to release the trial slot")
}
