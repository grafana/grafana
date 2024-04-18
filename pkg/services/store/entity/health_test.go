package entity

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func TestHealthCheck(t *testing.T) {
	t.Run("will return healthy when store is initialized", func(t *testing.T) {
		stub := &entityStoreStub{initialized: true}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		res, err := svc.Check(context.Background(), req)

		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, res.Status)
	})

	t.Run("will return unhealthy when store is not initialized", func(t *testing.T) {
		stub := &entityStoreStub{initialized: false}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		res, err := svc.Check(context.Background(), req)

		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, res.Status)
	})
}

func TestHealthWatch(t *testing.T) {
	t.Run("will return healthy when store is initialized", func(t *testing.T) {
		stub := &entityStoreStub{initialized: true}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		stream := &fakeHealthWatchServer{}
		err = svc.Watch(req, stream)

		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_SERVING, stream.status)
	})

	t.Run("will return unhealthy when store is not initialized", func(t *testing.T) {
		stub := &entityStoreStub{initialized: false}
		svc, err := ProvideHealthService(stub)
		require.NoError(t, err)

		req := &grpc_health_v1.HealthCheckRequest{}
		stream := &fakeHealthWatchServer{}
		err = svc.Watch(req, stream)

		require.NoError(t, err)
		assert.Equal(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, stream.status)
	})
}

var _ InitializableEntityServer = &entityStoreStub{}

type entityStoreStub struct {
	initialized bool
}

func (s *entityStoreStub) Init() error {
	if s.initialized {
		return nil
	}
	return errors.New("init error")
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
	grpc.ServerStream
	status grpc_health_v1.HealthCheckResponse_ServingStatus
}

func (f *fakeHealthWatchServer) Send(resp *grpc_health_v1.HealthCheckResponse) error {
	f.status = resp.Status
	return nil
}

func (f *fakeHealthWatchServer) RecvMsg(m interface{}) error {
	return errors.New("not implemented")
}

func (f *fakeHealthWatchServer) SendMsg(m interface{}) error {
	return errors.New("not implemented")
}
