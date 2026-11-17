package resource

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// waitReady lets tests observe the current initialization attempt without
// triggering a retry, unlike ensureReady.
func (b *broadcaster[T]) waitReady(ctx context.Context) error {
	b.initMu.Lock()
	attempt := b.initAttempt
	select {
	case <-attempt.done:
		err := attempt.err
		b.initMu.Unlock()
		return err
	default:
		b.initMu.Unlock()
	}
	return b.waitForInitialization(ctx, attempt)
}

func cacheEvent(gr GroupResource, rv int64) *WrittenEvent {
	return &WrittenEvent{Key: &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource}, ResourceVersion: rv}
}

func newWatchBroadcaster(t *testing.T, floor int64, seed ...*WrittenEvent) (*broadcaster[*WrittenEvent], chan<- *WrittenEvent) {
	t.Helper()
	input := make(chan *WrittenEvent)
	b := newBroadcasterWithSizes(t.Context(), input, watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), writtenEventIdentity,
		&seededCacheConfig[*WrittenEvent]{initialize: func(context.Context) (cacheSeed[*WrittenEvent], error) {
			return cacheSeed[*WrittenEvent]{items: seed, initialCacheFloor: floor}, nil
		}})
	require.NoError(t, b.waitReady(t.Context()))
	return b, input
}

func checkedWatch(t *testing.T, b *broadcaster[*WrittenEvent], gr GroupResource, since int64) (<-chan *WrittenEvent, error) {
	t.Helper()
	stream, _, err := b.subscribeWatch(t.Context(), "test", gr, &watchResume{since: since, requestedRV: since})
	return stream, err
}

var intGR = GroupResource{Resource: "r"}

// intIdentity routes every int to intGR with the value as its RV.
func intIdentity(v int) (GroupResource, int64) {
	return intGR, int64(v)
}

