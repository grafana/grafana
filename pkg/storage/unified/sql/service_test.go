package sql

import (
	"context"
	"net"
	"sync/atomic"
	"testing"

	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// mockSearchServer is a no-op implementation of resource.SearchServer for testing.
type mockSearchServer struct {
	resourcepb.UnimplementedResourceIndexServer
	resourcepb.UnimplementedManagedObjectIndexServer
	resourcepb.UnimplementedDiagnosticsServer
}

func (m *mockSearchServer) Init(context.Context) error { return nil }
func (m *mockSearchServer) Stop(context.Context) error { return nil }
func (m *mockSearchServer) IsHealthy(_ context.Context, _ *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
}

var _ resource.SearchServer = (*mockSearchServer)(nil)

// mockResourceServer is a no-op implementation of resource.ResourceServer for testing.
type mockResourceServer struct {
	mockSearchServer
	resourcepb.UnimplementedResourceStoreServer
	resourcepb.UnimplementedBulkStoreServer
	resourcepb.UnimplementedBlobStoreServer
	resourcepb.UnimplementedQuotasServer
}

var _ resource.ResourceServer = (*mockResourceServer)(nil)

// requireAuthPassed asserts the error is NOT codes.Unauthenticated, meaning
// the request got past the auth interceptor and reached the (unimplemented) handler.
func requireAuthPassed(t *testing.T, err error, msgAndArgs ...interface{}) {
	t.Helper()
	require.Error(t, err, "mock handler returns Unimplemented")
	assert.Equal(t, codes.Unimplemented, status.Code(err), msgAndArgs...)
}

// newDenyAllGRPCServer creates a gRPC server with a global "deny all" auth
// interceptor. Services must be registered on the returned server before
// calling startAndConnect.
func newDenyAllGRPCServer(t *testing.T) *grpc.Server {
	t.Helper()
	denyAll := func(context.Context) (context.Context, error) {
		return nil, status.Error(codes.Unauthenticated, "denied by global auth")
	}
	return grpc.NewServer(
		grpc.ChainUnaryInterceptor(grpcAuth.UnaryServerInterceptor(denyAll)),
		grpc.ChainStreamInterceptor(grpcAuth.StreamServerInterceptor(denyAll)),
	)
}

// startAndConnect starts the gRPC server and returns a client connection.
func startAndConnect(t *testing.T, srv *grpc.Server) *grpc.ClientConn {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.GracefulStop)

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

// TestRegisterSearchServerWithAuth verifies that registerSearchServer wraps
// all registered services (ResourceIndex, ManagedObjectIndex, Diagnostics)
// with per-service auth that overrides the global auth interceptor.
func TestRegisterSearchServerWithAuth(t *testing.T) {
	var authCalled atomic.Int32
	testAuth := interceptors.AuthenticatorFunc(func(ctx context.Context) (context.Context, error) {
		authCalled.Add(1)
		return ctx, nil
	})

	s := &service{authenticator: testAuth}
	srv := newDenyAllGRPCServer(t)

	err := s.registerSearchServer(srv, &mockSearchServer{})
	require.NoError(t, err)

	conn := startAndConnect(t, srv)
	ctx := context.Background()

	t.Run("ResourceIndex/Search", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewResourceIndexClient(conn)
		_, err := client.Search(ctx, &resourcepb.ResourceSearchRequest{})
		requireAuthPassed(t, err, "Search should pass per-service auth, not be blocked by global deny-all")
		require.Greater(t, authCalled.Load(), int32(0), "authenticator should have been called")
	})

	t.Run("ResourceIndex/GetStats", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewResourceIndexClient(conn)
		_, err := client.GetStats(ctx, &resourcepb.ResourceStatsRequest{})
		requireAuthPassed(t, err, "GetStats should pass per-service auth")
		require.Greater(t, authCalled.Load(), int32(0))
	})

	t.Run("ManagedObjectIndex/CountManagedObjects", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewManagedObjectIndexClient(conn)
		_, err := client.CountManagedObjects(ctx, &resourcepb.CountManagedObjectsRequest{})
		requireAuthPassed(t, err, "CountManagedObjects should pass per-service auth")
		require.Greater(t, authCalled.Load(), int32(0))
	})

	t.Run("Diagnostics/IsHealthy", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewDiagnosticsClient(conn)
		resp, err := client.IsHealthy(ctx, &resourcepb.HealthCheckRequest{})
		require.NoError(t, err, "IsHealthy should pass per-service auth")
		require.Equal(t, resourcepb.HealthCheckResponse_SERVING, resp.Status)
		require.Greater(t, authCalled.Load(), int32(0))
	})
}

// TestRegisterUnifiedResourceServerWithAuth verifies that registerUnifiedResourceServer
// wraps all registered services (ResourceStore, BulkStore, BlobStore, Quotas,
// ResourceIndex, ManagedObjectIndex, Diagnostics) with per-service auth.
func TestRegisterUnifiedResourceServerWithAuth(t *testing.T) {
	var authCalled atomic.Int32
	testAuth := interceptors.AuthenticatorFunc(func(ctx context.Context) (context.Context, error) {
		authCalled.Add(1)
		return ctx, nil
	})

	s := &service{authenticator: testAuth}
	srv := newDenyAllGRPCServer(t)

	err := s.registerUnifiedResourceServer(srv, &mockResourceServer{})
	require.NoError(t, err)

	conn := startAndConnect(t, srv)
	ctx := context.Background()

	t.Run("ResourceStore/Read", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewResourceStoreClient(conn)
		_, err := client.Read(ctx, &resourcepb.ReadRequest{})
		requireAuthPassed(t, err, "Read should pass per-service auth")
		require.Greater(t, authCalled.Load(), int32(0))
	})

	t.Run("BlobStore/PutBlob", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewBlobStoreClient(conn)
		_, err := client.PutBlob(ctx, &resourcepb.PutBlobRequest{})
		requireAuthPassed(t, err, "PutBlob should pass per-service auth")
		require.Greater(t, authCalled.Load(), int32(0))
	})

	t.Run("ResourceIndex/Search", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewResourceIndexClient(conn)
		_, err := client.Search(ctx, &resourcepb.ResourceSearchRequest{})
		requireAuthPassed(t, err, "Search should pass per-service auth")
		require.Greater(t, authCalled.Load(), int32(0))
	})

	t.Run("ManagedObjectIndex/CountManagedObjects", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewManagedObjectIndexClient(conn)
		_, err := client.CountManagedObjects(ctx, &resourcepb.CountManagedObjectsRequest{})
		requireAuthPassed(t, err, "CountManagedObjects should pass per-service auth")
		require.Greater(t, authCalled.Load(), int32(0))
	})

	t.Run("Diagnostics/IsHealthy", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewDiagnosticsClient(conn)
		resp, err := client.IsHealthy(ctx, &resourcepb.HealthCheckRequest{})
		require.NoError(t, err, "IsHealthy should pass per-service auth")
		require.Equal(t, resourcepb.HealthCheckResponse_SERVING, resp.Status)
		require.Greater(t, authCalled.Load(), int32(0))
	})
}
