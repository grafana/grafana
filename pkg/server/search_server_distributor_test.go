package server

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"strconv"
	"sync"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
	"k8s.io/component-base/metrics/legacyregistry"
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

	dbType := sqlutil.GetTestDBType()
	if dbType != "mysql" {
		t.Skip()
	}

	// this next line is to avoid double registration when registering sprinkles metrics
	legacyregistry.Registerer = func() prometheus.Registerer { return prometheus.NewRegistry() }

	db, err := sqlutil.GetTestDB(dbType)
	require.NoError(t, err)

	testNamespaces := make([]string, 0, namespaceCount)
	for i := range namespaceCount {
		testNamespaces = append(testNamespaces, "stacks-"+strconv.Itoa(i))
	}

	baselineServer := createBaselineServer(t, dbType, db.ConnStr, testNamespaces)

	testServers := make([]testModuleServer, 0, 2)
	memberlistPort := getRandomPort()
	distributorServer := initDistributorServerForTest(t, memberlistPort)
	testServers = append(testServers, createStorageServerApi(t, 1, dbType, db.ConnStr, memberlistPort))
	testServers = append(testServers, createStorageServerApi(t, 2, dbType, db.ConnStr, memberlistPort))

	startAndWaitHealthy(t, distributorServer)

	for _, testServer := range testServers {
		startAndWaitHealthy(t, testServer)
	}

	t.Run("should expose ring endpoint", func(t *testing.T) {
		client := http.Client{}
		res, err := client.Get(fmt.Sprintf("http://localhost:%s/ring", distributorServer.httpPort))
		require.NoError(t, err)

		require.Equal(t, res.StatusCode, http.StatusOK)
		_ = res.Body.Close()
	})

	t.Run("should expose memberlist endpoint", func(t *testing.T) {
		client := http.Client{}
		res, err := client.Get(fmt.Sprintf("http://localhost:%s/memberlist", distributorServer.httpPort))
		require.NoError(t, err)

		require.Equal(t, res.StatusCode, http.StatusOK)
		_ = res.Body.Close()
	})

	t.Run("GetStats", func(t *testing.T) {
		instanceResponseCount := make(map[string]int)

		for _, ns := range testNamespaces {
			req := &resourcepb.ResourceStatsRequest{
				Namespace: ns,
			}
			baselineRes := getBaselineResponse(t, req, baselineServer.GetStats)
			distributorRes := getDistributorResponse(t, req, distributorServer.resourceClient.GetStats, instanceResponseCount)
			require.Equal(t, baselineRes.String(), distributorRes.String())
		}

		for instance, count := range instanceResponseCount {
			require.GreaterOrEqual(t, count, 1, "instance did not get any traffic: "+instance)
		}
	})

	t.Run("CountManagedObjects", func(t *testing.T) {
		instanceResponseCount := make(map[string]int)

		for _, ns := range testNamespaces {
			req := &resourcepb.CountManagedObjectsRequest{
				Namespace: ns,
			}
			baselineRes := getBaselineResponse(t, req, baselineServer.CountManagedObjects)
			distributorRes := getDistributorResponse(t, req, distributorServer.resourceClient.CountManagedObjects, instanceResponseCount)
			require.Equal(t, baselineRes.String(), distributorRes.String())
		}

		for instance, count := range instanceResponseCount {
			require.GreaterOrEqual(t, count, 1, "instance did not get any traffic: "+instance)
		}
	})

	t.Run("ListManagedObjects", func(t *testing.T) {
		instanceResponseCount := make(map[string]int)

		for _, ns := range testNamespaces {
			req := &resourcepb.ListManagedObjectsRequest{
				Namespace: ns,
			}
			baselineRes := getBaselineResponse(t, req, baselineServer.ListManagedObjects)
			distributorRes := getDistributorResponse(t, req, distributorServer.resourceClient.ListManagedObjects, instanceResponseCount)
			require.Equal(t, baselineRes.String(), distributorRes.String())
		}

		for instance, count := range instanceResponseCount {
			require.GreaterOrEqual(t, count, 1, "instance did not get any traffic: "+instance)
		}
	})

	t.Run("Search", func(t *testing.T) {
		instanceResponseCount := make(map[string]int)

		for _, ns := range testNamespaces {
			req := &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:     "playlist.grafana.app",
						Resource:  "aoeuaeou",
						Namespace: ns,
					},
				},
			}
			baselineRes := getBaselineResponse(t, req, baselineServer.Search)
			distributorRes := getDistributorResponse(t, req, distributorServer.resourceClient.Search, instanceResponseCount)
			// sometimes the querycost is different between the two. Happens randomly and we don't have control over it
			// as it comes from bleve. Since we are not testing search functionality we hard-set this to 0 to avoid
			// flaky tests
			distributorRes.QueryCost = 0
			baselineRes.QueryCost = 0
			require.Equal(t, baselineRes.String(), distributorRes.String())
		}

		for instance, count := range instanceResponseCount {
			require.GreaterOrEqual(t, count, 1, "instance did not get any traffic: "+instance)
		}
	})

	var wg sync.WaitGroup
	for _, testServer := range testServers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := testServer.server.Shutdown(ctx, "tests are done"); err != nil {
				require.NoError(t, err)
			}
		}()
	}
	wg.Wait()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := distributorServer.server.Shutdown(ctx, "tests are done"); err != nil {
		require.NoError(t, err)
	}
}