func intResume(since int64) *watchResume {
	return &watchResume{since: since, requestedRV: since}
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

	// Bursts in another group/resource evict only that group/resource's events.
	for rv := int64(101); rv <= 1100; rv++ {
		input <- cacheEvent(plugin, rv)
	}
	check(playlist, 49, true)
	check(playlist, 50, false)
	check(plugin, 599, true)
	check(plugin, 600, false)
	check(unknown, 50, false)

	// The playlist floor survives even when no playlist events remain.
	for rv := int64(1101); rv <= 1600; rv++ {
		input <- cacheEvent(playlist, rv)
	}
	check(playlist, 99, true)
	check(playlist, 100, false)
	input <- cacheEvent(playlist, 1601)
	check(playlist, 1100, true)
	check(playlist, 1101, false)
	for rv := int64(1602); rv <= 1701; rv++ {
		input <- cacheEvent(plugin, rv)
	}

	replay, err := checkedWatch(t, b, plugin, 1200)
	require.NoError(t, err)
	defer b.Unsubscribe(replay)
	for _, want := range [][2]int64{{701, 1100}, {1602, 1701}} {
		for rv := want[0]; rv <= want[1]; rv++ {
			require.Equal(t, rv, (<-replay).ResourceVersion)
		}
	}
	require.Empty(t, replay, "replay must not include other group/resources")
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
				stream, _, err := b.subscribeWatch(ctx, "cancel", intGR, nil)
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

func TestCheckedWatchWaitsForSeed(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		input := make(chan *WrittenEvent, 2)
		gr := GroupResource{Group: "g", Resource: "r"}
		release := make(chan struct{})
		b := newBroadcasterWithSizes(t.Context(), input, watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), writtenEventIdentity,
			&seededCacheConfig[*WrittenEvent]{initialize: func(ctx context.Context) (cacheSeed[*WrittenEvent], error) {
				select {
				case <-ctx.Done():
					return cacheSeed[*WrittenEvent]{}, ctx.Err()
				case <-release:
					return cacheSeed[*WrittenEvent]{items: []*WrittenEvent{cacheEvent(gr, 50)}, initialCacheFloor: 50}, nil
				}
			}})
		type result struct {
			stream <-chan *WrittenEvent
			err    error
		}
		subscribed := make(chan result, 1)
		go func() {
			stream, _, err := b.subscribeWatch(t.Context(), "watch", gr, &watchResume{since: 50, requestedRV: 50})
			subscribed <- result{stream, err}
		}()
		input <- cacheEvent(gr, 51)
		input <- cacheEvent(gr, 52)
		synctest.Wait()
		require.Empty(t, subscribed, "checked watches must wait for the seed")
		close(release)
		res := <-subscribed
		require.NoError(t, res.err)
		for _, want := range []int64{50, 51, 52} {
			require.Equal(t, want, (<-res.stream).ResourceVersion)
		}
		synctest.Wait()
		require.Empty(t, res.stream)
		b.Unsubscribe(res.stream)
	})
}
func TestBroadcasterRetriesInitializationOnNextCheckedWatch(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		input := make(chan int)
		firstRelease := make(chan struct{})
		secondRelease := make(chan struct{})
		loadErr := errors.New("seed load failed")
		var attempts atomic.Int32
		b := newBroadcasterWithSizes(ctx, input, watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), intIdentity,
			&seededCacheConfig[int]{initialize: func(ctx context.Context) (cacheSeed[int], error) {
				switch attempts.Add(1) {
				case 1:
					select {
					case <-ctx.Done():
						return cacheSeed[int]{}, ctx.Err()
					case <-firstRelease:
						return cacheSeed[int]{}, loadErr
					}
				default:
					select {
					case <-ctx.Done():
						return cacheSeed[int]{}, ctx.Err()
					case <-secondRelease:
						return cacheSeed[int]{items: []int{50}}, nil
					}
				}
			}})

		first := make(chan error, 1)
		go func() {
			_, _, err := b.subscribeWatch(t.Context(), "first", intGR, nil)
			first <- err
		}()
		synctest.Wait()
		close(firstRelease)
		require.ErrorIs(t, <-first, loadErr)
		require.Equal(t, int32(1), attempts.Load())

		type result struct {
			stream <-chan int
			err    error
		}
		const watcherCount = 10
		second := make(chan result, watcherCount)
		for range watcherCount {
			go func() {
				stream, _, err := b.subscribeWatch(t.Context(), "second", intGR, intResume(0))
				second <- result{stream: stream, err: err}
			}()
		}
		synctest.Wait()
		require.Equal(t, int32(2), attempts.Load(), "concurrent watches must share one retry")
		close(secondRelease)
		streams := make([]<-chan int, 0, watcherCount)
		for range watcherCount {
			res := <-second
			require.NoError(t, res.err)
			require.Equal(t, 50, <-res.stream)
			streams = append(streams, res.stream)
		}

		input <- 51
		for _, stream := range streams {
			require.Equal(t, 51, <-stream)
			b.Unsubscribe(stream)
		}
	})
}

func TestBroadcasterFatalInitializationFailureRejectsWatches(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		b := newBroadcasterWithSizes(t.Context(), make(chan int), watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), intIdentity,
			&seededCacheConfig[int]{initialize: func(ctx context.Context) (cacheSeed[int], error) {
				select {
				case <-ctx.Done():
					return cacheSeed[int]{}, ctx.Err()
				case <-release:
					return cacheSeed[int]{items: make([]int, defaultCacheSize+1)}, nil
				}
			}})
		waiting := make(chan error, 1)
		go func() {
			_, _, err := b.subscribeWatch(t.Context(), "waiting", intGR, nil)
			waiting <- err
		}()
		synctest.Wait()
		close(release)
		require.ErrorContains(t, <-waiting, "cache capacity")
		<-b.terminated
		stream, _, err := b.subscribeWatch(t.Context(), "after failure", intGR, nil)
		require.ErrorContains(t, err, "cache capacity")
		require.Nil(t, stream)
	})
}
func TestCheckedWatchCancellationDuringInitialization(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		b := newBroadcasterWithSizes(t.Context(), make(chan int), watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), intIdentity,
			&seededCacheConfig[int]{initialize: func(ctx context.Context) (cacheSeed[int], error) {
				<-ctx.Done()
				return cacheSeed[int]{}, ctx.Err()
			}})
		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() {
			_, _, err := b.subscribeWatch(ctx, "cancel", intGR, nil)
			done <- err
		}()
		synctest.Wait()
		cancel()
		require.ErrorIs(t, <-done, context.Canceled)
		require.Empty(t, b.subscribe)
	})
}

