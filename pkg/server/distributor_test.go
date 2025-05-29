package server

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"sync"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
)

var (
	testIndexFileThreshold  = 200 // just needs to be bigger than max playlist number, so the indexer don't use the filesystem
	namespaceCount          = 250 // how many stacks we're simulating
	maxPlaylistPerNamespace = 50  // upper bound on how many playlists we will seed to each stack.
)

//nolint:gocyclo
func TestIntegrationDistributor(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// we don't need grpc logs in tests so mute it so we don't get a bunch of health check errors during test
	// grpclog.SetLoggerV2(grpclog.NewLoggerV2(io.Discard, io.Discard, io.Discard))

	dbType := sqlutil.GetTestDBType()
	if dbType == "sqlite3" {
		t.Skip()
	}

	db, err := sqlutil.GetTestDB(dbType)
	fmt.Println("testdb: ", db.ConnStr)
	require.NoError(t, err)

	testNamespaces := make([]string, 0, namespaceCount)
	for i := range namespaceCount {
		testNamespaces = append(testNamespaces, "stacks-"+strconv.Itoa(i))
	}

	baselineServer := createBaselineServer(t, dbType, db.ConnStr, testNamespaces)

	var (
		mu       sync.Mutex
		runErrs  []error
		stopErrs []error
	)

	testServers := make([]testModuleServer, 0, 2)
	distributorServer := initDistributorServerForTest(t)

	serversAddresses := []string{"127.0.0.2"}
	for i, ip := range serversAddresses {
		testServers = append(testServers, createStorageServerApi(t, "instance-"+strconv.Itoa(i), ip, dbType, db.ConnStr))
	}

	go func() {
		if err := distributorServer.server.Run(); err != nil && !errors.Is(err, context.Canceled) {
			mu.Lock()
			runErrs = append(runErrs, err)
			mu.Unlock()
		}
	}()

	require.Eventually(t, func() bool {
		res, err := distributorServer.healthClient.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
		if err != nil {
			return false
		}
		return res.Status == grpc_health_v1.HealthCheckResponse_SERVING
	}, 10*time.Second, 2*time.Second)

	for _, testServer := range testServers {
		fmt.Println("Starting ", testServer.id)
		go func(s testModuleServer) {
			if err := testServer.server.Run(); err != nil && !errors.Is(err, context.Canceled) {
				mu.Lock()
				runErrs = append(runErrs, err)
				mu.Unlock()
			}
		}(testServer)

		require.Eventually(t, func() bool {
			res, err := testServer.healthClient.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
			if err != nil {
				return false
			}
			fmt.Println("got: ", res)
			return res.Status == grpc_health_v1.HealthCheckResponse_SERVING
		}, 20*time.Second, 2*time.Second, "server failed to start up or is too slow: "+testServer.id)
	}

	t.Run("should expose ring endpoint", func(t *testing.T) {
		client := http.Client{}
		res, err := client.Get("http://localhost:3001/ring")
		require.NoError(t, err)

		require.Equal(t, res.StatusCode, http.StatusOK)
		_ = res.Body.Close()
	})

	t.Run("should expose memberlist endpoint", func(t *testing.T) {
		client := http.Client{}
		res, err := client.Get("http://localhost:3001/memberlist")
		require.NoError(t, err)

		require.Equal(t, res.StatusCode, http.StatusOK)
		_ = res.Body.Close()
	})

	t.Run("GetStats", func(t *testing.T) {
		instanceResponseCount := make(map[string]int)

		for _, ns := range testNamespaces {
			ctx := context.Background()
			baselineRes, err := baselineServer.GetStats(ctx, &resourcepb.ResourceStatsRequest{
				Namespace: ns,
			})
			require.NoError(t, err)

			ctx = identity.WithServiceIdentityContext(context.Background(), 1)
			var header metadata.MD
			res, err := distributorServer.resourceClient.GetStats(ctx, &resourcepb.ResourceStatsRequest{
				Namespace: ns,
			}, grpc.Header(&header))
			require.NoError(t, err)

			require.Equal(t, baselineRes.String(), res.String())

			instance := header.Get("proxied-instance-id")
			if len(instance) != 1 {
				t.Fatal("received invalid proxied-instance-id header", instance)
			}

			instanceResponseCount[instance[0]] += 1
		}

		for instance, count := range instanceResponseCount {
			require.GreaterOrEqual(t, count, 1, "instance did not get any traffic: "+instance)
		}
	})

	t.Run("CountManagedObjects", func(t *testing.T) {
		instanceResponseCount := make(map[string]int)

		for _, ns := range testNamespaces {
			ctx := context.Background()
			baselineRes, err := baselineServer.CountManagedObjects(ctx, &resourcepb.CountManagedObjectsRequest{
				Namespace: ns,
			})
			require.NoError(t, err)

			ctx = identity.WithServiceIdentityContext(context.Background(), 1)
			var header metadata.MD
			res, err := distributorServer.resourceClient.CountManagedObjects(ctx, &resourcepb.CountManagedObjectsRequest{
				Namespace: ns,
			}, grpc.Header(&header))
			require.NoError(t, err)

			require.Equal(t, baselineRes.String(), res.String())

			instance := header.Get("proxied-instance-id")
			if len(instance) != 1 {
				t.Fatal("received invalid proxied-instance-id header", instance)
			}

			instanceResponseCount[instance[0]] += 1
		}

		for instance, count := range instanceResponseCount {
			require.GreaterOrEqual(t, count, 1, "instance did not get any traffic: "+instance)
		}
	})

	t.Run("ListManagedObjects", func(t *testing.T) {
		instanceResponseCount := make(map[string]int)

		for _, ns := range testNamespaces {
			ctx := context.Background()
			baselineRes, err := baselineServer.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{
				Namespace: ns,
			})
			require.NoError(t, err)

			ctx = identity.WithServiceIdentityContext(context.Background(), 1)
			var header metadata.MD
			res, err := distributorServer.resourceClient.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{
				Namespace: ns,
			}, grpc.Header(&header))
			require.NoError(t, err)

			require.Equal(t, baselineRes.String(), res.String())

			instance := header.Get("proxied-instance-id")
			if len(instance) != 1 {
				t.Fatal("received invalid proxied-instance-id header", instance)
			}

			instanceResponseCount[instance[0]] += 1
		}

		for instance, count := range instanceResponseCount {
			require.GreaterOrEqual(t, count, 1, "instance did not get any traffic: "+instance)
		}
	})

	t.Run("Search", func(t *testing.T) {
		instanceResponseCount := make(map[string]int)

		for _, ns := range testNamespaces {
			ctx := context.Background()
			baselineRes, err := baselineServer.Search(ctx, &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:     "playlist.grafana.app",
						Resource:  "aoeuaeou",
						Namespace: ns,
					},
				},
				Explain: false, // never include query_cost, as this will differ between the two requests
			})
			require.NoError(t, err)

			ctx = identity.WithServiceIdentityContext(context.Background(), 1)
			var header metadata.MD
			res, err := distributorServer.resourceClient.Search(ctx, &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:     "playlist.grafana.app",
						Resource:  "aoeuaeou",
						Namespace: ns,
					},
				},
				Explain: false, // never include query_cost, as this will differ between the two requests
			}, grpc.Header(&header))
			require.NoError(t, err)

			require.Equal(t, baselineRes.String(), res.String())

			instance := header.Get("proxied-instance-id")
			if len(instance) != 1 {
				t.Fatal("received invalid proxied-instance-id header", instance)
			}

			instanceResponseCount[instance[0]] += 1
		}

		for instance, count := range instanceResponseCount {
			require.GreaterOrEqual(t, count, 1, "instance did not get any traffic: "+instance)
		}
	})

	stopServers := func(done chan error) {
		var wg sync.WaitGroup
		for _, testServer := range testServers {
			wg.Add(1)
			go func(s testModuleServer) {
				defer wg.Done()
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				if err := testServer.server.Shutdown(ctx, "tests are done"); err != nil {
					mu.Lock()
					stopErrs = append(stopErrs, err)
					mu.Unlock()
				}
			}(testServer)
		}
		wg.Wait()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := distributorServer.server.Shutdown(ctx, "tests are done"); err != nil {
			mu.Lock()
			stopErrs = append(stopErrs, err)
			mu.Unlock()
		}
		done <- nil
	}

	done := make(chan error, 1)
	go stopServers(done)
	select {
	case <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("timeout waiting for servers to shutdown")
	}

	for _, runErr := range runErrs {
		if runErr != nil {
			t.Fatalf("unexpected run error from module server: %v", runErr)
		}
	}

	for _, stopErr := range stopErrs {
		if stopErr != nil {
			t.Fatalf("unexpected stop error from module server: %v", stopErr)
		}
	}
}

