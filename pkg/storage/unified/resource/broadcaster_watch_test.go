package resource

import (
	"context"
	"errors"
	"io"
	"sync"
	"testing"
	"testing/synctest"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func cacheEvent(gr GroupResource, rv int64) *WrittenEvent {
	return &WrittenEvent{Key: &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource}, ResourceVersion: rv}
}

func newWatchBroadcaster(t *testing.T, floor int64, seed ...*WrittenEvent) (*broadcaster[*WrittenEvent], chan<- *WrittenEvent) {
	t.Helper()
	input := make(chan *WrittenEvent)
	high := floor
	if len(seed) > 0 {
		high = seed[len(seed)-1].ResourceVersion
	}
	b := newBroadcasterWithSizes(t.Context(), input, watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), nil,
		func(context.Context) (cacheSeed[*WrittenEvent], error) {
			return cacheSeed[*WrittenEvent]{items: seed, initialCacheFloor: floor, highestRV: high, identity: writtenEventIdentity}, nil
		})
	require.NoError(t, b.waitReady(t.Context()))
	return b, input
}

func checkedWatch(t *testing.T, b *broadcaster[*WrittenEvent], gr GroupResource, since int64) (<-chan *WrittenEvent, error) {
	t.Helper()
	return b.subscribeWatch(t.Context(), "test", gr.Resource, &watchResume{groupResource: gr, since: since, requestedRV: since})
}

func TestWatchCacheFloors(t *testing.T) {
	playlist := GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
	plugin := GroupResource{Group: "plugin.grafana.app", Resource: "playlists"}
	unknown := GroupResource{Group: "never.grafana.app", Resource: "playlists"}
	b, input := newWatchBroadcaster(t, 50, cacheEvent(plugin, 50), cacheEvent(playlist, 100))

	check := func(gr GroupResource, since int64, expired bool) {
		t.Helper()
		ch, err := checkedWatch(t, b, gr, since)
		if expired {
			require.True(t, IsResourceVersionExpired(err), "expected expiry, got %v", err)
			require.Nil(t, ch)
		} else {
			require.NoError(t, err)
			b.Unsubscribe(ch)
		}
	}
	check(playlist, 49, true)
	check(unknown, 49, true)
	check(unknown, 50, false)
	check(playlist, 50, false)

	// The playlist floor must survive even when no playlist events remain.
	for rv := int64(101); rv <= 1100; rv++ {
		input <- cacheEvent(plugin, rv)
	}
	check(playlist, 99, true)
	check(playlist, 100, false)
	check(plugin, 100, true)
	check(unknown, 50, false)

	input <- cacheEvent(playlist, 1101)
	for rv := int64(1102); rv <= 1601; rv++ {
		input <- cacheEvent(plugin, rv)
	}
	check(playlist, 100, true)
	check(playlist, 1100, true)
	check(playlist, 1101, false)

	replay, err := checkedWatch(t, b, plugin, 1200)
	require.NoError(t, err)
	defer b.Unsubscribe(replay)
	for rv := int64(1102); rv <= 1601; rv++ {
		require.Equal(t, rv, (<-replay).ResourceVersion)
	}
}

func TestRingBufferEvictionWraparound(t *testing.T) {
	ring := newRingBuffer[int](defaultCacheSize)
	for i := 0; i < 4*defaultCacheSize; i++ {
		evicted, ok := ring.add(i)
		require.Equal(t, i >= defaultCacheSize, ok)
		if ok {
			require.Equal(t, i-defaultCacheSize, evicted)
		}
	}
	require.Equal(t, defaultCacheSize, ring.len)
	dst := make(chan int, defaultCacheSize)
	require.True(t, ring.readInto(dst))
	for i := 3 * defaultCacheSize; i < 4*defaultCacheSize; i++ {
		require.Equal(t, i, <-dst)
	}
}

func TestCheckedWatchRequiresSeededCache(t *testing.T) {
	metrics := newBroadcasterMetrics(prometheus.NewRegistry())
	b := newBroadcasterWithSizes(t.Context(), make(chan int), watchChanSize, defaultOverflowCap, metrics, nil, nil)

	stream, err := b.subscribeWatch(t.Context(), "resume", "r", &watchResume{since: 50, requestedRV: 50})
	require.ErrorContains(t, err, "checked resume requires a seeded watch cache")
	require.Nil(t, stream)
	requireMetricValue(t, metrics.SubscriptionsTotal.WithLabelValues("r", subscriptionResultReplayFailed), 1)
	requireMetricValue(t, metrics.Subscribers.WithLabelValues("r"), 0)

	stream, err = b.subscribeWatch(t.Context(), "no resume", "r", nil)
	require.NoError(t, err)
	b.Unsubscribe(stream)
}

