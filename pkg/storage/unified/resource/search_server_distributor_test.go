package resource

import (
	"context"
	"fmt"
	"net"
	"slices"
	"sync"
	"testing"
	"time"

	gokitlog "github.com/go-kit/log"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/consul"
	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type distributorTestProvider struct {
	grpcserver.Provider
	server *grpc.Server
}

func (p distributorTestProvider) GetServer() *grpc.Server { return p.server }

func TestSearchDistributorConvertsOwnErrors(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("enabled=%t", enabled), func(t *testing.T) {
			srv := grpc.NewServer()
			_, err := ProvideSearchDistributorServer(noop.NewTracerProvider().Tracer("test"),
				&setting.Cfg{UnifiedStorageGRPCErrorResultToStatus: enabled}, nil, nil,
				distributorTestProvider{server: srv})
			require.NoError(t, err)

			listener := bufconn.Listen(1024 * 1024)
			t.Cleanup(srv.Stop)
			go func() { _ = srv.Serve(listener) }()
			conn, err := grpc.NewClient("passthrough:///bufnet",
				grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }),
				grpc.WithTransportCredentials(insecure.NewCredentials()))
			require.NoError(t, err)
			t.Cleanup(func() { _ = conn.Close() })

			resp, err := resourcepb.NewResourceIndexClient(conn).RebuildIndexes(t.Context(), &resourcepb.RebuildIndexesRequest{
				Namespace: "default", Keys: []*resourcepb.ResourceKey{{Namespace: "other"}},
			})
			want := NewBadRequestError("key namespace does not match request namespace")
			if !enabled {
				require.NoError(t, err)
				require.True(t, proto.Equal(want, resp.GetError()))
				return
			}
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			details := status.Convert(err).Details()
			require.Len(t, details, 1)
			require.True(t, proto.Equal(want, details[0].(*resourcepb.ErrorResult)))
		})
	}
}

func TestSearchRingReadOpReplicaSetExtension(t *testing.T) {
	t.Run("replication factor 1", func(t *testing.T) {
		for _, state := range []ring.InstanceState{ring.LEAVING, ring.JOINING} {
			t.Run(state.String(), func(t *testing.T) {
				testRing, store := newSearchRingForTest(t, 1, ring.ACTIVE)

				requireSearchReplicaSetIDs(t, testRing, true, []string{"instance-a"})
				requireSearchReplicaSetIDs(t, testRing, false, []string{"instance-a"})

				updateSearchRingForTest(t, store, state)

				require.EventuallyWithT(t, func(c *assert.CollectT) {
					extendedIDs, err := searchReplicaSetIDs(testRing, true)
					require.NoError(c, err)
					require.Equal(c, []string{"instance-b"}, extendedIDs)

					_, err = searchReplicaSetIDs(testRing, false)
					require.ErrorContains(c, err, "at least 1 healthy replica required, could only find 0")
				}, time.Second, 10*time.Millisecond)
			})
		}
	})

	t.Run("replication factor 2", func(t *testing.T) {
		testRing, store := newSearchRingForTest(t, 2, ring.ACTIVE)

		requireSearchReplicaSetIDs(t, testRing, true, []string{"instance-a", "instance-b"})
		requireSearchReplicaSetIDs(t, testRing, false, []string{"instance-a", "instance-b"})

		for _, state := range []ring.InstanceState{ring.LEAVING, ring.JOINING} {
			t.Run(state.String(), func(t *testing.T) {
				updateSearchRingForTest(t, store, state)

				require.EventuallyWithT(t, func(c *assert.CollectT) {
					extendedIDs, err := searchReplicaSetIDs(testRing, true)
					require.NoError(c, err)
					require.Equal(c, []string{"instance-b", "instance-c"}, extendedIDs)

					noExtensionIDs, err := searchReplicaSetIDs(testRing, false)
					require.NoError(c, err)
					require.Equal(c, []string{"instance-b"}, noExtensionIDs)
				}, time.Second, 10*time.Millisecond)
			})
		}
	})
}