type testModuleServer struct {
	server         *ModuleServer
	healthClient   grpc_health_v1.HealthClient
	resourceClient resource.ResourceClient
	id             string
}

func initDistributorServerForTest(t *testing.T) testModuleServer {
	cfg := setting.NewCfg()
	cfg.HTTPPort = "3001"
	cfg.GRPCServer.Network = "tcp"
	cfg.GRPCServer.Address = "127.0.0.1:10000"
	cfg.EnableSharding = true
	cfg.MemberlistBindAddr = "127.0.0.1"
	cfg.MemberlistJoinMember = "127.0.0.1:7946"
	cfg.MemberlistAdvertiseAddr = "127.0.0.1"
	cfg.Target = []string{modules.Distributor}
	cfg.InstanceID = "distributor" // does nothing for the distributor but may be useful to debug tests

	conn, err := grpc.NewClient(cfg.GRPCServer.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)
	client := resource.NewLegacyResourceClient(conn)

	server := initModuleServerForTest(t, cfg, Options{}, api.ServerOptions{})

	server.resourceClient = client

	return server
}

func createStorageServerApi(t *testing.T, instanceId, bindAddr, dbType, dbConnStr string) testModuleServer {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection("database")
	require.NoError(t, err)

	_, err = section.NewKey("type", dbType)
	require.NoError(t, err)
	_, err = section.NewKey("connection_string", dbConnStr)
	require.NoError(t, err)

	cfg.HTTPPort = "3001"
	cfg.HTTPAddr = bindAddr
	cfg.GRPCServer.Network = "tcp"
	cfg.GRPCServer.Address = bindAddr + ":10000"
	cfg.EnableSharding = true
	cfg.MemberlistBindAddr = bindAddr
	cfg.MemberlistJoinMember = "127.0.0.1:7946"
	cfg.MemberlistAdvertiseAddr = bindAddr
	cfg.InstanceID = instanceId
	cfg.IndexPath = "/tmp/grafana-test-index-path/" + instanceId
	cfg.IndexFileThreshold = testIndexFileThreshold
	cfg.Target = []string{modules.StorageServer}

	return initModuleServerForTest(t, cfg, Options{}, api.ServerOptions{})
}

