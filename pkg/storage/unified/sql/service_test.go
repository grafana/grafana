package sql

import (
	"context"
	"net"
	"sync/atomic"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
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
	resourcepb.UnimplementedResourceStatsServer
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

// newDenyAllProvider creates a grpcserver.Provider with a global "deny all"
// authenticator. Services must be registered on the returned server before
// calling startAndConnect.
func newDenyAllProvider(t *testing.T) grpcserver.Provider {
	t.Helper()
	denyAll := interceptors.AuthenticatorFunc(func(context.Context) (context.Context, error) {
		return nil, status.Error(codes.Unauthenticated, "denied by global auth")
	})
	cfg := setting.NewCfg()
	cfg.GRPCServer.Enabled = true
	provider, err := grpcserver.ProvideService(
		cfg,
		denyAll,
		noop.NewTracerProvider().Tracer(""),
		prometheus.NewRegistry(),
	)
	require.NoError(t, err)
	return provider
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
	provider := newDenyAllProvider(t)

	err := s.registerSearchServer(provider, &mockSearchServer{})
	require.NoError(t, err)

	conn := startAndConnect(t, provider.GetServer())
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
		client := resourcepb.NewDiagnosticsClient(conn)                      //nolint:staticcheck
		resp, err := client.IsHealthy(ctx, &resourcepb.HealthCheckRequest{}) //nolint:staticcheck
		require.NoError(t, err, "IsHealthy should pass per-service auth")
		require.Equal(t, resourcepb.HealthCheckResponse_SERVING, resp.Status)
		require.Greater(t, authCalled.Load(), int32(0))
	})
}

// TestRegisterUnifiedResourceServerWithAuth verifies that registerUnifiedResourceServer
// wraps all registered services (ResourceStore, ResourceStats, BulkStore, BlobStore,
// Quotas, ResourceIndex, ManagedObjectIndex, Diagnostics) with per-service auth.
func TestRegisterUnifiedResourceServerWithAuth(t *testing.T) {
	var authCalled atomic.Int32
	testAuth := interceptors.AuthenticatorFunc(func(ctx context.Context) (context.Context, error) {
		authCalled.Add(1)
		return ctx, nil
	})

	s := &service{authenticator: testAuth}
	provider := newDenyAllProvider(t)

	s.registerUnifiedResourceServer(provider, &mockResourceServer{})

	conn := startAndConnect(t, provider.GetServer())
	ctx := context.Background()

	t.Run("ResourceStore/Read", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewResourceStoreClient(conn)
		_, err := client.Read(ctx, &resourcepb.ReadRequest{})
		requireAuthPassed(t, err, "Read should pass per-service auth")
		require.Greater(t, authCalled.Load(), int32(0))
	})

	t.Run("ResourceStats/RecordEvent", func(t *testing.T) {
		authCalled.Store(0)
		client := resourcepb.NewResourceStatsClient(conn)
		_, err := client.RecordEvent(ctx, &resourcepb.RecordEventRequest{})
		requireAuthPassed(t, err, "RecordEvent should pass per-service auth")
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
		client := resourcepb.NewDiagnosticsClient(conn)                      //nolint:staticcheck
		resp, err := client.IsHealthy(ctx, &resourcepb.HealthCheckRequest{}) //nolint:staticcheck
		require.NoError(t, err, "IsHealthy should pass per-service auth")
		require.Equal(t, resourcepb.HealthCheckResponse_SERVING, resp.Status)
		require.Greater(t, authCalled.Load(), int32(0))
	})
}

