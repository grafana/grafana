package unified

import (
	"context"
	"fmt"
	"maps"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/resolver"
	"google.golang.org/grpc/resolver/manual"
	"google.golang.org/grpc/status"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func clientIdentityCounts(t *testing.T) map[string]float64 {
	t.Helper()
	families, err := prometheus.DefaultGatherer.Gather()
	require.NoError(t, err)
	counts := map[string]float64{}
	for _, family := range families {
		if family.GetName() == "grafana_unified_storage_client_identity_total" {
			for _, metric := range family.Metric {
				counts[metric.Label[0].GetValue()] = metric.GetCounter().GetValue()
			}
		}
	}
	return counts
}

func TestForwardSearchUnaryInterceptor(t *testing.T) {
	for _, tc := range []struct {
		name    string
		info    *identity.StaticRequester
		cancel  bool
		expired bool
		code    codes.Code
	}{
		{name: "classic", info: &identity.StaticRequester{AccessToken: "original-access", IDToken: "original-id"}},
		{name: "obo", info: &identity.StaticRequester{AccessToken: "original-obo"}},
		{name: "service", info: &identity.StaticRequester{Type: authlib.TypeAccessPolicy, AccessToken: "original-service"}},
		{name: "missing auth info", code: codes.Unauthenticated},
		{name: "missing access token", info: &identity.StaticRequester{IDToken: "id-only"}, code: codes.Unauthenticated},
		{name: "cancelled", info: &identity.StaticRequester{AccessToken: "access"}, cancel: true, code: codes.Canceled},
		{name: "expired deadline", info: &identity.StaticRequester{AccessToken: "access"}, expired: true, code: codes.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			if tc.cancel {
				cancel()
			}
			if tc.expired {
				var stop context.CancelFunc
				ctx, stop = context.WithDeadline(ctx, time.Now().Add(-time.Second))
				defer stop()
			}
			if tc.info != nil {
				ctx = authlib.WithAuthInfo(ctx, tc.info)
			}
			original := metadata.Pairs("x-access-token", "stale-access", "x-access-token", "another-access", "x-id-token", "stale-id", "route", "search", "traceparent", "trace")
			ctx = metadata.NewOutgoingContext(ctx, original)
			ctx = metadata.NewIncomingContext(ctx, metadata.Pairs("x-access-token", "unverified-access", "x-id-token", "unverified-id"))
			before := clientIdentityCounts(t)
			called := false
			check := func(out context.Context) {
				called = true
				md, _ := metadata.FromOutgoingContext(out)
				require.Equal(t, []string{tc.info.AccessToken}, md.Get("x-access-token"))
				if tc.info.IDToken == "" {
					require.Empty(t, md.Get("x-id-token"))
				} else {
					require.Equal(t, []string{tc.info.IDToken}, md.Get("x-id-token"))
				}
				require.Equal(t, []string{"search"}, md.Get("route"))
				require.Equal(t, []string{"trace"}, md.Get("traceparent"))
				require.Equal(t, ctx.Done(), out.Done())
				wantDeadline, wantOK := ctx.Deadline()
				gotDeadline, gotOK := out.Deadline()
				require.Equal(t, wantOK, gotOK)
				require.Equal(t, wantDeadline, gotDeadline)
				md.Set("route", "modified")
			}
			err := forwardSearchUnaryInterceptor(ctx, "Search", nil, nil, nil, func(out context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
				check(out)
				return status.Error(codes.PermissionDenied, "receiver denied")
			})
			after := clientIdentityCounts(t)
			if tc.code == codes.OK {
				require.True(t, called)
				require.Equal(t, codes.PermissionDenied, status.Code(err))
				require.Equal(t, before["forwarded"]+1, after["forwarded"])
			} else {
				require.False(t, called)
				require.Equal(t, tc.code, status.Code(err))
				require.Equal(t, before["forwarded"], after["forwarded"])
			}
			delete(before, "forwarded")
			delete(after, "forwarded")
			require.Equal(t, before, after)
			require.Equal(t, metadata.Pairs("x-access-token", "stale-access", "x-access-token", "another-access", "x-id-token", "stale-id", "route", "search", "traceparent", "trace"), original)
		})
	}
}

