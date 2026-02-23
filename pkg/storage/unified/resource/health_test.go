package resource

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestHealthCheck(t *testing.T) {
	t.Run("will return serving response when healthy", func(t *testing.T) {
		stub := &diag{healthResponse: resourcepb.HealthCheckResponse_SERVING}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		res, err := svc.Check(context.Background(), req)

		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Status)
	})

	t.Run("will return not serving response when not healthy", func(t *testing.T) {
		stub := &diag{healthResponse: resourcepb.HealthCheckResponse_NOT_SERVING}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		res, err := svc.Check(context.Background(), req)

		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Status)
	})
}

func TestHealthWatch(t *testing.T) {
	t.Run("watch will return message when called", func(t *testing.T) {
		stub := &diag{healthResponse: resourcepb.HealthCheckResponse_SERVING}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		stream := &fakeHealthWatchServer{}
		go func() {
			err := svc.Watch(req, stream)
			require.NoError(t, err)
		}()

		time.Sleep(100 * time.Millisecond)
		err = stream.RecvMsg(nil)
		require.NoError(t, err)
	})

	t.Run("watch will return error when context cancelled", func(t *testing.T) {
		stub := &diag{healthResponse: resourcepb.HealthCheckResponse_NOT_SERVING}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		stream := &fakeHealthWatchServer{context: ctx}
		err = svc.Watch(req, stream)

		require.Error(t, err)
	})
}

var _ resourcepb.DiagnosticsServer = &diag{}

type diag struct {
	healthResponse resourcepb.HealthCheckResponse_ServingStatus
	error          error
}

func (s *diag) IsHealthy(ctx context.Context, req *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	if s.error != nil {
		return nil, s.error
	}

	return &resourcepb.HealthCheckResponse{Status: s.healthResponse}, nil
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