func getBaselineResponse[Req any, Resp any](t *testing.T, req *Req, fn func(ctx context.Context, req *Req) (*Resp, error)) *Resp {
	ctx := context.Background()
	baselineRes, err := fn(ctx, req)
	require.NoError(t, err)
	return baselineRes
}

func getDistributorResponse[Req any, Resp any](t *testing.T, req *Req, fn func(ctx context.Context, req *Req, opts ...grpc.CallOption) (*Resp, error), instanceResponseCount map[string]int) *Resp {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	var header metadata.MD
	res, err := fn(ctx, req, grpc.Header(&header))
	require.NoError(t, err)

	instance := header.Get("proxied-instance-id")
	if len(instance) != 1 {
		t.Fatal("received invalid proxied-instance-id header", instance)
	}

	instanceResponseCount[instance[0]] += 1
	return res
}

func startAndWaitHealthy(t *testing.T, testServer testModuleServer) {
	go func() {
		// this next line is to avoid double registration, as both InitializeDocumentBuilders as well as ProvideUnifiedStorageGrpcService
		// are hard-coded to use prometheus.DefaultRegisterer
		// the alternative would be to get the registry from wire, in which case the tests would receive a new
		// registry automatically, but that _may_ change metric names
		// We can remove this once that's fixed
		prometheus.DefaultRegisterer = prometheus.NewRegistry()
		if err := testServer.server.Run(); err != nil && !errors.Is(err, context.Canceled) {
			require.NoError(t, err)
		}
	}()

	deadline := time.Now().Add(20 * time.Second)
	for {
		conn, err := net.DialTimeout("tcp", testServer.grpcAddress, 1*time.Second)
		if err == nil {
			_ = conn.Close()
			break
		}

		if time.Now().After(deadline) {
			t.Fatal("server failed to become ready: ", testServer.id)
		}

		time.Sleep(1 * time.Second)
	}

	res, err := testServer.healthClient.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{})
	require.NoError(t, err)
	require.Equal(t, res.Status, grpc_health_v1.HealthCheckResponse_SERVING)
}

type testModuleServer struct {
	server         *ModuleServer
	healthClient   grpc_health_v1.HealthClient
	resourceClient resource.ResourceClient
	id             string
	grpcAddress    string
	httpPort       string
}

func getRandomPort() int {
	ln, _ := net.Listen("tcp", "127.0.0.1:0")
	_ = ln.Close()
	return ln.Addr().(*net.TCPAddr).Port
}

