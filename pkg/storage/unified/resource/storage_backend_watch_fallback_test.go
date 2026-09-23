package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type recoverableSeedKV struct {
	KV
	failing   KV
	recovered atomic.Bool
}

func (k *recoverableSeedKV) Keys(ctx context.Context, section string, opts ListOptions) iter.Seq2[string, error] {
	if !k.recovered.Load() {
		return k.failing.Keys(ctx, section, opts)
	}
	return k.KV.Keys(ctx, section, opts)
}

func (k *recoverableSeedKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
	if !k.recovered.Load() {
		return k.failing.BatchGet(ctx, section, keys)
	}
	return k.KV.BatchGet(ctx, section, keys)
}

func TestKVWatchSeedFallback(t *testing.T) {
	for _, tc := range []struct {
		name  string
		empty bool
		wrap  func(KV) KV
	}{
		{name: "scan failure with existing history", wrap: func(store KV) KV { return &seedScanFailureKV{KV: store} }},
		{name: "scan failure with empty history", empty: true, wrap: func(store KV) KV { return &seedScanFailureKV{KV: store} }},
		{name: "partial metadata", wrap: func(store KV) KV { return &watchSeedFaultKV{KV: store, section: eventsSection, after: 1} }},
		{name: "partial payload", wrap: func(store KV) KV { return &watchSeedFaultKV{KV: store, section: dataSection, after: 1} }},
		{name: "payload reader", wrap: func(store KV) KV {
			return &unreadableValueKV{KV: store, nameMatch: "playlist-", err: errors.New("unreadable seed payload")}
		}},
		{name: "payload read timeout", wrap: func(store KV) KV {
			return &unreadableValueKV{KV: store, nameMatch: "playlist-", err: context.DeadlineExceeded}
		}},
	} {
		for _, channel := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/channel=%t", tc.name, channel), func(t *testing.T) {
				base := setupBadgerKV(t)
				store := &recoverableSeedKV{KV: base, failing: tc.wrap(base)}
				logger := &logtest.Fake{}
				backend := setupTestStorageBackend(t, withKV(store), withLogger(logger), func(opts *KVBackendOptions) {
					opts.UseChannelNotifier = channel
					opts.WatchOptions.MinBackoff = time.Millisecond
					opts.WatchOptions.MaxBackoff = 2 * time.Millisecond
				})
				oldRV := snowflakeFromTime(time.Now().Add(-24 * time.Hour))
				if !tc.empty {
					for i := range 2 {
						saveWatchEvent(t, backend, durableWatchEvent(oldRV+int64(i)))
					}
				}

				ctx, cancel := context.WithTimeout(authlib.WithAuthInfo(t.Context(), newWatchTestUser()), 5*time.Second)
				defer cancel()
				before := snowflakeFromTime(time.Now())
				srv := initWatchServer(t, backend)
				b := srv.watchStartup.broadcaster
				require.NoError(t, b.waitReady(ctx))
				store.recovered.Store(true)
				floor := b.cache.initialFloor
				if tc.empty {
					require.GreaterOrEqual(t, floor, before)
				} else {
					require.Equal(t, oldRV+1, floor)
				}
				require.Equal(t, floor, srv.mostRecentRV.Load())
				require.Zero(t, b.cache.events.len, "a failed read must not install a partial seed")
				require.Equal(t, 1, logger.WarnLogs.Calls)
				require.Contains(t, logger.WarnLogs.Message, "empty watch cache")
				require.Contains(t, logger.WarnLogs.Ctx, floor)

				req := bookmarkWatchRequest()
				req.Options.Key.Name = ""
				req.Since = floor - 1
				expired := newMockWatchServer(ctx)
				err := srv.Watch(req, expired)
				require.True(t, IsResourceVersionExpired(err), "expected expiry, got %v", err)
				require.EqualValues(t, 410, AsErrorResult(err).Code)
				require.Empty(t, expired.events, "expiry must precede any objects or bookmarks")

				listed := 0
				listRV, err := backend.ListIterator(ctx, &resourcepb.ListRequest{Options: req.Options}, func(it ListIterator) error {
					for it.Next() {
						listed++
						require.NotEmpty(t, it.Value())
					}
					return it.Error()
				})
				require.NoError(t, err)
				if tc.empty {
					require.Zero(t, listed)
					require.GreaterOrEqual(t, listRV, floor)
				} else {
					require.Equal(t, 2, listed)
					require.Equal(t, floor, listRV, "fresh idle LIST must be admissible at the fallback floor")
				}

				req.Since = listRV
				stream := newMockWatchServer(ctx)
				done := make(chan error, 1)
				go func() { done <- srv.Watch(req, stream) }()
				requireMetricEventually(t, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues(watchTestResource), 1)
				live := durableWatchEvent(backend.snowflake.Generate().Int64())
				saveWatchEvent(t, backend, live)
				backend.notifier.Publish(live)
				select {
				case event := <-stream.events:
					require.Equal(t, resourcepb.WatchEvent_ADDED, event.Type)
					require.Equal(t, live.ResourceVersion, event.Resource.Version)
				case <-ctx.Done():
					t.Fatal("fallback did not preserve live capture")
				}
				cancel()
				require.NoError(t, <-done)
			})
		}
	}
}

type gatedSeedFailureKV struct {
	KV
	reading chan struct{}
	release chan struct{}
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
