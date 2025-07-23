package unified

import (
	"context"
	"net"
	"strings"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/require"

	"google.golang.org/grpc"
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
			)
			require.NoError(t, err)

			testCallAllMethods(client)
			// every method should hit resource server exactly once
			for method, count := range resourceServer.Calls {
				require.Equal(t, 1, count, "method was called more than once: "+method)
			}
			// no hits to the index server in this case
			for range indexServer.Calls {
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
			)
			require.NoError(t, err)

			testCallAllMethods(client)
			// only resource store methods in this case
			for method, count := range resourceServer.Calls {
				require.Equal(t, 1, count, "method was called more than once: "+method)
				require.True(t, strings.Contains(method, "resource.ResourceStore"))
			}
			// index server methods should be called here
			for method, count := range indexServer.Calls {
				require.Equal(t, 1, count, "method was called more than once: "+method)
				require.True(t, strings.Contains(method, "resource.ResourceIndex") || strings.Contains(method, "resource.ManagedObjectIndex"))
			}
		})
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
	s     *grpc.Server
}

func newTestServer() *testServer {
	return &testServer{
		Calls: make(map[string]int),
	}
}

func (s *testServer) resetCalls() {
	s.Calls = make(map[string]int)
}

func (s *testServer) handler(srv interface{}, serverStream grpc.ServerStream) error {
	fullMethodName, ok := grpc.MethodFromServerStream(serverStream)
	if ok {
		s.Calls[fullMethodName]++
	}
	return nil
}
