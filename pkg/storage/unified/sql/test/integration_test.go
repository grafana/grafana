package test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/fullstorydev/grpchan"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	unitest "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// initMutex is a global lock to ensure that database initialization and migration
// only happens once at a time across all concurrent integration tests in this package.
// This prevents race conditions where multiple tests try to alter the same table simultaneously.
var initMutex = &sync.Mutex{}

// newTestBackend creates a fresh database and backend for a test.
// It uses a mutex to ensure the entire initialization and migration
// process is atomic and does not race with other parallel tests.
func newTestBackend(t *testing.T, isHA bool, simulatedNetworkLatency time.Duration) (resource.StorageBackend, sqldb.DB) {
	// Lock to ensure the entire init block is atomic.
	initMutex.Lock()
	// Unlock once the function returns the initialized backend.
	defer initMutex.Unlock()

	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	require.NotNil(t, eDB)

	backend, err := sql.NewBackend(sql.BackendOptions{
		DBProvider:              eDB,
		IsHA:                    isHA,
		SimulatedNetworkLatency: simulatedNetworkLatency,
		LastImportTimeMaxAge:    24 * time.Hour,
	})
	require.NoError(t, err)
	require.NotNil(t, backend)

	// Use a context with a reasonable timeout for migrations.
	err = backend.Init(testutil.NewTestContext(t, time.Now().Add(1*time.Minute)))
	require.NoError(t, err)

	sqlDB, err := eDB.Init(testutil.NewTestContext(t, time.Now().Add(1*time.Minute)))
	require.NoError(t, err)

	return backend, sqlDB
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationStorageServer(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	unitest.RunStorageServerTest(t, func(ctx context.Context) resource.StorageBackend {
		backend, _ := newTestBackend(t, true, 0)
		return backend
	})
}

// TestStorageBackend is a test for the StorageBackend interface.
func TestIntegrationSQLStorageBackend(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	t.Run("IsHA (polling notifier)", func(t *testing.T) {
		unitest.RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			backend, _ := newTestBackend(t, true, 0)
			return backend
		}, nil)
	})

	t.Run("NotHA (in process notifier)", func(t *testing.T) {
		unitest.RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			backend, _ := newTestBackend(t, false, 0)
			return backend
		}, nil)
	})
}

func TestIntegrationSQLStorageAndSQLKVCompatibilityTests(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	newKvBackend := func(ctx context.Context) (resource.StorageBackend, sqldb.DB) {
		return unitest.NewTestSqlKvBackend(t, ctx, true)
	}

	opts := &unitest.TestOptions{
		SearchServerFactory: newTestResourceServerWithSearch,
	}

	t.Run("IsHA (polling notifier)", func(t *testing.T) {
		unitest.RunSQLStorageBackendCompatibilityTest(t, func(ctx context.Context) (resource.StorageBackend, sqldb.DB) {
			return newTestBackend(t, true, 0)
		}, newKvBackend, opts)
	})

	t.Run("NotHA (in process notifier)", func(t *testing.T) {
		unitest.RunSQLStorageBackendCompatibilityTest(t, func(ctx context.Context) (resource.StorageBackend, sqldb.DB) {
			return newTestBackend(t, false, 0)
		}, newKvBackend, opts)
	})
}

// newTestResourceServerWithSearch creates a ResourceServer with search enabled for testing
func newTestResourceServerWithSearch(t *testing.T, backend resource.StorageBackend) resource.ResourceServer {
	t.Helper()

	// Create test config
	cfg := setting.NewCfg()
	cfg.EnableSearch = true
	cfg.IndexFileThreshold = 1000 // Ensures memory indexing
	cfg.IndexPath = t.TempDir()   // Temporary directory for indexes

	// Initialize document builders for playlists
	docBuilders := &resource.TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"playlist.grafana.app": "playlists",
		},
	}

	// Create search options
	features := featuremgmt.WithFeatures()
	searchOpts, err := search.NewSearchOptions(features, cfg, docBuilders, nil, nil)
	require.NoError(t, err)

	// Create ResourceServer with search enabled
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      backend,
		AccessClient: types.FixedAccessClient(true), // Allow all operations for testing
		Search:       searchOpts,
		Reg:          nil,
	})
	require.NoError(t, err)

	return server
}

