package router

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
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
	panicValue any
	err        error
	calls      int
	stream     grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
}

func (c *stubPluginClientV3) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	if c.panicValue != nil {
		panic(c.panicValue)
	}
	c.calls++
	return &pluginv3.AdmissionReviewResponse{}, c.err
}

func (c *stubPluginClientV3) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	if c.panicValue != nil {
		panic(c.panicValue)
	}
	c.calls++
	return &pluginv3.ConvertObjectsResponse{}, c.err
}

func (c *stubPluginClientV3) CallRoute(context.Context, *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	if c.panicValue != nil {
		panic(c.panicValue)
	}
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
		{"panic", errPluginClientPanic, true},
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
	panicValue any
	err        error
}

func (s *stubPluginRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	if s.panicValue != nil {
		panic(s.panicValue)
	}
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
	panicValue any
	err        error
}

func (c *stubLegacyPluginClient) CallResource(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if c.panicValue != nil {
		panic(c.panicValue)
	}
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

// These clients allow the test to hold failed calls in flight without racing
// on the counters used by the sequential stubs above.
type unavailablePluginClientV3 struct {
	appclientv3.Client
	fail func(context.Context) error
}

func (c *unavailablePluginClientV3) AdmissionReview(ctx context.Context, _ *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	return nil, c.fail(ctx)
}

type unavailableLegacyPluginClient struct {
	plugins.Client
	fail func(context.Context) error
}

func (c *unavailableLegacyPluginClient) CallResource(ctx context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
	return c.fail(ctx)
}

func TestPluginBreakerGETDuringUnavailableClientFlood(t *testing.T) {
	tests := []struct {
		name        string
		clientError error
		newCall     func(func(context.Context) error) func(context.Context) error
	}{
		{
			name:        "v3 admission",
			clientError: status.Error(codes.Unavailable, "plugin is not running"),
			newCall: func(fail func(context.Context) error) func(context.Context) error {
				client := &breakerPluginClientV3{Client: &unavailablePluginClientV3{fail: fail}}
				return func(ctx context.Context) error {
					_, err := client.AdmissionReview(ctx, &pluginv3.AdmissionReviewRequest{})
					return err
				}
			},
		},
		{
			name:        "legacy resource",
			clientError: plugins.ErrPluginUnavailable,
			newCall: func(fail func(context.Context) error) func(context.Context) error {
				client := &breakerPluginClient{Client: &unavailableLegacyPluginClient{fail: fail}}
				return func(ctx context.Context) error {
					return client.CallResource(ctx, &backend.CallResourceRequest{}, backend.CallResourceResponseSenderFunc(func(*backend.CallResourceResponse) error { return nil }))
				}
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			const (
				group             = "test.ext.grafana.app"
				path              = "/apis/" + group + "/v1/namespaces/default/resources/saved"
				savedResource     = `{"metadata":{"name":"saved"},"spec":{"value":"stored"}}`
				writers           = 16
				readers           = 8
				requestsPerWorker = 64
			)
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			defer cancel()
			started := make(chan struct{}, writers)
			release := make(chan struct{})
			releaseCalls := sync.OnceFunc(func() { close(release) })
			defer releaseCalls()
			var clientCalls, storageReads atomic.Int32
			callPlugin := tt.newCall(func(ctx context.Context) error {
				clientCalls.Add(1)
				select {
				case started <- struct{}{}:
				default:
				}
				select {
				case <-release:
					return tt.clientError
				case <-ctx.Done():
					return ctx.Err()
				}
			})
			cb := newGroupBreaker(group)
			handler := &tracedPluginHandler{Handler: &pluginroute.Handler{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodGet {
					storageReads.Add(1)
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, savedResource)
					return
				}
				if err := callPlugin(r.Context()); err != nil {
					http.Error(w, err.Error(), http.StatusServiceUnavailable)
					return
				}
				w.WriteHeader(http.StatusCreated)
			})}}
			router := withGroupHandlerAndBreaker(group, handler, cb)
			request := func(method string) *httptest.ResponseRecorder {
				req := httptest.NewRequest(method, path, nil).WithContext(authenticatedTestContext(ctx))
				response := httptest.NewRecorder()
				router.HandleFunc(response, req, http.NotFoundHandler())
				return response
			}
			failures := make(chan *httptest.ResponseRecorder, writers)
			for i := 0; i < writers; i++ {
				go func() { failures <- request(http.MethodPost) }()
			}
			// Ensure the first GETs overlap actual client calls, rather than relying on
			// the scheduler to interleave two fast request loops.
			for i := 0; i < writers; i++ {
				select {
				case <-started:
				case <-ctx.Done():
					t.Fatal("plugin calls did not start before the deadline")
				}
			}
			for i := 0; i < requestsPerWorker; i++ {
				response := request(http.MethodGet)
				require.Equal(t, http.StatusOK, response.Code)
				require.Equal(t, savedResource, response.Body.String())
			}
			require.Equal(t, gobreaker.StateClosed, cb.State())
			releaseCalls()
			for i := 0; i < writers; i++ {
				select {
				case response := <-failures:
					require.Equal(t, http.StatusServiceUnavailable, response.Code)
				case <-ctx.Done():
					t.Fatal("plugin calls did not finish before the deadline")
				}
			}
			require.Equal(t, gobreaker.StateOpen, cb.State())
			callsBeforeFlood := clientCalls.Load()

			startFlood := make(chan struct{})
			var workers sync.WaitGroup
			for i := 0; i < writers+readers; i++ {
				method, wantStatus := http.MethodPost, http.StatusServiceUnavailable
				if i >= writers {
					method, wantStatus = http.MethodGet, http.StatusOK
				}
				workers.Add(1)
				go func() {
					defer workers.Done()
					<-startFlood
					for j := 0; j < requestsPerWorker; j++ {
						response := request(method)
						if response.Code != wantStatus {
							t.Errorf("%s returned %d, want %d: %s", method, response.Code, wantStatus, response.Body.String())
						}
						if method == http.MethodGet && response.Body.String() != savedResource {
							t.Errorf("GET returned unexpected resource: %s", response.Body.String())
						}
					}
				}()
			}
			close(startFlood)
			workers.Wait()
			require.Equal(t, int32((readers+1)*requestsPerWorker), storageReads.Load())
			require.Equal(t, callsBeforeFlood, clientCalls.Load(), "the open breaker must stop the flood from reaching the client")
			require.Equal(t, gobreaker.StateOpen, cb.State(), "storage reads must not reset the plugin breaker")
		})
	}
}