func TestDistributorCheckHealth(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name        string
		desc        *ring.Desc
		startRing   bool
		wantHealthy bool
		wantError   string
	}{
		{
			name:        "ring service not started",
			desc:        searchRingDescForTest(now, ring.ACTIVE),
			wantHealthy: false,
			wantError:   "ring is not running: state=New",
		},
		{
			name:        "empty descriptor",
			desc:        ring.NewDesc(),
			startRing:   true,
			wantHealthy: false,
			wantError:   "search server ring has no instances",
		},
		{
			name:        "active instances",
			desc:        searchRingDescForTest(now, ring.ACTIVE, ring.ACTIVE, ring.ACTIVE),
			startRing:   true,
			wantHealthy: true,
		},
		{
			name:        "joining instances",
			desc:        searchRingDescForTest(now, ring.JOINING, ring.JOINING, ring.JOINING),
			startRing:   true,
			wantHealthy: true,
		},
		{
			name:        "stale active instances",
			desc:        searchRingDescForTest(now.Add(-2*RingHeartbeatTimeout), ring.ACTIVE, ring.ACTIVE, ring.ACTIVE),
			startRing:   true,
			wantHealthy: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testRing, _ := newSearchRingWithDescForTest(t, 1, tt.desc, tt.startRing)
			ds := &distributorServer{ring: testRing}

			assertHealth := func(c *assert.CollectT) {
				healthy, err := ds.CheckHealth(t.Context())
				assert.Equal(c, tt.wantHealthy, healthy)
				if tt.wantError == "" {
					assert.NoError(c, err)
				} else {
					assert.ErrorContains(c, err, tt.wantError)
				}

				response, responseErr := ds.IsHealthy(t.Context(), &resourcepb.HealthCheckRequest{})
				assert.NoError(c, responseErr)
				if tt.wantHealthy {
					assert.Equal(c, resourcepb.HealthCheckResponse_SERVING, response.Status)
				} else {
					assert.Equal(c, resourcepb.HealthCheckResponse_NOT_SERVING, response.Status)
				}
			}

			require.EventuallyWithT(t, assertHealth, time.Second, 10*time.Millisecond)
		})
	}
}

// VectorSearch must forward the incoming gRPC metadata (which carries the access
// token) when distributing to a search instance. Dropping it makes the downstream
// authenticator reject the call with "missing required token".
func TestDistributorVectorSearchForwardsIncomingMetadata(t *testing.T) {
	testRing, _ := newSearchRingForTest(t, 1, ring.ACTIVE)

	var gotMD metadata.MD
	mockClient := NewMockResourceClient(t)
	mockClient.EXPECT().VectorSearch(mock.Anything, mock.Anything).RunAndReturn(
		func(ctx context.Context, _ *resourcepb.VectorSearchRequest, _ ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
			gotMD, _ = metadata.FromOutgoingContext(ctx)
			return &resourcepb.VectorSearchResponse{}, nil
		})

	pool := ringclient.NewPool(RingName, ringclient.PoolConfig{}, nil,
		ringclient.PoolInstFunc(func(ring.InstanceDesc) (ringclient.PoolClient, error) {
			return &RingClient{Client: mockClient}, nil
		}), nil, gokitlog.NewNopLogger())

	ds := &distributorServer{
		ring:           testRing,
		searchRingRead: newSearchRingReadOp(false),
		clientPool:     pool,
		tracing:        noop.NewTracerProvider().Tracer("test"),
		log:            log.NewNopLogger(),
	}

	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-access-token", "the-token"))
	_, err := ds.VectorSearch(ctx, &resourcepb.VectorSearchRequest{
		Key:   &resourcepb.ResourceKey{Namespace: "stacks-11794"},
		Query: "helloWorld",
	})
	require.NoError(t, err)

	require.Equal(t, []string{"the-token"}, gotMD.Get("x-access-token"))
}

// failoverTestClient records which instances were called and returns the
// error chosen by errFn for each call.
type failoverTestClient struct {
	ResourceClient
	id    string
	state *failoverTestState
}

type failoverTestState struct {
	mu    sync.Mutex
	calls []string
	errFn func(call int, id string) error
}

func (s *failoverTestState) record(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := len(s.calls)
	s.calls = append(s.calls, id)
	if s.errFn == nil {
		return nil
	}
	return s.errFn(n, id)
}

