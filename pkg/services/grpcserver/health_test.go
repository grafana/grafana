package grpcserver

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"
)

func newTestHealthService(t *testing.T) *HealthService {
	t.Helper()
	srv := grpc.NewServer()
	t.Cleanup(srv.Stop)
	svc := newHealthService()
	svc.logger = log.NewNopLogger()
	grpc_health_v1.RegisterHealthServer(srv, svc)
	return svc
}

func TestHealthCheck(t *testing.T) {
	t.Run("returns SERVING initially", func(t *testing.T) {
		svc := newTestHealthService(t)
		res, err := svc.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Status)
	})

	t.Run("returns NOT_SERVING with empty service", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		res, err := svc.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Status)
	})

	t.Run("returns SERVING when all services are serving", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)
		svc.SetServingStatus("search", grpc_health_v1.HealthCheckResponse_SERVING)

		res, err := svc.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Status)
	})

	t.Run("returns NOT_SERVING if any service is not serving", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)
		svc.SetServingStatus("search", grpc_health_v1.HealthCheckResponse_NOT_SERVING)

		res, err := svc.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Status)
	})

	t.Run("returns individual service status", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)

		res, err := svc.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{Service: "storage"})
		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Status)
	})

	t.Run("returns NOT_FOUND for unknown service", func(t *testing.T) {
		svc := newTestHealthService(t)
		_, err := svc.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{Service: "unknown"})
		require.Error(t, err)
		assert.Equal(t, codes.NotFound, status.Code(err))
	})
}

func TestHealthWatch(t *testing.T) {
	t.Run("sends initial status on connect", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		stream := newFakeHealthWatchServer(ctx)
		go func() {
			_ = svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		}()

		stream.waitForSends(t, 1)
		stream.mu.Lock()
		require.Len(t, stream.healthChecks, 1)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, stream.healthChecks[0].Status)
		stream.mu.Unlock()
	})

	t.Run("immediately notifies on status change", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		stream := newFakeHealthWatchServer(ctx)
		go func() {
			_ = svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		}()

		stream.waitForSends(t, 1)

		// Push NOT_SERVING — Watch should be notified immediately
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		stream.waitForSends(t, 2)

		stream.mu.Lock()
		defer stream.mu.Unlock()
		require.Len(t, stream.healthChecks, 2)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, stream.healthChecks[0].Status)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, stream.healthChecks[1].Status)
	})

	t.Run("returns error when context cancelled", func(t *testing.T) {
		svc := newTestHealthService(t)

		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer cancel()
		stream := newFakeHealthWatchServer(ctx)
		err := svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		require.Error(t, err)
	})

	t.Run("sends NOT_SERVING on shutdown", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		stream := newFakeHealthWatchServer(ctx)
		go func() {
			_ = svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		}()

		stream.waitForSends(t, 1)

		// Shutdown sets all services to NOT_SERVING and notifies watchers
		svc.Shutdown()
		stream.waitForSends(t, 2)

		stream.mu.Lock()
		defer stream.mu.Unlock()
		require.GreaterOrEqual(t, len(stream.healthChecks), 2)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, stream.healthChecks[len(stream.healthChecks)-1].Status)
	})
}

func TestHealthList(t *testing.T) {
	svc := newTestHealthService(t)
	svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)
	svc.SetServingStatus("search", grpc_health_v1.HealthCheckResponse_NOT_SERVING)

	res, err := svc.List(context.Background(), &grpc_health_v1.HealthListRequest{})
	require.NoError(t, err)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Statuses["storage"].Status)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Statuses["search"].Status)
}

type fakeHealthWatchServer struct {
	mu sync.Mutex
	grpc.ServerStream
	healthChecks []*grpc_health_v1.HealthCheckResponse
	context      context.Context
	sent         chan struct{} // signalled on each Send
}

func newFakeHealthWatchServer(ctx context.Context) *fakeHealthWatchServer {
	return &fakeHealthWatchServer{
		context: ctx,
		sent:    make(chan struct{}, 16),
	}
}

func (f *fakeHealthWatchServer) Send(resp *grpc_health_v1.HealthCheckResponse) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.healthChecks = append(f.healthChecks, resp)
	select {
	case f.sent <- struct{}{}:
	default:
	}
	return nil
}

// waitForSends blocks until at least n total sends have occurred.
func (f *fakeHealthWatchServer) waitForSends(t *testing.T, n int) {
	t.Helper()
	for {
		f.mu.Lock()
		count := len(f.healthChecks)
		f.mu.Unlock()
		if count >= n {
			return
		}
		select {
		case <-f.sent:
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for %d sends (got %d)", n, count)
		}
	}
}

func (f *fakeHealthWatchServer) RecvMsg(m interface{}) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.healthChecks) == 0 {
		return errors.New("no health checks received")
	}
	f.healthChecks = f.healthChecks[1:]
	return nil
}

func (f *fakeHealthWatchServer) SendMsg(m interface{}) error {
	return errors.New("not implemented")
}

func (f *fakeHealthWatchServer) Context() context.Context {
	if f.context == nil {
		f.context = context.Background()
	}
	return f.context
}

type fakeNamedService struct {
	*services.BasicService
}

