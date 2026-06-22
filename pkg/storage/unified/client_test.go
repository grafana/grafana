package unified

import (
	"context"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestUnifiedStorageClient(t *testing.T) {
	resourceServerAddress := ":11000"
	resourceServer := createTestGrpcServer(t, resourceServerAddress)
	defer resourceServer.s.Stop()
	indexServerAddress := ":11001"
	indexServer := createTestGrpcServer(t, indexServerAddress)
	defer indexServer.s.Stop()

	t.Run("when storage type is unified-grpc", func(t *testing.T) {
		t.Run("should create a client that connects to the unified storage server address", func(t *testing.T) {
			resourceServer.resetCalls()
			indexServer.resetCalls()

			client, err := newClient(
				options.StorageOptions{
					StorageType: options.StorageTypeUnifiedGrpc,
					Address:     resourceServerAddress,
				},
				&setting.Cfg{},
				featuremgmt.WithFeatures(),
				nil,
				nil,
				authlib.FixedAccessClient(true),
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
			)
			require.NoError(t, err)

			testCallAllMethods(client)
			// every method should hit resource server exactly once
			for method, count := range resourceServer.getCalls() {
				require.Equal(t, 1, count, "method was called more than once: "+method)
			}
			// no hits to the index server in this case
			for range indexServer.getCalls() {
				require.FailNow(t, "index server was called when it should have not")
			}
		})

		t.Run("should connect to a separate index server if defined in the config", func(t *testing.T) {
			resourceServer.resetCalls()
			indexServer.resetCalls()

			client, err := newClient(
				options.StorageOptions{
					StorageType:         options.StorageTypeUnifiedGrpc,
					Address:             resourceServerAddress,
					SearchServerAddress: indexServerAddress,
				},
				&setting.Cfg{},
				featuremgmt.WithFeatures(),
				nil,
				nil,
				authlib.FixedAccessClient(true),
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
				nil,
			)
			require.NoError(t, err)

			testCallAllMethods(client)
			// only resource store methods in this case
			for method, count := range resourceServer.getCalls() {
				require.Equal(t, 1, count, "method was called more than once: "+method)
				require.True(t, strings.Contains(method, "resource.ResourceStore"))
			}
			// index server methods should be called here
			for method, count := range indexServer.getCalls() {
				require.Equal(t, 1, count, "method was called more than once: "+method)
				require.True(t, strings.Contains(method, "resource.ResourceIndex") || strings.Contains(method, "resource.ManagedObjectIndex"))
			}
		})
	})
}

func TestNewSearchClient(t *testing.T) {
	t.Run("new search client fails when address is empty", func(t *testing.T) {
		cfg := setting.NewCfg()

		_, err := NewSearchClient(cfg, featuremgmt.WithFeatures())
		require.Error(t, err)
		require.Contains(t, err.Error(), "search_server_address")
	})

	t.Run("returns nil when creating storage api search client when EnableSearchClient is false", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.EnableSearchClient = false

		client, err := NewStorageApiSearchClient(cfg, featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.Nil(t, client)
	})

	t.Run("new search client succeeds when address is provided", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.EnableSearchClient = true
		cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue("localhost:12345")

		client, err := NewStorageApiSearchClient(cfg, featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.NotNil(t, client)
	})

	// When the flag is enabled, storage should be able to make a grpc call to search
	t.Run("storage to search grpc call carries authlib token when flag is enabled", func(t *testing.T) {
		searchServer := createTestGrpcServer(t, ":0")
		defer searchServer.s.Stop()

		cfg := setting.NewCfg()
		cfg.EnableSearchClient = true
		cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue(searchServer.addr)

		client, err := NewStorageApiSearchClient(cfg, featuremgmt.WithFeatures(featuremgmt.FlagAppPlatformGrpcClientAuth))
		require.NoError(t, err)
		require.NotNil(t, client)

		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		_, callErr := client.Search(ctx, &resourcepb.ResourceSearchRequest{})
		require.NotContains(t, callErr.Error(), "Requester was not found in the context",
			"authlib branch must not require a Requester in ctx")

		require.Eventually(t, func() bool {
			return searchServer.getCalls()["/resource.ResourceIndex/Search"] > 0
		}, 2*time.Second, 10*time.Millisecond, "search server should have received the call, got error: %v", callErr)

		md := searchServer.getMetadata("/resource.ResourceIndex/Search")
		require.NotNil(t, md, "metadata should have been captured")
		require.NotEmpty(t, md.Get("x-access-token"), "outbound call must carry authlib X-Access-Token")
		require.Empty(t, md.Get("grafana-login"), "outbound call must not carry legacy grafana-login header")
	})

	// Without the flag, NewSearchClient falls back to the legacy interceptor
	// which requires identity.Requester in ctx. A ctx without one must fail
	// before the call leaves the process — this is the bug being fixed.
	t.Run("legacy branch fails outbound when ctx has no Requester", func(t *testing.T) {
		searchServer := createTestGrpcServer(t, ":0")
		defer searchServer.s.Stop()

		cfg := setting.NewCfg()
		cfg.EnableSearchClient = true
		cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue(searchServer.addr)

		client, err := NewStorageApiSearchClient(cfg, featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.NotNil(t, client)

		_, err = client.Search(context.Background(), &resourcepb.ResourceSearchRequest{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "Requester was not found in the context")
		require.Empty(t, searchServer.getCalls(), "request should die in outbound interceptor, never reach server")
	})
}

func testCallAllMethods(client resource.ResourceClient) {
	_, _ = client.Read(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.ReadRequest{})
	_, _ = client.Create(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.CreateRequest{})
	_, _ = client.Delete(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.DeleteRequest{})
	_, _ = client.Update(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.UpdateRequest{})
	_, _ = client.List(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.ListRequest{})
	_, _ = client.GetStats(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.ResourceStatsRequest{})
	_, _ = client.Search(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.ResourceSearchRequest{})
	_, _ = client.CountManagedObjects(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.CountManagedObjectsRequest{})
	_, _ = client.ListManagedObjects(identity.WithServiceIdentityContext(context.Background(), 1), &resourcepb.ListManagedObjectsRequest{})
}

func createTestGrpcServer(t *testing.T, address string) *testServer {
	listener, err := net.Listen("tcp", address)
	require.NoError(t, err, "failed to listen")

	testServer := newTestServer()
	s := grpc.NewServer(
		grpc.UnknownServiceHandler(testServer.handler),
	)

	go func() {
		_ = s.Serve(listener)
	}()

	testServer.s = s
	testServer.addr = listener.Addr().String()

	return testServer
}

type testServer struct {
	resource.ResourceServer
	Calls    map[string]int
	Metadata map[string]metadata.MD
	mu       sync.Mutex
	s        *grpc.Server
	addr     string
}

func newTestServer() *testServer {
	return &testServer{
		Calls:    make(map[string]int),
		Metadata: make(map[string]metadata.MD),
	}
}

func (s *testServer) getMetadata(method string) metadata.MD {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.Metadata[method]
}

func (s *testServer) resetCalls() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Calls = make(map[string]int)
}

func (s *testServer) getCalls() map[string]int {
	s.mu.Lock()
	defer s.mu.Unlock()

	calls := make(map[string]int, len(s.Calls))
	for method, count := range s.Calls {
		calls[method] = count
	}

	return calls
}

func (s *testServer) handler(srv interface{}, serverStream grpc.ServerStream) error {
	fullMethodName, ok := grpc.MethodFromServerStream(serverStream)
	if ok {
		md, _ := metadata.FromIncomingContext(serverStream.Context())
		s.mu.Lock()
		s.Calls[fullMethodName]++
		s.Metadata[fullMethodName] = md
		s.mu.Unlock()
	}
	return nil
}