func (c *failoverTestClient) Search(context.Context, *resourcepb.ResourceSearchRequest, ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	if err := c.state.record(c.id); err != nil {
		return nil, err
	}
	return &resourcepb.ResourceSearchResponse{TotalHits: 1}, nil
}

func (c *failoverTestClient) RebuildIndexes(context.Context, *resourcepb.RebuildIndexesRequest, ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	if err := c.state.record(c.id); err != nil {
		return nil, err
	}
	return &resourcepb.RebuildIndexesResponse{RebuildCount: 1}, nil
}

func newFailoverTestDistributor(t *testing.T, replicationFactor int, state *failoverTestState) *distributorServer {
	t.Helper()
	states := make([]ring.InstanceState, max(3, replicationFactor))
	for i := range states {
		states[i] = ring.ACTIVE
	}
	testRing, _ := newSearchRingWithDescForTest(t, replicationFactor, searchRingDescForTest(time.Now(), states...), true)
	pool := ringclient.NewPool(RingName, ringclient.PoolConfig{}, nil,
		ringclient.PoolInstFunc(func(inst ring.InstanceDesc) (ringclient.PoolClient, error) {
			return &RingClient{Client: &failoverTestClient{id: inst.Id, state: state}}, nil
		}), nil, gokitlog.NewNopLogger())

	return &distributorServer{
		ring:           testRing,
		searchRingRead: newSearchRingReadOp(false),
		clientPool:     pool,
		tracing:        noop.NewTracerProvider().Tracer("test"),
		log:            log.NewNopLogger(),
	}
}

func TestDistributorSearchFailover(t *testing.T) {
	unavailable := status.Error(codes.Unavailable, "connection refused")
	exhausted := status.Error(codes.ResourceExhausted, "too many requests")
	invalid := status.Error(codes.InvalidArgument, "bad request")

	tests := []struct {
		name              string
		replicationFactor int
		// errors returned by each call, in call order
		errs        []error
		wantCalls   int
		wantErrCode codes.Code
	}{
		{name: "first replica succeeds", replicationFactor: 2, wantCalls: 1, wantErrCode: codes.OK},
		{name: "first replica unavailable", replicationFactor: 2, errs: []error{unavailable}, wantCalls: 2, wantErrCode: codes.OK},
		{name: "first replica exhausted", replicationFactor: 2, errs: []error{exhausted}, wantCalls: 2, wantErrCode: codes.OK},
		{name: "both replicas fail, first succeeds on retry", replicationFactor: 2, errs: []error{unavailable, exhausted}, wantCalls: 3, wantErrCode: codes.OK},
		{name: "all attempts fail", replicationFactor: 2, errs: []error{unavailable, unavailable, unavailable}, wantCalls: 3, wantErrCode: codes.Unavailable},
		{name: "non-retryable error", replicationFactor: 2, errs: []error{invalid}, wantCalls: 1, wantErrCode: codes.InvalidArgument},
		{name: "single replica retried", replicationFactor: 1, errs: []error{unavailable, unavailable}, wantCalls: 3, wantErrCode: codes.OK},
		{name: "every replica tried before retrying", replicationFactor: 4, errs: []error{unavailable, unavailable, unavailable}, wantCalls: 4, wantErrCode: codes.OK},
		{name: "four replicas all fail", replicationFactor: 4, errs: []error{unavailable, unavailable, unavailable, unavailable, unavailable}, wantCalls: 5, wantErrCode: codes.Unavailable},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := &failoverTestState{errFn: func(n int, _ string) error {
				if n < len(tt.errs) {
					return tt.errs[n]
				}
				return nil
			}}
			ds := newFailoverTestDistributor(t, tt.replicationFactor, state)

			resp, err := ds.Search(t.Context(), &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: "stacks-1"}},
			})
			require.Equal(t, tt.wantErrCode, status.Code(err))
			if tt.wantErrCode == codes.OK {
				require.Equal(t, int64(1), resp.TotalHits)
			}

			calls := state.calls
			require.Len(t, calls, tt.wantCalls)
			// Each replica is tried once before the first one is retried.
			for i := range calls {
				require.Equal(t, calls[i%tt.replicationFactor], calls[i])
			}
			require.Len(t, slices.Compact(slices.Sorted(slices.Values(calls))), min(len(calls), tt.replicationFactor))
		})
	}
}