func initModuleServerForTest(
	t *testing.T,
	cfg *setting.Cfg,
	opts Options,
	apiOpts api.ServerOptions,
) testModuleServer {
	ms, err := NewModule(opts, apiOpts, featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearch), cfg, nil, nil, prometheus.NewRegistry(), prometheus.DefaultGatherer, nil)
	require.NoError(t, err)

	conn, err := grpc.NewClient(cfg.GRPCServer.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)

	healthClient := grpc_health_v1.NewHealthClient(conn)

	return testModuleServer{server: ms, healthClient: healthClient, id: cfg.InstanceID}
}

func createBaselineServer(t *testing.T, dbType, dbConnStr string, testNamespaces []string) resource.ResourceServer {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection("database")
	require.NoError(t, err)

	_, err = section.NewKey("type", dbType)
	require.NoError(t, err)
	_, err = section.NewKey("connection_string", dbConnStr)
	require.NoError(t, err)
	cfg.IndexPath = "/tmp/grafana-test-index-path/baseline-server"
	cfg.IndexFileThreshold = testIndexFileThreshold
	features := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearch)
	docBuilders, err := InitializeDocumentBuilders(cfg)
	require.NoError(t, err)
	tracer := noop.NewTracerProvider().Tracer("test-tracer")
	require.NoError(t, err)
	searchOpts, err := search.NewSearchOptions(features, cfg, tracer, docBuilders, nil)
	require.NoError(t, err)
	server, err := sql.NewResourceServer(nil, cfg, tracer, nil, nil, searchOpts, nil, nil, features)
	require.NoError(t, err)

	testUserA := &identity.StaticRequester{
		Type:           claims.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
	}
	ctx := claims.WithAuthInfo(context.Background(), testUserA)

	for _, ns := range testNamespaces {
		for range rand.Intn(maxPlaylistPerNamespace) + 1 {
			_, err = server.Create(ctx, generatePlaylistPayload(ns))
			require.NoError(t, err)
		}
	}

	return server
}

var counter int

func generatePlaylistPayload(ns string) *resourcepb.CreateRequest {
	name := "playlist" + strconv.Itoa(counter)
	counter += 1
	return &resourcepb.CreateRequest{
		Value: []byte(fmt.Sprintf(`{
    		"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "%s",
				"uid": "xyz",
				"namespace": "%s",
				"annotations": {
					"grafana.app/repoName": "elsewhere",
					"grafana.app/repoPath": "path/to/item",
					"grafana.app/repoTimestamp": "2024-02-02T00:00:00Z"
				}
			},
			"spec": {
				"title": "hello",
				"interval": "5m",
				"items": [
					{
						"type": "dashboard_by_uid",
						"value": "vmie2cmWz"
					}
				]
			}
		}`, name, ns)),
		Key: &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "aoeuaeou",
			Namespace: ns,
			Name:      name,
		},
	}
}