func TestCheckedWatchRoutesByGroupResource(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		playlist := GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
		dashboard := GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
		input := make(chan *WrittenEvent)
		const subBuf, ovfCap = 4, 8
		b := newBroadcasterWithSizes(t.Context(), input, subBuf, ovfCap, newBroadcasterMetrics(prometheus.NewRegistry()), writtenEventIdentity, nil)

		scoped, _, err := b.subscribeWatch(t.Context(), "playlists", playlist, nil)
		require.NoError(t, err)
		slow, _, err := b.subscribeWatch(t.Context(), "dashboards", dashboard, nil)
		require.NoError(t, err)

		// A burst past the overflow cap disconnects the slow dashboards watcher
		// but never reaches the watcher of another group/resource.
		for rv := int64(1); rv <= subBuf+ovfCap+1; rv++ {
			input <- cacheEvent(dashboard, rv)
		}
		input <- cacheEvent(playlist, 100)
		synctest.Wait()
		require.Equal(t, int64(100), (<-scoped).ResourceVersion)
		require.Empty(t, scoped)
		requireClosedAfterDrain(t, slow)
		b.Unsubscribe(scoped)
	})
}

// requireClosedAfterDrain fails instead of blocking if ch is still open once
// its buffered items are read.
func requireClosedAfterDrain[T any](t *testing.T, ch <-chan T) {
	t.Helper()
	for {
		select {
		case _, ok := <-ch:
			if !ok {
				return
			}
		default:
			t.Fatal("subscriber was not disconnected")
		}
	}
}
func TestCheckedWatchReplaysOnlyOnResume(t *testing.T) {
	playlist := GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
	dashboard := GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	b, _ := newWatchBroadcaster(t, 10, cacheEvent(playlist, 10), cacheEvent(dashboard, 11), cacheEvent(playlist, 12))

	fresh, _, err := b.subscribeWatch(t.Context(), "list", playlist, nil)
	require.NoError(t, err)
	require.Empty(t, fresh, "watches starting from a list or the latest RV must not replay")
	b.Unsubscribe(fresh)

	resumed, err := checkedWatch(t, b, playlist, 10)
	require.NoError(t, err)
	require.Equal(t, int64(10), (<-resumed).ResourceVersion)
	require.Equal(t, int64(12), (<-resumed).ResourceVersion)
	require.Empty(t, resumed)
	b.Unsubscribe(resumed)
}

func TestBroadcasterWatchProgress(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		playlist := GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
		dashboard := GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
		b, input := newWatchBroadcaster(t, 10, cacheEvent(playlist, 10))
		// Replayed events count as delivered too.
		stream, progress, err := b.subscribeWatch(t.Context(), "playlists", playlist, &watchResume{since: 10, requestedRV: 10})
		require.NoError(t, err)
		defer b.Unsubscribe(stream)
		consumed := int64(0)
		require.Zero(t, progress.rv(consumed), "progress must not cover the unread replay")
		require.Equal(t, int64(10), (<-stream).ResourceVersion)
		consumed++
		// The watch advances from its replay directly; shared progress only
		// counts events received after it subscribed.
		require.Zero(t, progress.rv(consumed), "nothing newer than the watch's start")

		input <- cacheEvent(dashboard, 20)
		synctest.Wait()
		require.Equal(t, int64(20), progress.rv(consumed), "other group/resources establish progress")

		input <- cacheEvent(playlist, 30)
		input <- cacheEvent(dashboard, 40)
		synctest.Wait()
		require.Zero(t, progress.rv(consumed), "progress must not cover undelivered events")
		require.Equal(t, int64(30), (<-stream).ResourceVersion)
		consumed++
		require.Equal(t, int64(40), progress.rv(consumed))

		input <- cacheEvent(dashboard, 35)
		synctest.Wait()
		require.Equal(t, int64(40), progress.rv(consumed), "late events must not regress progress")

		b.Unsubscribe(stream)
		synctest.Wait()
		require.Zero(t, progress.rv(consumed), "a removed subscription has no progress")
	})
}
