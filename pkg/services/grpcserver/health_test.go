package grpcserver

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

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
	serving := grpc_health_v1.HealthCheckResponse_SERVING
	notServing := grpc_health_v1.HealthCheckResponse_NOT_SERVING

	tests := []struct {
		name     string
		setup    func(*HealthService)
		query    string // service name to query ("" = aggregate)
		wantCode codes.Code
		want     grpc_health_v1.HealthCheckResponse_ServingStatus
	}{
		{
			name:  "SERVING initially",
			setup: func(_ *HealthService) {},
			want:  serving,
		},
		{
			name:  "NOT_SERVING with empty service set",
			setup: func(s *HealthService) { s.setServingStatus("", notServing) },
			want:  notServing,
		},
		{
			name: "SERVING when all services serving",
			setup: func(s *HealthService) {
				s.setServingStatus("storage", serving)
				s.setServingStatus("search", serving)
			},
			want: serving,
		},
		{
			name: "NOT_SERVING if any service not serving",
			setup: func(s *HealthService) {
				s.setServingStatus("storage", serving)
				s.setServingStatus("search", notServing)
			},
			want: notServing,
		},
		{
			name: "SERVING for individual service while not serving overall",
			setup: func(s *HealthService) {
				s.setServingStatus("storage", serving)
				s.setServingStatus("search", notServing)
			},
			query: "storage",
			want:  serving,
		},
		{
			name:  "individual service status",
			setup: func(s *HealthService) { s.setServingStatus("storage", serving) },
			query: "storage",
			want:  serving,
		},
		{
			name:     "NOT_FOUND for unknown service",
			setup:    func(_ *HealthService) {},
			query:    "unknown",
			wantCode: codes.NotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := newTestHealthService(t)
			tt.setup(svc)
			res, err := svc.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{Service: tt.query})
			if tt.wantCode != codes.OK {
				require.Error(t, err)
				assert.Equal(t, tt.wantCode, status.Code(err))
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, res.Status)
		})
	}
}

func TestHealthWatch(t *testing.T) {
	t.Run("sends initial status on connect", func(t *testing.T) {
		svc := newTestHealthService(t)
		svc.setServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)

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
		svc.setServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		stream := newFakeHealthWatchServer(ctx)
		go func() {
			_ = svc.Watch(&grpc_health_v1.HealthCheckRequest{}, stream)
		}()

		stream.waitForSends(t, 1)

		// Push NOT_SERVING — Watch should be notified immediately
		svc.setServingStatus("storage", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
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
		svc.setServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)

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
	svc.setServingStatus("storage", grpc_health_v1.HealthCheckResponse_SERVING)
	svc.setServingStatus("search", grpc_health_v1.HealthCheckResponse_NOT_SERVING)

	res, err := svc.List(context.Background(), &grpc_health_v1.HealthListRequest{})
	require.NoError(t, err)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Statuses["storage"].Status)
	assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Statuses["search"].Status)
}

// requireStatus is a test helper that checks the serving status for a service.
func requireStatus(t *testing.T, hs *HealthService, service string, want grpc_health_v1.HealthCheckResponse_ServingStatus) {
	t.Helper()
	res, err := hs.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{Service: service})
	require.NoError(t, err)
	assert.Equal(t, want, res.Status, "service %q", service)
}

func TestHealthService_Probes(t *testing.T) {
	serving := grpc_health_v1.HealthCheckResponse_SERVING
	notServing := grpc_health_v1.HealthCheckResponse_NOT_SERVING

	t.Run("register sets initial NOT_SERVING", func(t *testing.T) {
		hs := newTestHealthService(t)
		hs.Register(HealthProbeFunc(func(context.Context) (bool, error) { return true, nil }), "svc-a", "svc-b")

		requireStatus(t, hs, "svc-a", notServing)
		requireStatus(t, hs, "svc-b", notServing)
		requireStatus(t, hs, "", notServing)
	})

	t.Run("poll updates all services for probe", func(t *testing.T) {
		hs := newTestHealthService(t)
		var healthy atomic.Bool
		healthy.Store(true)
		hs.Register(HealthProbeFunc(func(context.Context) (bool, error) { return healthy.Load(), nil }), "svc-a", "svc-b")

		hs.checkAll()
		requireStatus(t, hs, "svc-a", serving)
		requireStatus(t, hs, "svc-b", serving)

		healthy.Store(false)
		hs.checkAll()
		requireStatus(t, hs, "svc-a", notServing)
		requireStatus(t, hs, "svc-b", notServing)
	})

	t.Run("probe error sets NOT_SERVING", func(t *testing.T) {
		hs := newTestHealthService(t)
		hs.Register(HealthProbeFunc(func(context.Context) (bool, error) { return false, fmt.Errorf("down") }), "svc-a")

		hs.checkAll()
		requireStatus(t, hs, "svc-a", notServing)
	})

	t.Run("probe called once per poll", func(t *testing.T) {
		hs := newTestHealthService(t)
		var calls atomic.Int32
		hs.Register(HealthProbeFunc(func(context.Context) (bool, error) { calls.Add(1); return true, nil }), "svc-a", "svc-b", "svc-c")

		hs.checkAll()
		assert.Equal(t, int32(1), calls.Load())
	})

	t.Run("multiple probes aggregate status", func(t *testing.T) {
		hs := newTestHealthService(t)
		probeA := HealthProbeFunc(func(context.Context) (bool, error) { return true, nil })
		probeB := HealthProbeFunc(func(context.Context) (bool, error) { return false, fmt.Errorf("unhealthy") })
		hs.Register(probeA, "svc-a", "svc-b")
		hs.Register(probeB, "svc-b")

		hs.checkAll()

		// svc-a healthy, svc-b unhealthy — aggregate must be NOT_SERVING.
		requireStatus(t, hs, "svc-a", serving)
		requireStatus(t, hs, "svc-b", notServing)
		requireStatus(t, hs, "", notServing)
	})

	t.Run("Starts poll loop", func(t *testing.T) {
		hs := newTestHealthService(t)
		hs.Register(HealthProbeFunc(func(context.Context) (bool, error) { return true, nil }), "svc-a")
		hs.start()
		defer hs.Shutdown()
		// Poll loop runs on a 1s ticker at startup; wait for first tick.
		require.Eventually(t, func() bool {
			res, err := hs.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{Service: "svc-a"})
			return err == nil && res.Status == serving
		}, 3*time.Second, 100*time.Millisecond)
	})
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