func TestNewGrpcAuthenticator(t *testing.T) {
	tracer := noop.NewTracerProvider().Tracer("")

	// Mint a token using the same in-proc exchanger that clients use for local
	// multi-process dev. This is what NewAuthnGrpcClientInterceptor sends when
	// TokenExchangeURL is empty.
	tokenResp, err := resource.ProvideInProcExchanger().Exchange(context.Background(), authnlib.TokenExchangeRequest{
		Namespace: "*",
		Audiences: []string{"resourceStore"},
	})
	require.NoError(t, err)

	// authlib reads the access token from this metadata key on inbound calls.
	ctxWithToken := metadata.NewIncomingContext(
		context.Background(),
		metadata.Pairs("X-Access-Token", tokenResp.Token),
	)

	t.Run("unsafe=true in dev accepts in-proc token", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.Env = setting.Dev
		cfg.Raw.Section("grpc_server_authentication").Key("unsafe").SetValue("true")

		authn := newGrpcAuthenticator(cfg, tracer)
		gotCtx, err := authn(ctxWithToken)
		require.NoError(t, err)
		require.NotNil(t, gotCtx)
	})

	t.Run("unsafe=true outside dev does not enable unsafe authenticator", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.Env = "production"
		cfg.Raw.Section("grpc_server_authentication").Key("unsafe").SetValue("true")

		authn := newGrpcAuthenticator(cfg, tracer)
		_, err := authn(ctxWithToken)
		require.Error(t, err, "unsafe must not bypass real auth outside dev mode")
	})

	t.Run("unsafe=false rejects token with no signing keys configured", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.Env = setting.Dev

		authn := newGrpcAuthenticator(cfg, tracer)
		_, err := authn(ctxWithToken)
		require.Error(t, err)
	})
}

// nonKVBackend embeds StorageBackend (a nil interface) so it satisfies
// StorageBackend at compile time without implementing KVBackend. Used to
// exercise the "backend doesn't expose KV / lease manager" branch.
type nonKVBackend struct {
	resource.StorageBackend
}

// stubKVBackend embeds KVBackend (a nil interface) so unrelated methods
// are forwarded to the nil interface but never called. KV() and
// LeaseManager() return the values the test wires in.
type stubKVBackend struct {
	resource.KVBackend
	kv  resource.KV
	mgr *lease.Manager
}

func (s *stubKVBackend) KV() resource.KV              { return s.kv }
func (s *stubKVBackend) LeaseManager() *lease.Manager { return s.mgr }

func TestBuildKVSnapshotStore(t *testing.T) {
	logger := log.NewNopLogger()

	t.Run("rejects when index_snapshot_bucket_url is also set", func(t *testing.T) {
		cfg := &setting.Cfg{
			IndexSnapshotBucketURL: "file:///tmp/snapshot",
			EnableKVLeases:         true,
		}
		_, err := BuildKVSnapshotStore(cfg, &stubKVBackend{}, logger)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "mutually exclusive")
	})

	t.Run("rejects when enable_kv_leases is off", func(t *testing.T) {
		cfg := &setting.Cfg{}
		_, err := BuildKVSnapshotStore(cfg, &stubKVBackend{}, logger)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "requires enable_kv_leases")
	})

	t.Run("rejects when backend is not a KVBackend", func(t *testing.T) {
		cfg := &setting.Cfg{EnableKVLeases: true}
		_, err := BuildKVSnapshotStore(cfg, &nonKVBackend{}, logger)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "requires a KV-backed storage backend")
	})

	t.Run("rejects when backend has no lease manager", func(t *testing.T) {
		cfg := &setting.Cfg{EnableKVLeases: true}
		backend := &stubKVBackend{kv: newTestKV(t)}
		_, err := BuildKVSnapshotStore(cfg, backend, logger)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no lease manager")
	})

	t.Run("constructs store when everything is wired", func(t *testing.T) {
		cfg := &setting.Cfg{EnableKVLeases: true}
		store := newTestKV(t)
		mgr := lease.NewManager(store, "test-holder", nil)
		t.Cleanup(mgr.Stop)
		backend := &stubKVBackend{kv: store, mgr: mgr}

		got, err := BuildKVSnapshotStore(cfg, backend, logger)
		require.NoError(t, err)
		assert.NotNil(t, got)
	})
}

func newTestKV(t *testing.T) resource.KV {
	t.Helper()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	return kv.NewBadgerKV(db)
}