func (c *stubLegacyPluginClient) CheckHealth(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if c.panicValue != nil {
		panic(c.panicValue)
	}
	return &backend.CheckHealthResult{}, c.err
}

func TestPluginBreakerRejectionMetrics(t *testing.T) {
	for _, halfOpen := range []bool{false, true} {
		t.Run(fmt.Sprint("half-open=", halfOpen), func(t *testing.T) {
			const group = "test.ext.grafana.app"
			timeout := time.Hour
			if halfOpen {
				timeout = 20 * time.Millisecond
			}
			cb := gobreaker.NewTwoStepCircuitBreaker[struct{}](gobreaker.Settings{
				ReadyToTrip: func(gobreaker.Counts) bool { return true }, Timeout: timeout,
			})
			done, err := cb.Allow()
			require.NoError(t, err)
			done(plugins.ErrPluginUnavailable)
			if halfOpen {
				require.Eventually(t, func() bool { return cb.State() == gobreaker.StateHalfOpen }, time.Second, time.Millisecond)
				done, err = cb.Allow()
				require.NoError(t, err)
				defer done(nil)
			}
			raw := &stubPluginClientV3{}
			client := &breakerPluginClientV3{Client: raw}
			handler := &tracedPluginHandler{Handler: &pluginroute.Handler{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, err := client.AdmissionReview(r.Context(), &pluginv3.AdmissionReviewRequest{})
				require.True(t, apierrors.IsServiceUnavailable(err))
				w.WriteHeader(http.StatusServiceUnavailable)
			})}, pluginID: "test-app"}
			router := withGroupHandlerAndBreaker(group, handler, cb)
			metrics := newRouterMetrics(prometheus.NewRegistry())
			response := httptest.NewRecorder()
			metrics.instrument(router, response, newAuthenticatedRequest(http.MethodPost, "/apis/"+group+"/v1/things", nil), http.NotFoundHandler())
			require.Equal(t, http.StatusServiceUnavailable, response.Code)
			require.Equal(t, 1.0, testutil.ToFloat64(metrics.backendFailures.WithLabelValues(group, "test-app", failureBreakerOpen)))
			require.Zero(t, raw.calls)
			_, err = allowPluginCall(context.WithValue(withoutRequestOutcome(t.Context()), clientBreakerKey{}, cb))
			require.True(t, apierrors.IsServiceUnavailable(err))
		})
	}
}