func initDistributorServerForTest(t *testing.T, memberlistPort int) testModuleServer {
	cfg := setting.NewCfg()
	cfg.HTTPPort = strconv.Itoa(getRandomPort())
	cfg.GRPCServer.Network = "tcp"
	cfg.GRPCServer.Address = "127.0.0.1:" + strconv.Itoa(getRandomPort())
	cfg.EnableSharding = true
	cfg.MemberlistBindAddr = "127.0.0.1"
	cfg.MemberlistJoinMember = "127.0.0.1:" + strconv.Itoa(memberlistPort)
	cfg.MemberlistAdvertiseAddr = "127.0.0.1"
	cfg.MemberlistAdvertisePort = memberlistPort
	cfg.SearchRingReplicationFactor = 1
	cfg.Target = []string{modules.SearchServerDistributor}
	cfg.InstanceID = "distributor" // does nothing for the distributor but may be useful to debug tests

	conn, err := grpc.NewClient(cfg.GRPCServer.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)
	client := resource.NewLegacyResourceClient(conn, conn)

	server := initModuleServerForTest(t, setting.ProvideService(cfg), Options{}, api.ServerOptions{})

	server.resourceClient = client

	return server
}

func createStorageServerApi(t *testing.T, instanceId int, dbType, dbConnStr string, memberlistPort int) testModuleServer {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection("database")
	require.NoError(t, err)

	_, err = section.NewKey("type", dbType)
	require.NoError(t, err)
	_, err = section.NewKey("connection_string", dbConnStr)
	require.NoError(t, err)

	cfg.HTTPPort = strconv.Itoa(getRandomPort())
	cfg.GRPCServer.Network = "tcp"
	cfg.GRPCServer.Address = "127.0.0.1:" + strconv.Itoa(getRandomPort())
	cfg.EnableSharding = true
	cfg.MemberlistBindAddr = "127.0.0.1"
	cfg.MemberlistJoinMember = "127.0.0.1:" + strconv.Itoa(memberlistPort)
	cfg.MemberlistAdvertiseAddr = "127.0.0.1"
	cfg.MemberlistAdvertisePort = getRandomPort()
	cfg.SearchRingReplicationFactor = 1
	cfg.InstanceID = "instance-" + strconv.Itoa(instanceId)
	cfg.IndexPath = t.TempDir() + cfg.InstanceID
	cfg.IndexFileThreshold = testIndexFileThreshold
	cfg.Target = []string{modules.StorageServer}

	return initModuleServerForTest(t, setting.ProvideService(cfg), Options{}, api.ServerOptions{})
}

func initModuleServerForTest(
	t *testing.T,
	settingsProvider setting.SettingsProvider,
	opts Options,
	apiOpts api.ServerOptions,
) testModuleServer {
	tracer := tracing.InitializeTracerForTest()

	ms, err := NewModule(opts, apiOpts, featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearch), settingsProvider, nil, nil, prometheus.NewRegistry(), prometheus.DefaultGatherer, tracer, nil)
	require.NoError(t, err)

	cfg := settingsProvider.Get()
	conn, err := grpc.NewClient(cfg.GRPCServer.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)

	healthClient := grpc_health_v1.NewHealthClient(conn)

	return testModuleServer{server: ms, grpcAddress: cfg.GRPCServer.Address, httpPort: cfg.HTTPPort, healthClient: healthClient, id: cfg.InstanceID}
}

func createBaselineServer(t *testing.T, dbType, dbConnStr string, testNamespaces []string) resource.ResourceServer {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection("database")
	require.NoError(t, err)

	_, err = section.NewKey("type", dbType)
	require.NoError(t, err)
	_, err = section.NewKey("connection_string", dbConnStr)
	require.NoError(t, err)
	cfg.IndexPath = t.TempDir()
	cfg.IndexFileThreshold = testIndexFileThreshold
	features := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearch)
	docBuilders, err := InitializeDocumentBuilders(cfg)
	require.NoError(t, err)
	tracer := noop.NewTracerProvider().Tracer("test-tracer")
	require.NoError(t, err)
	searchOpts, err := search.NewSearchOptions(features, setting.ProvideService(cfg), tracer, docBuilders, nil)
	require.NoError(t, err)
	server, err := sql.NewResourceServer(sql.ServerOptions{
		DB:               nil,
		SettingsProvider: setting.ProvideService(cfg),
		Tracer:           tracer,
		Reg:              nil,
		AccessClient:     nil,
		SearchOptions:    searchOpts,
		StorageMetrics:   nil,
		IndexMetrics:     nil,
		Features:         features,
		QOSQueue:         nil,
	})
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
