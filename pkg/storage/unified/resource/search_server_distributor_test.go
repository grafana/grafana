package resource

import (
	"context"
	"fmt"
	"slices"
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
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

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
	}

	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-access-token", "the-token"))
	_, err := ds.VectorSearch(ctx, &resourcepb.VectorSearchRequest{
		Key:   &resourcepb.ResourceKey{Namespace: "stacks-11794"},
		Query: "helloWorld",
	})
	require.NoError(t, err)

	require.Equal(t, []string{"the-token"}, gotMD.Get("x-access-token"))
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