func TestInternalSearchForwardingConfiguration(t *testing.T) {
	searchServer := createTestGrpcServer(t, "127.0.0.1:0")
	t.Cleanup(searchServer.s.Stop)
	cfg := setting.NewCfg()
	cfg.Env = "production"
	cfg.EnableSearchClient = true
	cfg.SearchClientForwardAuthEnabled = true
	cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue(searchServer.addr)
	features := featuremgmt.WithFeatures(featuremgmt.FlagAppPlatformGrpcClientAuth)

	client, err := NewStorageApiSearchClient(cfg, features)
	require.NoError(t, err)
	require.NotNil(t, client)

	_, err = NewSearchClient(cfg, features)
	require.ErrorContains(t, err, "token exchange url is required")
	_, err = NewStorageApiSearchClient(cfg, featuremgmt.WithFeatures())
	require.ErrorContains(t, err, "requires appPlatformGrpcClientAuth")

	cfg.SearchClientForwardAuthEnabled = false
	_, err = NewStorageApiSearchClient(cfg, features)
	require.ErrorContains(t, err, "token exchange url is required")

	cfg.SearchClientForwardAuthEnabled = true
	cfg.EnableSearchClient = false
	client, err = NewStorageApiSearchClient(cfg, featuremgmt.WithFeatures())
	require.NoError(t, err)
	require.Nil(t, client)
}

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

func TestNewStandaloneRemoteResourceClientWithAuthRequiresAddress(t *testing.T) {
	cfg := setting.NewCfg()

	_, err := NewStandaloneRemoteResourceClientWithAuth(cfg, nil, nil, resource.RemoteResourceClientConfig{})
	require.ErrorContains(t, err, "address")
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
	grpc_health_v1.RegisterHealthServer(s, health.NewServer())

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
	maps.Copy(calls, s.Calls)

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

func TestGRPCConnHealthInitiallyNotServing(t *testing.T) {
	server := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING, true)
	conn := newClientHealthConn(t, server.address)

	ctx, cancel := context.WithTimeout(t.Context(), 500*time.Millisecond)
	defer cancel()
	_, err := resourcepb.NewDiagnosticsClient(conn).IsHealthy(ctx, &resourcepb.HealthCheckRequest{}, grpc.WaitForReady(true)) //nolint:staticcheck
	assert.Equal(t, codes.DeadlineExceeded, status.Code(err), "requests must wait while the endpoint is NOT_SERVING")
	require.Zero(t, server.calls.Load(), "an unhealthy endpoint must not receive application requests")
}

func TestGRPCConnHealthTransitions(t *testing.T) {
	server := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, true)
	conn := newClientHealthConn(t, server.address)
	requireClientHealthRPC(t, conn)

	server.health.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	require.Eventually(t, func() bool {
		return conn.GetState() == connectivity.TransientFailure
	}, 5*time.Second, 10*time.Millisecond, "NOT_SERVING must remove the only endpoint from the ready picker")

	before := server.calls.Load()
	ctx, cancel := context.WithTimeout(t.Context(), 500*time.Millisecond)
	defer cancel()
	_, err := resourcepb.NewDiagnosticsClient(conn).IsHealthy(ctx, &resourcepb.HealthCheckRequest{}, grpc.WaitForReady(true)) //nolint:staticcheck
	require.Equal(t, codes.DeadlineExceeded, status.Code(err))
	require.Equal(t, before, server.calls.Load())

	server.health.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)
	requireClientHealthRPC(t, conn)
	require.Equal(t, before+1, server.calls.Load(), "a recovered endpoint must receive requests again")
}

