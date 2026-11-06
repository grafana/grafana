package test

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/fullstorydev/grpchan"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
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
func newTestBackend(t *testing.T, isHA bool, simulatedNetworkLatency time.Duration, maxOpenConn int, opts ...sql.StorageBackendOption) resource.StorageBackend {
	// Lock to ensure the entire init block is atomic.
	initMutex.Lock()
	// Unlock once the function returns the initialized backend.
	defer initMutex.Unlock()

	return startTestBackend(t, db.InitTestDB(t), isHA, simulatedNetworkLatency, maxOpenConn, opts...) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
}

// startTestBackend starts a backend on dbstore. Callers must hold initMutex.
func startTestBackend(t *testing.T, dbstore db.DB, isHA bool, simulatedNetworkLatency time.Duration, maxOpenConn int, opts ...sql.StorageBackendOption) resource.StorageBackend {
	cfg := setting.NewCfg()
	cfg.GRPCServer.Address = "localhost:0" // get a free address
	cfg.GRPCServer.Network = "tcp"
	registerer := prometheus.NewPedanticRegistry()
	storageMetrics := resource.ProvideStorageMetrics(registerer)
	cfg.EnableSQLKVBackend = false
	cfg.MaxFileIndexAge = 24 * time.Hour
	cfg.SimulatedNetworkLatency = simulatedNetworkLatency
	cfg.DisablePruner = db.IsTestDbSQLite()
	cfg.NotifierSettleDelay = time.Millisecond // keep it low in tests as most of them don't exercise concurrent writes
	dbSection := cfg.SectionWithEnvOverrides("database")
	if isHA {
		dbSection.Key("high_availability").SetValue("true")
	} else {
		dbSection.Key("high_availability").SetValue("false")
	}
	if maxOpenConn > 0 {
		dbSection.Key("max_open_conn").SetValue(strconv.Itoa(maxOpenConn))
	}
	eDB, err := sql.ProvideResourceDB(cfg, dbstore)
	require.NoError(t, err)
	backend, err := sql.NewStorageBackend(cfg, eDB, registerer, storageMetrics, false, nil, nil, opts...)
	require.NoError(t, err)
	require.NotNil(t, backend)
	backendService, ok := backend.(services.Service)
	require.True(t, ok)
	err = services.StartAndAwaitRunning(testutil.NewTestContext(t, time.Now().Add(1*time.Minute)), backendService)
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
		return newTestBackend(t, true, 0, 0)
	})
}

// TestStorageBackend is a test for the StorageBackend interface.
func TestIntegrationSQLStorageBackend(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	t.Run("IsHA (polling notifier)", func(t *testing.T) {
		if db.IsTestDbSQLite() {
			t.Skip("sqlite not compatible with HA")
		}

		unitest.RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			return newTestBackend(t, true, 0, 0)
		}, nil)
	})

	t.Run("NotHA (in process notifier)", func(t *testing.T) {
		if !db.IsTestDbSQLite() {
			t.Skip("in-process notifier only used with sqlite")
		}

		unitest.RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			return newTestBackend(t, false, 0, 0)
		}, nil)
	})
}

type recordingPublisher struct {
	mu            sync.Mutex
	notifications []*resourcepb.WatchNotification
	subjects      []string
}

func (p *recordingPublisher) Enabled() bool { return true }

