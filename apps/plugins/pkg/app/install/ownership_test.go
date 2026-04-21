package install

import (
	"context"
	"errors"
	"hash/fnv"
	"testing"
	"time"

	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
)

func TestHashRingOwnershipFilter_OwnsPlugin(t *testing.T) {
	plugin := newTestPlugin("test-plugin", "1.0.0")
	plugin.Namespace = "plugins"

	readRing := &fakeOwnershipReadRing{
		state: services.Running,
		set: ring.ReplicationSet{
			Instances: []ring.InstanceDesc{{Addr: "10.0.0.1:7946"}},
		},
	}
	filter := &HashRingOwnershipFilter{
		readRing: readRing,
		instance: fakeOwnershipInstance{addr: "10.0.0.1:7946"},
	}

	owns, err := filter.OwnsPlugin(t.Context(), plugin)

	require.NoError(t, err)
	require.True(t, owns)
	require.Equal(t, expectedShardHash(plugin.Namespace, plugin.Name), readRing.lastKey)
}

func TestHashRingOwnershipFilter_DoesNotOwnPlugin(t *testing.T) {
	filter := &HashRingOwnershipFilter{
		readRing: &fakeOwnershipReadRing{
			state: services.Running,
			set: ring.ReplicationSet{
				Instances: []ring.InstanceDesc{{Addr: "10.0.0.2:7946"}},
			},
		},
		instance: fakeOwnershipInstance{addr: "10.0.0.1:7946"},
	}

	owns, err := filter.OwnsPlugin(t.Context(), newTestPlugin("test-plugin", "1.0.0"))

	require.NoError(t, err)
	require.False(t, owns)
}

func TestHashRingOwnershipFilter_ReturnsRingErrors(t *testing.T) {
	expectedErr := errors.New("lookup failed")
	filter := &HashRingOwnershipFilter{
		readRing: &fakeOwnershipReadRing{
			state: services.Running,
			err:   expectedErr,
		},
		instance: fakeOwnershipInstance{addr: "10.0.0.1:7946"},
	}

	owns, err := filter.OwnsPlugin(t.Context(), newTestPlugin("test-plugin", "1.0.0"))

	require.False(t, owns)
	require.ErrorIs(t, err, expectedErr)
}

func TestHashRingOwnershipFilter_ReturnsErrorWhenRingIsNotRunning(t *testing.T) {
	filter := &HashRingOwnershipFilter{
		readRing: &fakeOwnershipReadRing{state: services.Starting},
		instance: fakeOwnershipInstance{addr: "10.0.0.1:7946"},
	}

	owns, err := filter.OwnsPlugin(t.Context(), newTestPlugin("test-plugin", "1.0.0"))

	require.False(t, owns)
	require.ErrorContains(t, err, "child reconciler ring is not running")
}

func TestHashChildReconcilerShardKey_UsesNamespaceAndName(t *testing.T) {
	plugin := newTestPlugin("test-plugin", "1.0.0")
	plugin.Namespace = "plugins"

	require.Equal(t, expectedShardHash(plugin.Namespace, plugin.Name), hashChildReconcilerShardKey(plugin))
}

func TestHashRingOwnershipFilter_WaitUntilReady(t *testing.T) {
	t.Run("returns once ready", func(t *testing.T) {
		filter := &HashRingOwnershipFilter{ready: make(chan struct{})}
		close(filter.ready)

		require.NoError(t, filter.WaitUntilReady(t.Context()))
	})

	t.Run("returns context error while waiting", func(t *testing.T) {
		filter := &HashRingOwnershipFilter{ready: make(chan struct{})}
		ctx, cancel := context.WithTimeout(t.Context(), 10*time.Millisecond)
		defer cancel()

		err := filter.WaitUntilReady(ctx)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})
}

type fakeOwnershipReadRing struct {
	state   services.State
	set     ring.ReplicationSet
	err     error
	lastKey uint32
}

func (f *fakeOwnershipReadRing) GetWithOptions(key uint32, _ ring.Operation, _ ...ring.Option) (ring.ReplicationSet, error) {
	f.lastKey = key
	if f.err != nil {
		return ring.ReplicationSet{}, f.err
	}
	return f.set, nil
}

func (f *fakeOwnershipReadRing) State() services.State {
	return f.state
}

type fakeOwnershipInstance struct {
	addr string
}

func (f fakeOwnershipInstance) GetInstanceAddr() string {
	return f.addr
}

func expectedShardHash(namespace, name string) uint32 {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(namespace))
	_, _ = hasher.Write([]byte("/"))
	_, _ = hasher.Write([]byte(name))
	return hasher.Sum32()
}
