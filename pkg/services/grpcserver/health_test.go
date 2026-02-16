package grpcserver

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"
)

type fakeProvider struct {
	server *grpc.Server
}

func (f *fakeProvider) Run(_ context.Context) error { return nil }
func (f *fakeProvider) IsDisabled() bool            { return false }
func (f *fakeProvider) GetServer() *grpc.Server     { return f.server }
func (f *fakeProvider) GetAddress() string          { return "" }

func newTestHealthService(t *testing.T, opts ...Option) *HealthService {
	t.Helper()
	svc, err := ProvideHealthServiceWithOpts(&fakeProvider{server: grpc.NewServer()}, opts...)
	require.NoError(t, err)
	return svc
}

func TestHealthCheck(t *testing.T) {
	t.Run("returns NOT_SERVING with WithInitialStatuses", func(t *testing.T) {
		svc := newTestHealthService(t, WithInitialStatuses(
			map[string]grpc_health_v1.HealthCheckResponse_ServingStatus{"": grpc_health_v1.HealthCheckResponse_NOT_SERVING},
		))
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
		stream := &fakeHealthWatchServer{context: ctx}
		go func() {
			_ = svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		}()

		time.Sleep(50 * time.Millisecond)
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
		stream := &fakeHealthWatchServer{context: ctx}
		go func() {
			_ = svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		}()

		time.Sleep(50 * time.Millisecond)

		// Push NOT_SERVING — Watch should be notified immediately
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		time.Sleep(50 * time.Millisecond)

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
		stream := &fakeHealthWatchServer{context: ctx}
		err := svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		require.Error(t, err)
	})

	t.Run("sends NOT_SERVING on shutdown", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.SetServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		stream := &fakeHealthWatchServer{context: ctx}
		go func() {
			_ = svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		}()

		time.Sleep(50 * time.Millisecond)

		// Shutdown sets all services to NOT_SERVING and notifies watchers
		svc.Shutdown()
		time.Sleep(50 * time.Millisecond)

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
}

func (f *fakeHealthWatchServer) Send(resp *grpc_health_v1.HealthCheckResponse) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.healthChecks = append(f.healthChecks, resp)
	return nil
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