func TestCheckedWatchConcurrentEviction(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	for range 50 {
		seed := make([]*WrittenEvent, defaultCacheSize)
		for i := range seed {
			seed[i] = cacheEvent(gr, int64(100+i))
		}
		b, input := newWatchBroadcaster(t, 100, seed...)
		done := make(chan struct{})
		go func() {
			input <- cacheEvent(gr, 600)
			input <- cacheEvent(gr, 601)
			close(done)
		}()
		stream, err := checkedWatch(t, b, gr, 100)
		<-done
		if err != nil {
			require.True(t, IsResourceVersionExpired(err))
			continue
		}
		// Admission before eviction owns all subsequent events independently
		// of the shared ring, even though a new resume would now expire.
		for rv := int64(101); rv <= 601; rv++ {
			event := <-stream
			if event.ResourceVersion == 100 {
				event = <-stream
			}
			require.Equal(t, rv, event.ResourceVersion)
		}
		b.Unsubscribe(stream)
	}
}

func TestCheckedWatchCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		b, _ := newWatchBroadcaster(t, 50)
		var wg sync.WaitGroup
		for range 250 {
			ctx, cancel := context.WithCancel(t.Context())
			wg.Go(func() {
				stream, err := b.subscribeWatch(ctx, "cancel", "r", nil)
				if err == nil {
					b.Unsubscribe(stream)
				}
			})
			cancel()
		}
		wg.Wait()
		synctest.Wait()
		require.Empty(t, b.subs)
	})
}

func TestWatchSeedReadinessAndGenericSubscribers(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		input := make(chan *WrittenEvent, 2)
		gr := GroupResource{Group: "g", Resource: "r"}
		release := make(chan struct{})
		b := newBroadcasterWithSizes(t.Context(), input, watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), nil,
			func(ctx context.Context) (cacheSeed[*WrittenEvent], error) {
				select {
				case <-ctx.Done():
					return cacheSeed[*WrittenEvent]{}, ctx.Err()
				case <-release:
					return cacheSeed[*WrittenEvent]{items: []*WrittenEvent{cacheEvent(gr, 50)}, initialCacheFloor: 50, highestRV: 50, identity: writtenEventIdentity}, nil
				}
			})
		stream, err := b.Subscribe(t.Context(), "internal", "r")
		require.NoError(t, err)
		input <- cacheEvent(gr, 50)
		input <- cacheEvent(gr, 51)
		synctest.Wait()
		require.Empty(t, stream)
		select {
		case <-b.ready:
			t.Fatal("cache became ready before initialization finished")
		default:
		}
		close(release)
		require.NoError(t, b.waitReady(t.Context()))
		require.Equal(t, int64(50), (<-stream).ResourceVersion)
		require.Equal(t, int64(51), (<-stream).ResourceVersion)
		synctest.Wait()
		require.Empty(t, stream)
	})
}

func TestBroadcasterInitializationFailureClosesQueuedSubscribers(t *testing.T) {
	for _, failure := range []string{"load", "install", "cancel"} {
		t.Run(failure, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				release := make(chan struct{})
				loadErr := errors.New("seed load failed")
				captureStopped := make(chan struct{})
				b := newBroadcasterWithSizes(ctx, make(chan int), watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), nil,
					func(ctx context.Context) (cacheSeed[int], error) {
						context.AfterFunc(ctx, func() { close(captureStopped) })
						select {
						case <-ctx.Done():
							return cacheSeed[int]{}, ctx.Err()
						case <-release:
							if failure == "load" {
								return cacheSeed[int]{}, loadErr
							}
							return cacheSeed[int]{items: make([]int, defaultCacheSize+1)}, nil
						}
					})
				streams := make([]<-chan int, internalChanSize)
				for i := range streams {
					var err error
					streams[i], err = b.Subscribe(t.Context(), "internal", "r")
					require.NoError(t, err)
				}
				blocked := make(chan error, 1)
				go func() {
					_, err := b.Subscribe(t.Context(), "blocked", "r")
					blocked <- err
				}()
				synctest.Wait()
				require.Empty(t, blocked)
				if failure == "cancel" {
					cancel()
				} else {
					close(release)
				}
				err := b.waitReady(t.Context())
				switch failure {
				case "load":
					require.ErrorIs(t, err, loadErr)
				case "install":
					require.ErrorContains(t, err, "cache capacity")
				case "cancel":
					require.ErrorIs(t, err, context.Canceled)
				}
				<-captureStopped
				require.ErrorIs(t, <-blocked, io.EOF)
				for _, stream := range streams {
					_, ok := <-stream
					require.False(t, ok)
				}
				for range 10 {
					stream, err := b.Subscribe(t.Context(), "after failure", "r")
					require.ErrorIs(t, err, io.EOF)
					require.Nil(t, stream)
				}
			})
		})
	}
}

func TestCheckedWatchCancellationDuringInitialization(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		b := newBroadcasterWithSizes(t.Context(), make(chan int), watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), nil,
			func(ctx context.Context) (cacheSeed[int], error) {
				<-ctx.Done()
				return cacheSeed[int]{}, ctx.Err()
			})
		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() {
			_, err := b.subscribeWatch(ctx, "cancel", "r", nil)
			done <- err
		}()
		synctest.Wait()
		cancel()
		require.ErrorIs(t, <-done, context.Canceled)
		require.Empty(t, b.subscribe)
	})
}
