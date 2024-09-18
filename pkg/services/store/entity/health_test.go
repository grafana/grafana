package entity

import (
	"context"
	"errors"
	sync "sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func TestHealthCheck(t *testing.T) {
	t.Run("will return serving response when healthy", func(t *testing.T) {
		stub := &entityStoreStub{healthResponse: HealthCheckResponse_SERVING}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		res, err := svc.Check(context.Background(), req)

		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Status)
	})

	t.Run("will return not serving response when not healthy", func(t *testing.T) {
		stub := &entityStoreStub{healthResponse: HealthCheckResponse_NOT_SERVING}
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
		stub := &entityStoreStub{healthResponse: HealthCheckResponse_SERVING}
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
		stub := &entityStoreStub{healthResponse: HealthCheckResponse_NOT_SERVING}
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

var _ EntityStoreServer = &entityStoreStub{}

type entityStoreStub struct {
	healthResponse HealthCheckResponse_ServingStatus
	error          error
}

func (s *entityStoreStub) IsHealthy(ctx context.Context, req *HealthCheckRequest) (*HealthCheckResponse, error) {
	if s.error != nil {
		return nil, s.error
	}

	return &HealthCheckResponse{Status: s.healthResponse}, nil
}

// Implement the EntityStoreServer methods
func (s *entityStoreStub) Create(ctx context.Context, r *CreateEntityRequest) (*CreateEntityResponse, error) {
	return nil, nil
}

func (s *entityStoreStub) Update(ctx context.Context, r *UpdateEntityRequest) (*UpdateEntityResponse, error) {
	return nil, nil
}

func (s *entityStoreStub) Read(ctx context.Context, r *ReadEntityRequest) (*Entity, error) {
	return nil, nil
}

func (s *entityStoreStub) Delete(ctx context.Context, r *DeleteEntityRequest) (*DeleteEntityResponse, error) {
	return nil, nil
}

func (s *entityStoreStub) History(ctx context.Context, r *EntityHistoryRequest) (*EntityHistoryResponse, error) {
	return nil, nil
}

func (s *entityStoreStub) List(ctx context.Context, r *EntityListRequest) (*EntityListResponse, error) {
	return nil, nil
}

func (s *entityStoreStub) Watch(EntityStore_WatchServer) error {
	return nil
}

func (s *entityStoreStub) FindReferences(ctx context.Context, r *ReferenceRequest) (*EntityListResponse, error) {
	return nil, nil
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