func TestIntegrationSearchAndStorage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()

	// Create a new bleve backend
	searchBackend, err := search.NewBleveBackend(search.BleveOptions{
		FileThreshold: 0,
		Root:          t.TempDir(),
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, searchBackend)
	t.Cleanup(searchBackend.Stop)

	// Create a new resource backend
	storage, _ := newTestBackend(t, false, 0)
	require.NotNil(t, storage)

	// Run the shared storage and search tests
	unitest.RunTestSearchAndStorage(t, ctx, storage, searchBackend)
}

func TestClientServer(t *testing.T) {
	if db.IsTestDbSQLite() {
		t.Skip("TODO: test blocking, skipping to unblock Enterprise until we fix this")
	}

	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	dbstore := db.InitTestDB(t)

	cfg := setting.NewCfg()
	cfg.GRPCServer.Address = "localhost:0" // get a free address
	cfg.GRPCServer.Network = "tcp"

	features := featuremgmt.WithFeatures()

	grpcService, err := grpcserver.ProvideDSKitService(cfg, features, otel.Tracer("test-grpc-server"), prometheus.NewPedanticRegistry(), "test-grpc-server")
	require.NoError(t, err)

	svc, err := sql.ProvideUnifiedStorageGrpcService(cfg, features, dbstore, nil, prometheus.NewPedanticRegistry(), nil, nil, nil, nil, kv.Config{}, nil, nil, nil, grpcService.GetServer())
	require.NoError(t, err)
	var client resourcepb.ResourceStoreClient

	clientCtx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
		Rest: authn.AccessTokenClaims{},
	}))

	t.Run("Start and stop service", func(t *testing.T) {
		err = services.StartAndAwaitRunning(ctx, grpcService)
		require.NoError(t, err)
		err = services.StartAndAwaitRunning(ctx, svc)
		require.NoError(t, err)
		require.NotEmpty(t, grpcService.GetAddress())
	})

	t.Run("Create a client", func(t *testing.T) {
		conn, err := unified.GrpcConn(grpcService.GetAddress(), prometheus.NewPedanticRegistry())
		require.NoError(t, err)
		client, err = resource.NewRemoteResourceClient(tracing.NewNoopTracerService(), conn, conn, resource.RemoteResourceClientConfig{
			Token:            "some-token",
			TokenExchangeURL: "http://some-change-url",
			AllowInsecure:    true,
		})
		require.NoError(t, err)
	})

	t.Run("Create a resource", func(t *testing.T) {
		raw := []byte(`{
			"apiVersion": "group/v0alpha1",
			"kind": "resource",
			"metadata": {
				"name": "item1",
				"namespace": "namespace"
			},
			"spec": {}
		}`)
		resp, err := client.Create(clientCtx, &resourcepb.CreateRequest{
			Key:   resourceKey("item1"),
			Value: raw,
		})
		require.NoError(t, err)
		require.Empty(t, resp.Error)
		require.Greater(t, resp.ResourceVersion, int64(0))
	})

	t.Run("Read the resource", func(t *testing.T) {
		resp, err := client.Read(clientCtx, &resourcepb.ReadRequest{
			Key: resourceKey("item1"),
		})
		require.NoError(t, err)
		require.Empty(t, resp.Error)
		require.Greater(t, resp.ResourceVersion, int64(0))
	})

	t.Run("Stop the service", func(t *testing.T) {
		err = services.StopAndAwaitTerminated(ctx, svc)
		require.NoError(t, err)
	})
}

func resourceKey(name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: "namespace",
		Group:     "group",
		Resource:  "resource",
		Name:      name,
	}
}

