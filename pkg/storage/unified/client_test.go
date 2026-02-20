package unified

import (
	"context"
	"net"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

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
				nil,
				authlib.FixedAccessClient(true),
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
				nil,
				authlib.FixedAccessClient(true),
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

	return testServer
}

type testServer struct {
	resource.ResourceServer
	Calls map[string]int
	mu    sync.Mutex
	s     *grpc.Server
}

func newTestServer() *testServer {
	return &testServer{
		Calls: make(map[string]int),
	}
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
		s.mu.Lock()
		s.Calls[fullMethodName]++
		s.mu.Unlock()
	}
	return nil
}