func TestDistributorRebuildIndexesRetriesSameInstance(t *testing.T) {
	var failed bool
	state := &failoverTestState{errFn: func(_ int, id string) error {
		if id == "instance-a" && !failed {
			failed = true
			return status.Error(codes.Unavailable, "connection refused")
		}
		return nil
	}}
	ds := newFailoverTestDistributor(t, 1, state)

	resp, err := ds.RebuildIndexes(t.Context(), &resourcepb.RebuildIndexesRequest{Namespace: "stacks-1"})
	require.NoError(t, err)
	require.Nil(t, resp.Error)
	require.True(t, resp.ContactedAllInstances)
	require.Equal(t, int64(3), resp.RebuildCount)

	slices.Sort(state.calls)
	require.Equal(t, []string{"instance-a", "instance-a", "instance-b", "instance-c"}, state.calls)
}

func requireSearchReplicaSetIDs(t *testing.T, testRing *ring.Ring, extendReplicaSet bool, expectedIDs []string) {
	t.Helper()

	ids, err := searchReplicaSetIDs(testRing, extendReplicaSet)
	require.NoError(t, err)
	require.Equal(t, expectedIDs, ids)
}

func searchReplicaSetIDs(testRing *ring.Ring, extendReplicaSet bool) ([]string, error) {
	rs, err := testRing.GetWithOptions(50, newSearchRingReadOp(extendReplicaSet), ring.WithReplicationFactor(testRing.ReplicationFactor()))
	if err != nil {
		return nil, err
	}
	ids := rs.GetIDs()
	slices.Sort(ids)
	return ids, nil
}

func newSearchRingForTest(t *testing.T, replicationFactor int, firstInstanceState ring.InstanceState) (*ring.Ring, kv.Client) {
	t.Helper()
	return newSearchRingWithDescForTest(t, replicationFactor, searchRingDescForTest(time.Now(), firstInstanceState, ring.ACTIVE, ring.ACTIVE), true)
}

func newSearchRingWithDescForTest(t *testing.T, replicationFactor int, desc *ring.Desc, start bool) (*ring.Ring, kv.Client) {
	t.Helper()

	logger := gokitlog.NewNopLogger()
	store, closer := consul.NewInMemoryClient(ring.GetCodec(), logger, prometheus.NewRegistry())
	t.Cleanup(func() {
		require.NoError(t, closer.Close())
	})

	setSearchRingForTest(t, store, desc)

	testRing, err := ring.NewWithStoreClientAndStrategy(ring.Config{
		HeartbeatTimeout:  time.Minute,
		ReplicationFactor: replicationFactor,
	}, RingName, RingKey, store, ring.NewIgnoreUnhealthyInstancesReplicationStrategy(), prometheus.NewRegistry(), logger)
	require.NoError(t, err)

	if start {
		require.NoError(t, services.StartAndAwaitRunning(t.Context(), testRing))
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), time.Second)
			defer cancel()
			require.NoError(t, services.StopAndAwaitTerminated(ctx, testRing))
		})
	}

	return testRing, store
}

func updateSearchRingForTest(t *testing.T, store kv.Client, firstInstanceState ring.InstanceState) {
	t.Helper()
	setSearchRingForTest(t, store, searchRingDescForTest(time.Now(), firstInstanceState, ring.ACTIVE, ring.ACTIVE))
}

func setSearchRingForTest(t *testing.T, store kv.Client, desc *ring.Desc) {
	t.Helper()

	err := store.CAS(t.Context(), RingKey, func(interface{}) (interface{}, bool, error) {
		return desc, false, nil
	})
	require.NoError(t, err)
}

func searchRingDescForTest(heartbeat time.Time, states ...ring.InstanceState) *ring.Desc {
	desc := ring.NewDesc()
	for i, state := range states {
		id := fmt.Sprintf("instance-%c", 'a'+rune(i))
		desc.AddIngester(id, id, "", []uint32{uint32((i + 1) * 100)}, state, heartbeat, false, time.Time{}, nil)
	}
	return desc
}