func (p *recordingPublisher) Publish(_ context.Context, subject string, data []byte) error {
	n := &resourcepb.WatchNotification{}
	if err := proto.Unmarshal(data, n); err != nil {
		return err
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.subjects = append(p.subjects, subject)
	p.notifications = append(p.notifications, n)
	return nil
}

func TestIntegrationSQLBackendPublishesWatchNotifications(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	pub := &recordingPublisher{}
	backend := newTestBackend(t, !db.IsTestDbSQLite(), 0, 0, sql.WithEventPublisher(pub))
	ctx := testutil.NewDefaultTestContext(t)

	created, err := unitest.WriteEvent(ctx, backend, "item", resourcepb.WatchEvent_ADDED)
	require.NoError(t, err)
	updated, err := unitest.WriteEvent(ctx, backend, "item", resourcepb.WatchEvent_MODIFIED, unitest.WithNamespaceAndRV("namespace", created))
	require.NoError(t, err)
	deleted, err := unitest.WriteEvent(ctx, backend, "item", resourcepb.WatchEvent_DELETED, unitest.WithNamespaceAndRV("namespace", updated))
	require.NoError(t, err)

	subject := "us.watch.v1.group.namespace.resource"
	require.Equal(t, []string{subject, subject, subject}, pub.subjects)
	want := []struct {
		typ    resourcepb.WatchNotification_Type
		rv     int64
		prevRV int64
	}{
		{resourcepb.WatchNotification_ADDED, created, 0},
		{resourcepb.WatchNotification_MODIFIED, updated, created},
		{resourcepb.WatchNotification_DELETED, deleted, updated},
	}
	for i, w := range want {
		got := pub.notifications[i]
		require.Equal(t, w.typ, got.GetType())
		require.Equal(t, "group", got.GetGroup())
		require.Equal(t, "resource", got.GetResource())
		require.Equal(t, "namespace", got.GetNamespace())
		require.Equal(t, "item", got.GetName())
		require.Equal(t, "folderuid", got.GetFolder())
		require.Equal(t, w.rv, got.GetResourceVersion())
		require.Equal(t, w.prevRV, got.GetPreviousResourceVersion())
	}
}

// Two instances share one DB: the polling notifier of one must deliver every
// write of both exactly once and in RV order, including writes batched together.
func TestIntegrationSQLPollingNotifierDeliversAllWrites(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if db.IsTestDbSQLite() {
		t.Skip("sqlite not compatible with HA")
	}
	t.Cleanup(db.CleanupTestDB)

	// Deferred so a failed require (FailNow) still releases the lock.
	watched, other := func() (resource.StorageBackend, resource.StorageBackend) {
		initMutex.Lock()
		defer initMutex.Unlock()
		dbstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		return startTestBackend(t, dbstore, true, 0, 0), startTestBackend(t, dbstore, true, 0, 0)
	}()

	// Hang guard only.
	ctx := testutil.NewTestContext(t, time.Now().Add(time.Minute))
	events, err := watched.WatchWriteEvents(ctx)
	require.NoError(t, err)

	expectDelivered := func(t *testing.T, want map[string]int64) {
		t.Helper()
		got := map[string]int64{}
		var lastRV int64
		for len(got) < len(want) {
			select {
			case e := <-events:
				require.NotContains(t, got, e.Key.Name, "event delivered twice")
				require.Greater(t, e.ResourceVersion, lastRV, "events out of RV order")
				lastRV = e.ResourceVersion
				got[e.Key.Name] = e.ResourceVersion
			case <-ctx.Done():
				t.Fatalf("got %d of %d events: %v", len(got), len(want), got)
			}
		}
		require.Equal(t, want, got)
	}

	writeConcurrently := func(t *testing.T, prefix string, n int) map[string]int64 {
		t.Helper()
		var (
			mu   sync.Mutex
			wg   sync.WaitGroup
			rvs  = map[string]int64{}
			errs []error
		)
		for i := range n {
			backend := watched
			if i%2 == 1 {
				backend = other
			}
			name := prefix + strconv.Itoa(i)
			wg.Go(func() {
				rv, err := unitest.WriteEvent(ctx, backend, name, resourcepb.WatchEvent_ADDED)
				mu.Lock()
				defer mu.Unlock()
				rvs[name] = rv
				errs = append(errs, err)
			})
		}
		wg.Wait()
		for _, err := range errs {
			require.NoError(t, err)
		}
		return rvs
	}

	// Concurrent first writes from two instances race on the resource_version
	// insert, so create the collection first.
	rv, err := unitest.WriteEvent(ctx, other, "seed", resourcepb.WatchEvent_ADDED)
	require.NoError(t, err)
	expectDelivered(t, map[string]int64{"seed": rv})

	expectDelivered(t, writeConcurrently(t, "first-", 20))
	// Later writes to the same collection, once the poller has caught up.
	expectDelivered(t, writeConcurrently(t, "second-", 20))
	rv, err = unitest.WriteEvent(ctx, other, "last", resourcepb.WatchEvent_ADDED)
	require.NoError(t, err)
	expectDelivered(t, map[string]int64{"last": rv})
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
	storage := newTestBackend(t, false, 0, 0)
	require.NotNil(t, storage)

	// Run the shared storage and search tests
	unitest.RunTestSearchAndStorage(t, ctx, storage, searchBackend)
}

// TestIntegrationSearchBackedList runs the search-backed LIST contract against
// each backend. It uses an isolated backend + index per subtest (the runner
// builds indexes over everything the backend holds, so it must hold only the
// resources under test). Batch-read assertions apply only to KV backends; the
// legacy SQL backend takes the per-resource fallback.
func TestIntegrationSearchBackedList(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	newBleve := func(t *testing.T) resource.SearchBackend {
		sb, err := search.NewBleveBackend(search.BleveOptions{FileThreshold: 0, Root: t.TempDir()}, nil)
		require.NoError(t, err)
		t.Cleanup(sb.Stop)
		return sb
	}

	t.Run("kv backend (batched reads)", func(t *testing.T) {
		ctx := context.Background()
		scans := &unitest.DataKeyScanCounter{}
		backend, _ := unitest.NewTestSqlKvBackendWithKV(t, ctx, scans.Wrap)
		unitest.RunTestSearchBackedList(t, ctx, backend, newBleve(t), unitest.SearchBackedListOptions{ExpectBatchReads: true, DataKeyScans: scans.Scans})
	})

	t.Run("kv backend (batched reads, authorize before fetch)", func(t *testing.T) {
		ctx := context.Background()
		scans := &unitest.DataKeyScanCounter{}
		backend, _ := unitest.NewTestSqlKvBackendWithKV(t, ctx, scans.Wrap)
		unitest.RunTestSearchBackedList(t, ctx, backend, newBleve(t), unitest.SearchBackedListOptions{ExpectBatchReads: true, AuthorizeBeforeFetch: true, DataKeyScans: scans.Scans})
	})

	t.Run("sql backend (per-resource fallback)", func(t *testing.T) {
		ctx := context.Background()
		unitest.RunTestSearchBackedList(t, ctx, newTestBackend(t, false, 0, 0), newBleve(t), unitest.SearchBackedListOptions{ExpectBatchReads: false})
	})
}

func TestIntegrationSearchBackedTrashList(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	newBleve := func(t *testing.T) resource.SearchBackend {
		sb, err := search.NewBleveBackend(search.BleveOptions{
			FileThreshold: 0,
			Root:          t.TempDir(),
		}, nil)
		require.NoError(t, err)
		t.Cleanup(sb.Stop)
		return sb
	}

	t.Run("kv backend (batched reads)", func(t *testing.T) {
		ctx := context.Background()
		scans := &unitest.DataKeyScanCounter{}
		backend, _ := unitest.NewTestSqlKvBackendWithKV(t, ctx, scans.Wrap)
		unitest.RunTestSearchBackedTrashList(t, ctx, backend, newBleve(t), unitest.SearchBackedListOptions{ExpectBatchReads: true, DataKeyScans: scans.Scans})
	})

	t.Run("sql backend (storage fallback)", func(t *testing.T) {
		ctx := context.Background()
		unitest.RunTestSearchBackedTrashList(t, ctx, newTestBackend(t, false, 0, 0), newBleve(t), unitest.SearchBackedListOptions{})
	})
}

func TestClientServer(t *testing.T) {
	if db.IsTestDbSQLite() {
		t.Skip("TODO: test blocking, skipping to unblock Enterprise until we fix this")
	}

	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	dbstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	cfg := setting.NewCfg()
	cfg.GRPCServer.Address = "localhost:0" // get a free address
	cfg.GRPCServer.Network = "tcp"

	features := featuremgmt.WithFeatures()

	registerer := prometheus.NewPedanticRegistry()
	storageMetrics := resource.ProvideStorageMetrics(registerer)
	eDB, err := sql.ProvideResourceDB(cfg, dbstore)
	require.NoError(t, err)
	backend, err := sql.NewStorageBackend(cfg, eDB, registerer, storageMetrics, false, nil, nil)
	require.NoError(t, err)

	grpcService, err := grpcserver.ProvideDSKitService(cfg, otel.Tracer("test-grpc-server"), prometheus.NewPedanticRegistry(), "test-grpc-server")
	require.NoError(t, err)
	t.Cleanup(func() {
		grpcService.StopAsync()
		_ = services.StopAndAwaitTerminated(ctx, grpcService)
	})

	svc, err := sql.ProvideUnifiedStorageGrpcService(cfg, features, nil, registerer, nil, nil, nil, nil, nil, kv.Config{}, nil, backend, nil, nil, nil, nil, grpcService,
		sql.WithAuthenticator(func(ctx context.Context) (context.Context, error) {
			auth := grpcUtils.Authenticator{Tracer: otel.Tracer("test")}
			return auth.Authenticate(ctx)
		}),
	)
	require.NoError(t, err)
	grpcService.Health.Register(svc, resourcepb.ResourceStore_ServiceDesc.ServiceName)
	var client resourcepb.ResourceStoreClient

	clientCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:    types.TypeUser,
		UserID:  1,
		UserUID: "user-uid-1",
		OrgID:   1,
		Login:   "testuser",
		Name:    "Test User",
	})

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
		client = resource.NewLegacyResourceClient(conn, conn)
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
	dbstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	cfg := setting.NewCfg()
	cfg.GRPCServer.Address = "localhost:0" // get a free address
	cfg.GRPCServer.Network = "tcp"
	cfg.EnableSearch = true
	cfg.IndexFileThreshold = 1000 // Ensures memory indexing
	cfg.IndexPath = t.TempDir()   // Temporary directory for indexes
	cfg.DisablePruner = db.IsTestDbSQLite()

	features := featuremgmt.WithFeatures()

	// Initialize document builders for search
	docBuilders := &resource.TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"playlist.grafana.app": "playlists",
		},
	}

	registerer := prometheus.NewPedanticRegistry()
	storageMetrics := resource.ProvideStorageMetrics(registerer)
	eDB, err := sql.ProvideResourceDB(cfg, dbstore)
	require.NoError(t, err)
	backend, err := sql.NewStorageBackend(cfg, eDB, registerer, storageMetrics, false, nil, nil)
	require.NoError(t, err)
	backendService := backend.(services.Service)
	require.NotNil(t, backendService)
	require.NoError(t, services.StartAndAwaitRunning(context.Background(), backendService))

	grpcService, err := grpcserver.ProvideDSKitService(cfg, otel.Tracer("test-grpc-server"), prometheus.NewPedanticRegistry(), "test-grpc-server")
	require.NoError(t, err)

	svc, err := sql.ProvideSearchGRPCService(cfg, features, log.New("test"), registerer, docBuilders, nil, nil, nil, kv.Config{}, nil, backend, nil, nil, nil, grpcService,
		sql.WithAuthenticator(func(ctx context.Context) (context.Context, error) {
			auth := grpcUtils.Authenticator{Tracer: otel.Tracer("test")}
			ctx, err := auth.Authenticate(ctx)
			if err != nil {
				return nil, err
			}
			// The legacy metadata authenticator does not carry a namespace, which
			// namespace-checked RPCs such as Search require.
			if user, err := identity.GetRequester(ctx); err == nil {
				if static, isStatic := user.(*identity.StaticRequester); isStatic && static.Namespace == "" {
					static.Namespace = types.OrgNamespaceFormatter(static.OrgID)
				}
			}
			return ctx, nil
		}),
	)
	require.NoError(t, err)

	grpcService.Health.Register(svc, resourcepb.ResourceIndex_ServiceDesc.ServiceName)
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
		resp, err := client.IsHealthy(clientCtx, &resourcepb.HealthCheckRequest{}) //nolint:staticcheck
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("Search returns empty results for empty index", func(t *testing.T) {
		resp, err := client.Search(clientCtx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     "playlist.grafana.app",
					Resource:  "playlists",
				},
			},
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("GetStats returns stats", func(t *testing.T) {
		resp, err := client.GetStats(clientCtx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("RebuildIndexes triggers rebuild", func(t *testing.T) {
		resp, err := client.RebuildIndexes(clientCtx, &resourcepb.RebuildIndexesRequest{
			Namespace: "default",
			Keys: []*resourcepb.ResourceKey{
				{
					Namespace: "default",
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
			Namespace: "default",
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("ListManagedObjects returns list", func(t *testing.T) {
		resp, err := client.ListManagedObjects(clientCtx, &resourcepb.ListManagedObjectsRequest{
			Namespace: "default",
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

// loopbackBus delivers every published notification to every subscriber, like
// a NATS mesh connecting several instances.
type loopbackBus struct {
	mu       sync.Mutex
	handlers []func(subject string, data []byte)
}

type loopbackSubscription struct{}

func (loopbackSubscription) WaitReady(ctx context.Context) error { return ctx.Err() }
func (loopbackSubscription) Unsubscribe() error                  { return nil }

func (b *loopbackBus) Enabled() bool { return true }

func (b *loopbackBus) Publish(_ context.Context, subject string, data []byte) error {
	b.mu.Lock()
	handlers := append([]func(string, []byte){}, b.handlers...)
	b.mu.Unlock()
	for _, h := range handlers {
		h(subject, data)
	}
	return nil
}

func (b *loopbackBus) Subscribe(_ context.Context, subject string, handler func(string, []byte), _ func()) (resource.Subscription, error) {
	if !strings.HasSuffix(subject, ">") {
		return nil, nil
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers = append(b.handlers, handler)
	return loopbackSubscription{}, nil
}

// newSharedDBBackends starts one HA backend per option set on a single
// database, as several Grafana instances would.
func newSharedDBBackends(t *testing.T, optSets ...[]sql.StorageBackendOption) []resource.StorageBackend {
	initMutex.Lock()
	defer initMutex.Unlock()

	cfg := setting.NewCfg()
	cfg.EnableSQLKVBackend = false
	cfg.DisablePruner = db.IsTestDbSQLite()
	cfg.NotifierSettleDelay = time.Millisecond
	dbstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	cfg.SectionWithEnvOverrides("database").Key("high_availability").SetValue("true")

	// One provider migrates the resource tables once for every backend.
	eDB, err := sql.ProvideResourceDB(cfg, dbstore)
	require.NoError(t, err)
	backends := make([]resource.StorageBackend, 0, len(optSets))
	for _, opts := range optSets {
		registerer := prometheus.NewPedanticRegistry()
		backend, err := sql.NewStorageBackend(cfg, eDB, registerer, resource.ProvideStorageMetrics(registerer), false, nil, nil, opts...)
		require.NoError(t, err)
		svc, ok := backend.(services.Service)
		require.True(t, ok)
		require.NoError(t, services.StartAndAwaitRunning(testutil.NewTestContext(t, time.Now().Add(time.Minute)), svc))
		t.Cleanup(func() { _ = services.StopAndAwaitTerminated(context.Background(), svc) })
		backends = append(backends, backend)
	}
	return backends
}

func receiveWritten(t *testing.T, ch <-chan *resource.WrittenEvent) *resource.WrittenEvent {
	t.Helper()
	select {
	case e, ok := <-ch:
		require.True(t, ok, "watch stream closed")
		return e
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for a watch event")
		return nil
	}
}

func TestIntegrationSQLBackendWatchesFromNATS(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	bus := &loopbackBus{}
	opts := func() []sql.StorageBackendOption {
		return []sql.StorageBackendOption{sql.WithEventPublisher(bus), sql.WithNatsNotifier(bus, resource.NewWatchExpiry())}
	}
	backends := newSharedDBBackends(t, opts(), opts())
	writer, reader := backends[0], backends[1]
	ctx := testutil.NewTestContext(t, time.Now().Add(time.Minute))

	readerEvents, err := reader.WatchWriteEvents(ctx)
	require.NoError(t, err)
	writerEvents, err := writer.WatchWriteEvents(ctx)
	require.NoError(t, err)

	created, err := unitest.WriteEvent(ctx, writer, "item", resourcepb.WatchEvent_ADDED)
	require.NoError(t, err)
	updated, err := unitest.WriteEvent(ctx, writer, "item", resourcepb.WatchEvent_MODIFIED, unitest.WithNamespaceAndRV("namespace", created))
	require.NoError(t, err)
	deleted, err := unitest.WriteEvent(ctx, writer, "item", resourcepb.WatchEvent_DELETED, unitest.WithNamespaceAndRV("namespace", updated))
	require.NoError(t, err)

	want := []struct {
		typ    resourcepb.WatchEvent_Type
		rv     int64
		prevRV int64
	}{
		{resourcepb.WatchEvent_ADDED, created, 0},
		{resourcepb.WatchEvent_MODIFIED, updated, created},
		{resourcepb.WatchEvent_DELETED, deleted, updated},
	}
	for name, events := range map[string]<-chan *resource.WrittenEvent{"other instance": readerEvents, "writing instance": writerEvents} {
		for _, w := range want {
			got := receiveWritten(t, events)
			require.Equal(t, w.typ, got.Type, name)
			require.Equal(t, w.rv, got.ResourceVersion, name)
			require.Equal(t, w.prevRV, got.PreviousRV, name)
			require.Equal(t, "item", got.Key.Name, name)
			require.Equal(t, "folderuid", got.Folder, name)
			require.Contains(t, string(got.Value), "item "+w.typ.String(), name)
		}
	}
}
