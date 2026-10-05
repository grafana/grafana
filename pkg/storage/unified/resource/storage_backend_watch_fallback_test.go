package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
)

type gatedSeedFailureKV struct {
	KV
	reading chan struct{}
	release chan struct{}
}

type bufferedWatchNotifier struct {
	events chan Event
}

func (n *bufferedWatchNotifier) Watch(_ context.Context, opts WatchOptions) <-chan Event {
	opts.captured(nil)
	return n.events
}

func (n *bufferedWatchNotifier) Publish(event Event) {
	n.events <- event
}

func (k *gatedSeedFailureKV) Keys(ctx context.Context, section string, opts ListOptions) iter.Seq2[string, error] {
	if section != eventsSection || opts.Limit != defaultCacheSize || opts.Sort != SortOrderDesc {
		return k.KV.Keys(ctx, section, opts)
	}
	return func(yield func(string, error) bool) {
		close(k.reading)
		select {
		case <-ctx.Done():
			yield("", ctx.Err())
		case <-k.release:
			yield("", errors.New("seed scan failed"))
		}
	}
}

func TestKVWatchSeedPendingThresholdSkipsSeedLoad(t *testing.T) {
	backend, store := setupWatchEventWorker(t)
	probe := &gatedSeedFailureKV{KV: store, reading: make(chan struct{}), release: make(chan struct{})}
	backend.eventStore = newEventStore(probe)
	backend.watchOpts = (WatchOptions{SettleDelay: time.Millisecond, BufferSize: 3}).normalize()
	notifier := &bufferedWatchNotifier{events: make(chan Event, backend.watchOpts.BufferSize)}
	backend.notifier = notifier

	old := durableWatchEvent(snowflakeFromTime(time.Now().Add(-time.Hour)))
	saveWatchEvent(t, backend, old)
	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(func() {
		cancel()
		close(notifier.events)
	})
	type result struct {
		seed   watchSeed
		stream <-chan *WrittenEvent
		err    error
	}
	started := make(chan result, 1)
	go func() {
		seed, stream, err := backend.watchWriteEventsWithSeed(ctx)
		started <- result{seed: seed, stream: stream, err: err}
	}()

	select {
	case <-probe.reading:
	case <-time.After(time.Second):
		t.Fatal("seed load did not start")
	}
	eventCount := int64(backend.watchOpts.BufferSize + 2)
	for i := int64(1); i <= eventCount; i++ {
		event := durableWatchEvent(old.ResourceVersion + i)
		saveWatchEvent(t, backend, event)
		notifier.Publish(event)
	}

	var res result
	select {
	case res = <-started:
	case <-time.After(time.Second):
		t.Fatal("pending threshold did not bypass the seed load")
	}
	require.NoError(t, res.err)
	require.Empty(t, res.seed.events)
	require.Equal(t, old.ResourceVersion, res.seed.initialCacheFloor)
	require.Equal(t, old.ResourceVersion, res.seed.highestRV)
	for i := int64(1); i <= eventCount; i++ {
		select {
		case event := <-res.stream:
			require.NotNil(t, event)
			require.Equal(t, old.ResourceVersion+i, event.ResourceVersion)
		case <-time.After(time.Second):
			t.Fatal("buffered event was not handed off")
		}
	}
}

func TestKVWatchSeedFallbackPreservesBufferedEvents(t *testing.T) {
	for _, channel := range []bool{false, true} {
		t.Run(fmt.Sprintf("channel=%t", channel), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				time.Sleep(time.Until(time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC)))
				backend, store := setupWatchEventWorker(t)
				probe := &gatedSeedFailureKV{KV: store, reading: make(chan struct{}), release: make(chan struct{})}
				backend.eventStore = newEventStore(probe)
				backend.watchOpts = (WatchOptions{SettleDelay: time.Second, MinBackoff: 10 * time.Millisecond}).normalize()
				backend.notifier = newNotifier(backend.eventStore, notifierOptions{log: backend.log, useChannelNotifier: channel})
				old := durableWatchEvent(snowflakeFromTime(time.Now().Add(-time.Hour)))
				saveWatchEvent(t, backend, old)

				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				type result struct {
					seed   watchSeed
					stream <-chan *WrittenEvent
					err    error
				}
				started := make(chan result, 1)
				go func() {
					seed, stream, err := backend.watchWriteEventsWithSeed(ctx)
					started <- result{seed, stream, err}
				}()
				<-probe.reading
				captured := durableWatchEvent(old.ResourceVersion + 1)
				saveWatchEvent(t, backend, captured)
				backend.notifier.Publish(captured)
				backend.notifier.Publish(old)
				time.Sleep(2 * time.Second)
				synctest.Wait()
				require.Empty(t, started, "capture must remain buffered until the failed seed read finishes")
				close(probe.release)
				res := <-started
				require.NoError(t, res.err)
				defer func() {
					cancel()
					for range res.stream {
					}
				}()
				require.Empty(t, res.seed.events)
				require.Equal(t, old.ResourceVersion, res.seed.initialCacheFloor)
				require.Equal(t, old.ResourceVersion, res.seed.highestRV)
				live := durableWatchEvent(old.ResourceVersion + 2)
				saveWatchEvent(t, backend, live)
				backend.notifier.Publish(live)
				for _, expected := range []Event{captured, live} {
					event := <-res.stream
					require.NotNil(t, event)
					require.Equal(t, expected.ResourceVersion, event.ResourceVersion)
				}
				time.Sleep(2 * time.Second)
				synctest.Wait()
				require.Empty(t, res.stream)
			})
		})
	}
}