func TestIntegrationSearchClientServer(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	dbstore := db.InitTestDB(t)

	cfg := setting.NewCfg()
	cfg.GRPCServer.Address = "localhost:0" // get a free address
	cfg.GRPCServer.Network = "tcp"
	cfg.EnableSearch = true
	cfg.IndexFileThreshold = 1000 // Ensures memory indexing
	cfg.IndexPath = t.TempDir()   // Temporary directory for indexes

	features := featuremgmt.WithFeatures()

	// Initialize document builders for search
	docBuilders := &resource.TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"playlist.grafana.app": "playlists",
		},
	}

	grpcService, err := grpcserver.ProvideDSKitService(cfg, features, otel.Tracer("test-grpc-server"), prometheus.NewPedanticRegistry(), "test-grpc-server")
	require.NoError(t, err)

	svc, err := sql.ProvideSearchGRPCService(cfg, features, dbstore, log.New("test"), prometheus.NewPedanticRegistry(), docBuilders, nil, nil, kv.Config{}, nil, nil, grpcService.GetServer())
	require.NoError(t, err)

	var client resource.SearchClient
	// Use identity.WithRequester to set up proper auth context for gRPC client interceptors
	clientCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:    types.TypeUser,
		UserID:  1,
		UserUID: "user-uid-1",
		OrgID:   1,
		OrgRole: identity.RoleAdmin,
		Login:   "testuser",
		Name:    "Test User",
	})

	t.Run("Start service", func(t *testing.T) {
		err = services.StartAndAwaitRunning(ctx, grpcService)
		require.NoError(t, err)
		err = services.StartAndAwaitRunning(ctx, svc)
		require.NoError(t, err)
		require.NotEmpty(t, grpcService.GetAddress())
	})

	t.Run("Create client", func(t *testing.T) {
		conn, err := unified.GrpcConn(grpcService.GetAddress(), prometheus.NewPedanticRegistry())
		require.NoError(t, err)
		client = newTestSearchClient(conn)
	})

	t.Run("Check service is healthy", func(t *testing.T) {
		resp, err := client.IsHealthy(clientCtx, &resourcepb.HealthCheckRequest{})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("Search returns empty results for empty index", func(t *testing.T) {
		resp, err := client.Search(clientCtx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "playlist.grafana.app",
					Resource:  "playlists",
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("GetStats returns stats", func(t *testing.T) {
		resp, err := client.GetStats(clientCtx, &resourcepb.ResourceStatsRequest{
			Namespace: "namespace",
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("RebuildIndexes triggers rebuild", func(t *testing.T) {
		resp, err := client.RebuildIndexes(clientCtx, &resourcepb.RebuildIndexesRequest{
			Namespace: "namespace",
			Keys: []*resourcepb.ResourceKey{
				{
					Namespace: "namespace",
					Group:     "playlist.grafana.app",
					Resource:  "playlists",
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("CountManagedObjects returns counts", func(t *testing.T) {
		resp, err := client.CountManagedObjects(clientCtx, &resourcepb.CountManagedObjectsRequest{
			Namespace: "namespace",
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("ListManagedObjects returns list", func(t *testing.T) {
		resp, err := client.ListManagedObjects(clientCtx, &resourcepb.ListManagedObjectsRequest{
			Namespace: "namespace",
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("Stop the service", func(t *testing.T) {
		err = services.StopAndAwaitTerminated(ctx, svc)
		require.NoError(t, err)
	})
}

var _ resource.SearchClient = (*testSearchClient)(nil)

// testSearchClient implements resource.SearchClient without auth for testing purposes
type testSearchClient struct {
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
	resourcepb.DiagnosticsClient
}

func newTestSearchClient(conn grpc.ClientConnInterface) *testSearchClient {
	cci := grpchan.InterceptClientConn(conn, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return &testSearchClient{
		ResourceIndexClient:      resourcepb.NewResourceIndexClient(cci),
		ManagedObjectIndexClient: resourcepb.NewManagedObjectIndexClient(cci),
		DiagnosticsClient:        resourcepb.NewDiagnosticsClient(cci),
	}
}
