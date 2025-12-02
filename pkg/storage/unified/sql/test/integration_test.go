package test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
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
func newTestBackend(t *testing.T, isHA bool, simulatedNetworkLatency time.Duration) resource.StorageBackend {
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
	return backend
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationStorageServer(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	unitest.RunStorageServerTest(t, func(ctx context.Context) resource.StorageBackend {
		return newTestBackend(t, true, 0)
	})
}

// TestStorageBackend is a test for the StorageBackend interface.
func TestIntegrationSQLStorageBackend(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	t.Run("IsHA (polling notifier)", func(t *testing.T) {
		unitest.RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			return newTestBackend(t, true, 0)
		}, nil)
	})

	t.Run("NotHA (in process notifier)", func(t *testing.T) {
		unitest.RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			return newTestBackend(t, false, 0)
		}, nil)
	})
}

func TestIntegrationSearchAndStorage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()

	// Create a new bleve backend
	search, err := search.NewBleveBackend(search.BleveOptions{
		FileThreshold: 0,
		Root:          t.TempDir(),
	}, tracing.NewNoopTracerService(), nil)
	require.NoError(t, err)
	require.NotNil(t, search)
	t.Cleanup(search.Stop)

	// Create a new resource backend
	storage := newTestBackend(t, false, 0)
	require.NotNil(t, storage)

	// Run the shared storage and search tests
	unitest.RunTestSearchAndStorage(t, ctx, storage, search)
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

	svc, err := sql.ProvideUnifiedStorageGrpcService(cfg, features, dbstore, nil, prometheus.NewPedanticRegistry(), nil, nil, nil, nil, kv.Config{}, nil, nil)
	require.NoError(t, err)
	var client resourcepb.ResourceStoreClient

	clientCtx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
		Rest: authn.AccessTokenClaims{},
	}))

	t.Run("Start and stop service", func(t *testing.T) {
		err = services.StartAndAwaitRunning(ctx, svc)
		require.NoError(t, err)
		require.NotEmpty(t, svc.GetAddress())
	})

	t.Run("Create a client", func(t *testing.T) {
		conn, err := unified.GrpcConn(svc.GetAddress(), prometheus.NewPedanticRegistry())
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
