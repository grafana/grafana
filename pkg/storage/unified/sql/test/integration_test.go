package test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
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
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationStorageServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	unitest.RunStorageServerTest(t, func(ctx context.Context) resource.StorageBackend {
		dbstore := db.InitTestDB(t)
		eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.ProvideService(setting.NewCfg()), nil)
		require.NoError(t, err)
		require.NotNil(t, eDB)

		backend, err := sql.NewBackend(sql.BackendOptions{
			DBProvider: eDB,
			IsHA:       true,
		})
		require.NoError(t, err)
		require.NotNil(t, backend)
		err = backend.Init(testutil.NewDefaultTestContext(t))
		require.NoError(t, err)
		return backend
	})
}

// TestStorageBackend is a test for the StorageBackend interface.
func TestIntegrationSQLStorageBackend(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	t.Run("IsHA (polling notifier)", func(t *testing.T) {
		unitest.RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			dbstore := db.InitTestDB(t)
			eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.ProvideService(setting.NewCfg()), nil)
			require.NoError(t, err)
			require.NotNil(t, eDB)

			backend, err := sql.NewBackend(sql.BackendOptions{
				DBProvider: eDB,
				IsHA:       true,
			})
			require.NoError(t, err)
			require.NotNil(t, backend)
			err = backend.Init(testutil.NewDefaultTestContext(t))
			require.NoError(t, err)
			return backend
		}, nil)
	})

	t.Run("NotHA (in process notifier)", func(t *testing.T) {
		unitest.RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			dbstore := db.InitTestDB(t)
			eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.ProvideService(setting.NewCfg()), nil)
			require.NoError(t, err)
			require.NotNil(t, eDB)

			backend, err := sql.NewBackend(sql.BackendOptions{
				DBProvider: eDB,
				IsHA:       false,
			})
			require.NoError(t, err)
			require.NotNil(t, backend)
			err = backend.Init(testutil.NewDefaultTestContext(t))
			require.NoError(t, err)
			return backend
		}, nil)
	})
}

func TestIntegrationSearchAndStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()

	tempDir := t.TempDir()
	t.Cleanup(func() {
		_ = os.RemoveAll(tempDir)
	})
	// Create a new bleve backend
	search, err := search.NewBleveBackend(search.BleveOptions{
		FileThreshold: 0,
		Root:          tempDir,
	}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering), nil)
	require.NoError(t, err)
	require.NotNil(t, search)

	// Create a new resource backend
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.ProvideService(setting.NewCfg()), nil)
	require.NoError(t, err)
	require.NotNil(t, eDB)

	storage, err := sql.NewBackend(sql.BackendOptions{
		DBProvider: eDB,
		IsHA:       false,
	})
	require.NoError(t, err)
	require.NotNil(t, storage)

	err = storage.Init(ctx)
	require.NoError(t, err)
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

	svc, err := sql.ProvideUnifiedStorageGrpcService(setting.ProvideService(cfg), features, dbstore, nil, prometheus.NewPedanticRegistry(), nil, nil, nil, nil, kv.Config{})
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