func TestPluginPanicSettlesHalfOpenAttempt(t *testing.T) {
	panicValue := &struct{ message string }{"plugin panic"}
	for _, method := range []string{"admission", "conversion", "route", "receive", "health", "resource"} {
		t.Run(method, func(t *testing.T) {
			cb := gobreaker.NewTwoStepCircuitBreaker[struct{}](gobreaker.Settings{
				ReadyToTrip: func(gobreaker.Counts) bool { return true }, Timeout: 20 * time.Millisecond,
			})
			done, err := cb.Allow()
			require.NoError(t, err)
			done(plugins.ErrPluginUnavailable)
			require.Eventually(t, func() bool { return cb.State() == gobreaker.StateHalfOpen }, time.Second, time.Millisecond)
			ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
			raw := &stubPluginClientV3{panicValue: panicValue}
			client := &breakerPluginClientV3{Client: raw}
			legacy := &breakerPluginClient{Client: &stubLegacyPluginClient{panicValue: panicValue}}
			require.PanicsWithValue(t, panicValue, func() {
				switch method {
				case "admission":
					_, _ = client.AdmissionReview(ctx, &pluginv3.AdmissionReviewRequest{})
				case "conversion":
					_, _ = client.ConvertObjects(ctx, &pluginv3.ConvertObjectsRequest{})
				case "route":
					_, _ = client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
				case "receive":
					raw.panicValue = nil
					raw.stream = &stubPluginRouteStream{panicValue: panicValue}
					stream, err := client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
					require.NoError(t, err)
					_, _ = stream.Recv()
				case "health":
					_, _ = legacy.CheckHealth(ctx, &backend.CheckHealthRequest{})
				case "resource":
					_ = legacy.CallResource(ctx, &backend.CallResourceRequest{}, nil)
				}
			})
			require.Equal(t, gobreaker.StateOpen, cb.State(), "a panic must fail the trial instead of leaving it in flight")
			require.Eventually(t, func() bool { return cb.State() == gobreaker.StateHalfOpen }, time.Second, time.Millisecond)
			raw.panicValue = nil
			_, err = client.AdmissionReview(ctx, &pluginv3.AdmissionReviewRequest{})
			require.NoError(t, err)
			require.Equal(t, gobreaker.StateClosed, cb.State())
		})
	}
}

func TestPluginStreamPanicAfterFirstResponsePreservesOutcome(t *testing.T) {
	cb := newGroupBreaker("plugin")
	ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
	raw := &stubPluginRouteStream{}
	client := &breakerPluginClientV3{Client: &stubPluginClientV3{stream: raw}}
	stream, err := client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
	require.NoError(t, err)
	_, err = stream.Recv()
	require.NoError(t, err)
	before := cb.Counts()
	raw.panicValue = "stream panic"
	require.PanicsWithValue(t, raw.panicValue, func() { _, _ = stream.Recv() })
	require.Equal(t, before, cb.Counts())
	require.Equal(t, uint32(1), before.TotalSuccesses)
	require.Zero(t, before.TotalFailures)
}

func TestPluginStreamCancellationReleasesHalfOpenAttempt(t *testing.T) {
	cb := gobreaker.NewTwoStepCircuitBreaker[struct{}](gobreaker.Settings{
		ReadyToTrip: func(gobreaker.Counts) bool { return true },
		Timeout:     20 * time.Millisecond,
		IsExcluded:  func(err error) bool { return errors.Is(err, errCallerGone) },
	})
	done, err := cb.Allow()
	require.NoError(t, err)
	done(plugins.ErrPluginUnavailable)
	require.Eventually(t, func() bool { return cb.State() == gobreaker.StateHalfOpen }, time.Second, time.Millisecond)
	ctx := context.WithValue(t.Context(), clientBreakerKey{}, cb)
	trialCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	raw := &stubPluginRouteStream{}
	client := &breakerPluginClientV3{Client: &stubPluginClientV3{stream: raw}}
	abandoned, err := client.CallRoute(trialCtx, &pluginv3.CallRouteRequest{})
	require.NoError(t, err)
	_, err = client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
	require.True(t, apierrors.IsServiceUnavailable(err))
	cancel()
	require.Eventually(t, func() bool { return cb.Counts().TotalExclusions == 1 }, time.Second, time.Millisecond)
	require.Equal(t, gobreaker.StateHalfOpen, cb.State())
	require.Zero(t, cb.Counts().TotalFailures)
	require.Zero(t, cb.Counts().TotalSuccesses)
	retry, err := client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
	require.NoError(t, err)
	// A late result from the canceled stream must not settle the new trial.
	_, err = abandoned.Recv()
	require.NoError(t, err)
	require.Equal(t, gobreaker.StateHalfOpen, cb.State())
	_, err = retry.Recv()
	require.NoError(t, err)
	require.Equal(t, gobreaker.StateClosed, cb.State())
}
