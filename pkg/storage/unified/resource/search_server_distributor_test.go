package resource

import (
	"context"
	"slices"
	"testing"
	"time"

	gokitlog "github.com/go-kit/log"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/consul"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

	logger := gokitlog.NewNopLogger()
	store, closer := consul.NewInMemoryClient(ring.GetCodec(), logger, prometheus.NewRegistry())
	t.Cleanup(func() {
		require.NoError(t, closer.Close())
	})

	updateSearchRingForTest(t, store, firstInstanceState)

	testRing, err := ring.NewWithStoreClientAndStrategy(ring.Config{
		HeartbeatTimeout:  time.Minute,
		ReplicationFactor: replicationFactor,
	}, RingName, RingKey, store, ring.NewIgnoreUnhealthyInstancesReplicationStrategy(), prometheus.NewRegistry(), logger)
	require.NoError(t, err)

	require.NoError(t, services.StartAndAwaitRunning(t.Context(), testRing))
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), time.Second)
		defer cancel()
		require.NoError(t, services.StopAndAwaitTerminated(ctx, testRing))
	})

	return testRing, store
}

func updateSearchRingForTest(t *testing.T, store kv.Client, firstInstanceState ring.InstanceState) {
	t.Helper()

	desc := ring.NewDesc()
	now := time.Now()
	desc.AddIngester("instance-a", "instance-a", "", []uint32{100}, firstInstanceState, now, false, time.Time{}, nil)
	desc.AddIngester("instance-b", "instance-b", "", []uint32{200}, ring.ACTIVE, now, false, time.Time{}, nil)
	desc.AddIngester("instance-c", "instance-c", "", []uint32{300}, ring.ACTIVE, now, false, time.Time{}, nil)

	err := store.CAS(t.Context(), RingKey, func(interface{}) (interface{}, bool, error) {
		return desc, false, nil
	})
	require.NoError(t, err)
}