func newFakeNamedService(name string) *fakeNamedService {
	s := &fakeNamedService{}
	s.BasicService = services.NewIdleService(nil, nil).WithName(name)
	return s
}

// fakeHealthProbeService is a dskit service that also implements HealthProbe.
type fakeHealthProbeService struct {
	*services.BasicService
	healthy atomic.Bool
}

func newFakeHealthProbeService(name string, healthy bool) *fakeHealthProbeService {
	s := &fakeHealthProbeService{}
	s.healthy.Store(healthy)
	s.BasicService = services.NewIdleService(nil, nil).WithName(name)
	return s
}

func (f *fakeHealthProbeService) CheckHealth(_ context.Context) bool {
	return f.healthy.Load()
}

func TestHealthService_AddHealthListenerInitialStatusAndNoProbeService(t *testing.T) {
	hs := newTestHealthService(t)
	svc := newFakeNamedService("no-probe-svc")

	hs.AddHealthListener(svc)

	ctx := context.Background()
	res, err := hs.Check(ctx, &grpc_health_v1.HealthCheckRequest{Service: "no-probe-svc"})
	require.NoError(t, err)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Status)

	require.NoError(t, svc.StartAsync(ctx))
	require.NoError(t, svc.AwaitRunning(ctx))
	defer svc.StopAsync()

	require.Eventually(t, func() bool {
		res, err = hs.Check(ctx, &grpc_health_v1.HealthCheckRequest{Service: "no-probe-svc"})
		return err == nil && res.Status == grpc_health_v1.HealthCheckResponse_SERVING
	}, 2*time.Second, 50*time.Millisecond)
}

func TestHealthService_StateChangeUpdatesStatus(t *testing.T) {
	hs := newTestHealthService(t)
	svc := newFakeHealthProbeService("test-svc", true)

	hs.AddHealthListener(svc)

	ctx := context.Background()
	mgr, err := services.NewManager(svc)
	require.NoError(t, err)
	mgr.AddListener(hs)
	require.NoError(t, mgr.StartAsync(ctx))
	require.NoError(t, mgr.AwaitHealthy(ctx))

	// The Running callback should have called CheckHealth (true) -> SERVING.
	// Listener notifications are asynchronous, so poll until the status updates.
	var res *grpc_health_v1.HealthCheckResponse

	require.NoError(t, mgr.AwaitHealthy(ctx))

	require.Eventually(t, func() bool {
		var err error
		res, err = hs.Check(ctx, &grpc_health_v1.HealthCheckRequest{Service: "test-svc"})
		return err == nil && res.Status == grpc_health_v1.HealthCheckResponse_SERVING
	}, 2*time.Second, 50*time.Millisecond)

	// Stop -> NOT_SERVING.
	mgr.StopAsync()
	require.NoError(t, mgr.AwaitStopped(ctx))

	// Listener notifications are asynchronous, so poll until the status updates.
	require.Eventually(t, func() bool {
		var err error
		res, err = hs.Check(ctx, &grpc_health_v1.HealthCheckRequest{Service: "test-svc"})
		return err == nil && res.Status == grpc_health_v1.HealthCheckResponse_NOT_SERVING
	}, 2*time.Second, 50*time.Millisecond)
}

func TestHealthService_PollUpdatesStatus(t *testing.T) {
	hs := newTestHealthService(t)
	svc := newFakeHealthProbeService("poll-svc", true)
	hs.AddHealthListener(svc)

	ctx := context.Background()
	require.NoError(t, svc.StartAsync(ctx))
	require.NoError(t, svc.AwaitRunning(ctx))
	defer svc.StopAsync()

	hs.pollServices(ctx)
	res, err := hs.Check(ctx, &grpc_health_v1.HealthCheckRequest{Service: "poll-svc"})
	require.NoError(t, err)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Status)

	svc.healthy.Store(false)
	hs.pollServices(ctx)
	res, err = hs.Check(ctx, &grpc_health_v1.HealthCheckRequest{Service: "poll-svc"})
	require.NoError(t, err)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Status)
}

func TestHealthService_StoppedCallsShutdown(t *testing.T) {
	hs := newTestHealthService(t)
	hs.SetServingStatus("some-svc", grpc_health_v1.HealthCheckResponse_SERVING)

	hs.Stopped()

	res, err := hs.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{Service: "some-svc"})
	require.NoError(t, err)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Status)
}

func TestHealthService_FailureStopsServing(t *testing.T) {
	hs := newTestHealthService(t)
	registered := newFakeHealthProbeService("registered-svc", true)
	hs.AddHealthListener(registered)

	ctx := context.Background()
	require.NoError(t, registered.StartAsync(ctx))
	require.NoError(t, registered.AwaitRunning(ctx))
	defer registered.StopAsync()

	hs.pollServices(ctx)
	res, err := hs.Check(ctx, &grpc_health_v1.HealthCheckRequest{Service: "registered-svc"})
	require.NoError(t, err)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Status)

	// Failure with registered service should mark it NOT_SERVING.
	hs.Failure(registered)
	res, err = hs.Check(ctx, &grpc_health_v1.HealthCheckRequest{Service: "registered-svc"})
	require.NoError(t, err)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Status)
}