func TestGRPCConnHealthBalancesOnlyServingEndpoints(t *testing.T) {
	first := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, true)
	second := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, true)
	conn := newClientHealthConn(t, first.address, second.address)

	requireClientHealthEventually(t, func() bool {
		requireClientHealthRPC(t, conn)
		return first.calls.Load() > 0 && second.calls.Load() > 0
	}, "both healthy endpoints must participate in round robin")

	first.health.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	requireClientHealthEventually(t, func() bool {
		before := first.calls.Load()
		for range 10 {
			requireClientHealthRPC(t, conn)
		}
		return first.calls.Load() == before
	}, "requests must move exclusively to the remaining healthy endpoint")

	before := first.calls.Load()
	first.health.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)
	requireClientHealthEventually(t, func() bool {
		requireClientHealthRPC(t, conn)
		return first.calls.Load() > before
	}, "a recovered endpoint must rejoin round robin")
}

func TestGRPCConnHealthUnimplementedCompatibility(t *testing.T) {
	server := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, false)
	conn := newClientHealthConn(t, server.address)

	requireClientHealthRPC(t, conn)
	require.Equal(t, int64(1), server.calls.Load(), "servers without the health service must remain usable")
}

func TestGRPCConnHealthGracefulShutdown(t *testing.T) {
	server := startClientHealthServer(t, grpc_health_v1.HealthCheckResponse_SERVING, true)
	conn := newClientHealthConn(t, server.address)
	requireClientHealthRPC(t, conn)

	server.health.Shutdown()
	done := make(chan struct{})
	go func() {
		server.grpc.GracefulStop()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("automatic health watches must not block graceful shutdown")
	}
}

type clientHealthServer struct {
	resourcepb.UnimplementedDiagnosticsServer
	address string
	grpc    *grpc.Server
	health  *health.Server
	calls   atomic.Int64
}

func (s *clientHealthServer) IsHealthy(context.Context, *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	s.calls.Add(1)
	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
}

func startClientHealthServer(t *testing.T, serving grpc_health_v1.HealthCheckResponse_ServingStatus, registerHealth bool) *clientHealthServer {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	s := &clientHealthServer{address: listener.Addr().String(), grpc: grpc.NewServer(), health: health.NewServer()}
	s.health.SetServingStatus("", serving)
	if registerHealth {
		grpc_health_v1.RegisterHealthServer(s.grpc, s.health)
	}
	resourcepb.RegisterDiagnosticsServer(s.grpc, s)
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = s.grpc.Serve(listener)
	}()
	t.Cleanup(func() {
		s.grpc.Stop()
		_ = listener.Close()
		<-done
	})
	return s
}

var clientHealthResolverID atomic.Uint64

func newClientHealthConn(t *testing.T, addresses ...string) *grpc.ClientConn {
	t.Helper()
	// A unique resolver lets the production constructor discover multiple endpoints
	// without DNS or test-only dial options.
	r := manual.NewBuilderWithScheme(fmt.Sprintf("unified-health-%d", clientHealthResolverID.Add(1)))
	state := resolver.State{}
	for _, address := range addresses {
		state.Addresses = append(state.Addresses, resolver.Address{Addr: address})
	}
	r.InitialState(state)
	resolver.Register(r)
	conn, err := grpcConn(r.Scheme()+":///test", newClientMetrics(prometheus.NewRegistry()), 0)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return conn
}

// Run RPC assertions on the test goroutine so a failed assertion finishes before
// cleanup closes the connection.
func requireClientHealthEventually(t *testing.T, condition func() bool, message string) {
	t.Helper()
	timer := time.NewTimer(5 * time.Second)
	defer timer.Stop()
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		if condition() {
			return
		}
		select {
		case <-timer.C:
			t.Fatal(message)
		case <-ticker.C:
		}
	}
}

func requireClientHealthRPC(t *testing.T, conn *grpc.ClientConn) {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	_, err := resourcepb.NewDiagnosticsClient(conn).IsHealthy(ctx, &resourcepb.HealthCheckRequest{}, grpc.WaitForReady(true)) //nolint:staticcheck
	require.NoError(t, err)
}
