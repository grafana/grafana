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

func TestKVWatchSettledHandoff(t *testing.T) {
	for _, tc := range []struct {
		channel bool
		empty   bool
	}{
		{channel: false, empty: false},
		{channel: true, empty: false},
		{channel: false, empty: true},
		{channel: true, empty: true},
	} {
		t.Run(fmt.Sprintf("channel=%t/empty=%t", tc.channel, tc.empty), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				// Snowflake RVs must be positive, so move the fake clock past their epoch.
				time.Sleep(time.Until(time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC)))
				backend, store := setupWatchEventWorker(t)
				snapshot := make(chan func(), 1)
				probe := &watchSeedHookKV{KV: store, snapshot: func() { (<-snapshot)() }}
				backend.eventStore = newEventStore(probe)
				backend.watchOpts = (WatchOptions{SettleDelay: 3 * time.Second, MinBackoff: 10 * time.Millisecond}).normalize()
				backend.notifier = newNotifier(backend.eventStore, notifierOptions{log: backend.log, useChannelNotifier: tc.channel})

				old := durableWatchEvent(snowflakeFromTime(time.Now().Add(-time.Hour)))
				a := durableWatchEvent(snowflakeFromTime(time.Now()))
				b := durableWatchEvent(a.ResourceVersion + 1)
				if !tc.empty {
					saveWatchEvent(t, backend, old)
					saveWatchEvent(t, backend, b)
				}

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
				synctest.Wait()
				require.Empty(t, started)

				// A commits after capture starts, but within the settling window.
				time.Sleep(time.Second)
				saveWatchEvent(t, backend, a)
				backend.notifier.Publish(a)
				if tc.empty {
					saveWatchEvent(t, backend, b)
				}
				backend.notifier.Publish(b)
				cStarted := time.Now()
				c := durableWatchEvent(snowflakeFromTime(cStarted))
				d := durableWatchEvent(c.ResourceVersion + 1)
				saveWatchEvent(t, backend, d)
				backend.notifier.Publish(d)

				var e Event
				snapshot <- func() {
					// D is durable when keys are enumerated, but C commits just afterwards.
					// Both are newer than the fixed boundary and must arrive via live capture.
					require.Less(t, time.Since(cStarted), backend.watchOpts.SettleDelay)
					saveWatchEvent(t, backend, c)
					backend.notifier.Publish(c)
					e = durableWatchEvent(snowflakeFromTime(time.Now()))
					saveWatchEvent(t, backend, e)
					backend.notifier.Publish(e)
				}

				res := <-started
				require.NoError(t, res.err)
				defer func() {
					cancel()
					for range res.stream {
					}
				}()
				seeded, live, handoffRV := []Event{old, a, b}, []Event{c, d, e}, b.ResourceVersion
				if tc.empty {
					seeded, live, handoffRV = []Event{a}, []Event{b, c, d, e}, a.ResourceVersion
				}
				require.Equal(t, handoffRV, res.seed.highestRV)
				require.Len(t, res.seed.events, len(seeded))
				for i, expected := range seeded {
					require.Equal(t, expected.ResourceVersion, res.seed.events[i].ResourceVersion)
				}
				for _, expected := range live {
					event := <-res.stream
					require.NotNil(t, event)
					require.Equal(t, expected.ResourceVersion, event.ResourceVersion)
				}
				time.Sleep(backend.watchOpts.SettleDelay + time.Second)
				synctest.Wait()
				require.Empty(t, res.stream, "seed/live overlap must not duplicate events")
			})
		})
	}
}

type watchHandoffFaultKV struct {
	KV
	err error
}

func (k *watchHandoffFaultKV) Keys(ctx context.Context, section string, opts ListOptions) iter.Seq2[string, error] {
	if section == eventsSection && opts.Limit == 1 {
		return func(yield func(string, error) bool) { yield("", k.err) }
	}
	return k.KV.Keys(ctx, section, opts)
}

func TestKVWatchHandoffBoundaryFailure(t *testing.T) {
	backend, _ := setupWatchEventWorker(t)
	backend.watchOpts = (WatchOptions{}).normalize()
	backend.notifier = newChannelNotifier(backend.log)
	boundaryErr := errors.New("boundary read failed")
	backend.eventStore.kv = &watchHandoffFaultKV{KV: backend.eventStore.kv, err: boundaryErr}

	seed, stream, err := backend.watchWriteEventsWithSeed(t.Context())
	require.ErrorIs(t, err, boundaryErr)
	require.ErrorContains(t, err, "read watch handoff boundary")
	require.Equal(t, watchSeed{}, seed)
	require.Nil(t, stream)
}
