package resource

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

func initWatchServer(t *testing.T, backend StorageBackend) *server {
	t.Helper()
	return initWatchServerWithSeededWatches(t, backend, true)
}

func initWatchServerWithSeededWatches(t *testing.T, backend StorageBackend, enabled bool) *server {
	t.Helper()
	srv, err := NewUninitializedResourceServer(ResourceServerOptions{
		Backend: backend, StorageMetrics: ProvideStorageMetrics(prometheus.NewRegistry()), BookmarkFrequency: time.Second,
		SeededWatchesEnabled: enabled,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = srv.Stop(ctx)
	})
	require.NoError(t, srv.initWatcher())
	return srv
}

func TestKVWatchSeededWatchesToggle(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(map[bool]string{false: "disabled", true: "enabled"}[enabled], func(t *testing.T) {
			backend := setupTestStorageBackend(t, withChannelNotifier)
			base := snowflakeFromTime(time.Now().Add(-time.Hour))
			saveWatchEvent(t, backend, durableWatchEvent(base))
			srv := initWatchServerWithSeededWatches(t, backend, enabled)
			if enabled {
				require.NotNil(t, srv.watchStartup)
				require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))
			} else {
				require.Nil(t, srv.watchStartup)
			}

			ctx, cancel := context.WithTimeout(authlib.WithAuthInfo(t.Context(), newWatchTestUser()), 5*time.Second)
			defer cancel()
			req := bookmarkWatchRequest()
			req.AllowWatchBookmarks = false
			req.Options.Key.Name = ""
			req.Since = base - 1
			stream := newMockWatchServer(ctx)
			done := make(chan error, 1)
			go func() { done <- srv.Watch(req, stream) }()
			if enabled {
				select {
				case err := <-done:
					require.True(t, IsResourceVersionExpired(err), "expected expiry, got %v", err)
					require.Empty(t, stream.events)
				case <-ctx.Done():
					t.Fatal("seeded watch did not reject the expired cursor")
				}
				return
			}

			requireMetricEventually(t, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues(watchTestResource), 1)
			live := durableWatchEvent(base + 1)
			saveWatchEvent(t, backend, live)
			backend.notifier.Publish(live)
			select {
			case event := <-stream.events:
				require.Equal(t, resourcepb.WatchEvent_ADDED, event.Type)
				require.Equal(t, live.ResourceVersion, event.Resource.Version)
			case <-ctx.Done():
				t.Fatal("unseeded watch did not deliver the live event")
			}
			cancel()
			require.NoError(t, <-done)
		})
	}
}

func TestKVWatchResumeExpiryAndReplay(t *testing.T) {
	backend := setupTestStorageBackend(t)
	// Use RVs that round-trip through the supported legacy microsecond format.
	rv := rvmanager.SnowflakeFromRV(time.Now().Add(-time.Hour).UnixMicro())
	for _, version := range []int64{rv, rv + 4096, rv + 8192} {
		saveWatchEvent(t, backend, durableWatchEvent(version))
	}
	srv := initWatchServer(t, backend)
	require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))
	for _, tc := range []struct {
		name    string
		since   int64
		group   string
		expired bool
	}{
		{name: "below initial floor", since: rv - 1, expired: true},
		{name: "unobserved group", since: rv - 1, group: "never.grafana.app", expired: true},
		{name: "equal initial floor", since: rv},
		{name: "legacy format equality", since: rvmanager.RVFromSnowflake(rv)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
			defer cancel()
			req := bookmarkWatchRequest()
			req.Options.Key.Name = ""
			if tc.group != "" {
				req.Options.Key.Group = tc.group
			}
			req.Since = tc.since
			stream := newMockWatchServer(ctx)
			done := make(chan error, 1)
			go func() { done <- srv.Watch(req, stream) }()
			if tc.expired {
				select {
				case err := <-done:
					require.Equal(t, codes.Code(http.StatusGone), status.Code(err))
					result := AsErrorResult(err)
					require.EqualValues(t, 410, result.Code)
					require.Equal(t, "Expired", result.Reason)
					require.Empty(t, stream.events, "expiry must precede objects and bookmarks")
				case <-time.After(time.Second):
					t.Fatal("expiry did not terminate watch")
				}
				return
			}
			for _, want := range []int64{rv + 4096, rv + 8192} {
				select {
				case event := <-stream.events:
					require.Equal(t, resourcepb.WatchEvent_ADDED, event.Type)
					require.Equal(t, want, event.Resource.Version)
				case <-time.After(time.Second):
					t.Fatal("missing replay event")
				}
			}
			cancel()
			require.NoError(t, <-done)
		})
	}
}

func TestKVWatchSeedReadsPreviousPayloadOnReplay(t *testing.T) {
	store := &countingKV{KV: setupBadgerKV(t)}
	backend := setupTestStorageBackend(t, withKV(store))
	created := durableWatchEvent(snowflakeFromTime(time.Now().Add(-time.Hour)))
	saveWatchEvent(t, backend, created)
	updated := created
	updated.ResourceVersion++
	updated.PreviousRV = created.ResourceVersion
	updated.Action = DataActionUpdated
	saveWatchEvent(t, backend, updated)
	deleted := updated
	deleted.ResourceVersion++
	deleted.PreviousRV = updated.ResourceVersion
	deleted.Action = DataActionDeleted
	saveWatchEvent(t, backend, deleted)

	srv := initWatchServer(t, backend)
	require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))
	_, keysBefore := store.stats()
	require.Equal(t, 3, keysBefore, "seed loading reads only the cached event payloads")

	ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
	defer cancel()
	stream := newMockWatchServer(ctx)
	req := bookmarkWatchRequest()
	req.Since = created.ResourceVersion
	req.Options.Key.Name = created.Name
	done := make(chan error, 1)
	go func() { done <- srv.Watch(req, stream) }()
	for _, expected := range []Event{updated, deleted} {
		select {
		case event := <-stream.events:
			require.Equal(t, expected.ResourceVersion, event.Resource.Version)
			require.NotNil(t, event.Previous)
			require.Equal(t, expected.PreviousRV, event.Previous.Version)
			require.NotEmpty(t, event.Previous.Value)
		case <-time.After(time.Second):
			t.Fatal("missing replay event")
		}
	}
	cancel()
	require.NoError(t, <-done)
	_, keysAfter := store.stats()
	require.Equal(t, 2, keysAfter-keysBefore, "previous revisions are read at delivery time")
}

func TestKVWatchOmitsPrunedPreviousPayload(t *testing.T) {
	for _, delivery := range []string{"replay", "live"} {
		for _, eventType := range []resourcepb.WatchEvent_Type{resourcepb.WatchEvent_MODIFIED, resourcepb.WatchEvent_DELETED} {
			t.Run(delivery+"/"+eventType.String(), func(t *testing.T) {
				backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
					opts.WatchOptions.MinBackoff = time.Millisecond
				})
				base := snowflakeFromTime(time.Now().Add(-time.Hour))
				saveWatchEvent(t, backend, durableWatchEvent(base))
				previous := durableWatchEvent(base + 1)
				saveWatchEvent(t, backend, previous)
				current := previous
				current.ResourceVersion++
				current.PreviousRV = previous.ResourceVersion
				current.Action = DataActionUpdated
				if eventType == resourcepb.WatchEvent_DELETED {
					current.Action = DataActionDeleted
				}
				if delivery == "replay" {
					saveWatchEvent(t, backend, current)
				}
				require.NoError(t, backend.dataStore.Delete(t.Context(), eventDataKey(previous)))

				srv := initWatchServer(t, backend)
				require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))
				ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
				defer cancel()
				stream := newMockWatchServer(ctx)
				req := bookmarkWatchRequest()
				req.Since = base
				req.Options.Key.Name = current.Name
				done := make(chan error, 1)
				go func() { done <- srv.Watch(req, stream) }()
				if delivery == "live" {
					requireMetricEventually(t, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues(watchTestResource), 1)
					saveWatchEvent(t, backend, current)
					backend.notifier.Publish(current)
				}
				select {
				case event := <-stream.events:
					require.Equal(t, eventType, event.Type)
					require.Equal(t, current.ResourceVersion, event.Resource.Version)
					require.Nil(t, event.Previous)
					if eventType == resourcepb.WatchEvent_DELETED {
						require.Empty(t, event.Resource.Value)
					} else {
						require.NotEmpty(t, event.Resource.Value)
					}
				case err := <-done:
					t.Fatalf("watch stopped before delivering the event: %v", err)
				case <-time.After(time.Second):
					t.Fatal("missing event with pruned previous revision")
				}
				cancel()
				require.NoError(t, <-done)
			})
		}
	}
}

func TestKVWatchFreshListIdleStore(t *testing.T) {
	for _, empty := range []bool{false, true} {
		t.Run(map[bool]string{false: "idle", true: "empty"}[empty], func(t *testing.T) {
			backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
				opts.WatchOptions.MinBackoff = time.Millisecond
			})
			if !empty {
				saveWatchEvent(t, backend, durableWatchEvent(snowflakeFromTime(time.Now().Add(-24*time.Hour))))
			}
			srv := initWatchServer(t, backend)
			require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))
			req := bookmarkWatchRequest()
			req.Options.Key.Name = ""
			rv, err := backend.ListIterator(t.Context(), &resourcepb.ListRequest{Options: req.Options}, func(ListIterator) error { return nil })
			require.NoError(t, err)
			req.Since = rv
			ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
			defer cancel()
			stream := newMockWatchServer(ctx)
			done := make(chan error, 1)
			go func() { done <- srv.Watch(req, stream) }()
			requireMetricEventually(t, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues(watchTestResource), 1)
			event := durableWatchEvent(requireGeneratedResourceVersion(t, backend.resourceVersions))
			saveWatchEvent(t, backend, event)
			backend.notifier.Publish(event)
			select {
			case got := <-stream.events:
				require.Equal(t, resourcepb.WatchEvent_ADDED, got.Type)
				require.Equal(t, event.ResourceVersion, got.Resource.Version)
			case <-time.After(time.Second):
				t.Fatal("fresh LIST could not resume")
			}
			cancel()
			require.NoError(t, <-done)
		})
	}
}

type gatedWatchBackend struct {
	UnimplementedStorageBackend
	seed        chan watchSeed
	events      chan *WrittenEvent
	list        func() (int64, error)
	err         error
	stopCapture <-chan struct{}
}

func (b *gatedWatchBackend) watchWriteEventsWithSeed(ctx context.Context, _ *raisedFloors, captured func()) (watchSeed, <-chan *WrittenEvent, error) {
	select {
	case <-ctx.Done():
		return watchSeed{}, nil, ctx.Err()
	case seed := <-b.seed:
		if b.err != nil {
			return watchSeed{}, nil, b.err
		}
		captured()
		context.AfterFunc(ctx, func() {
			if b.stopCapture != nil {
				<-b.stopCapture
			}
			close(b.events)
		})
		return seed, b.events, nil
	}
}

func (b *gatedWatchBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return b.list()
}

func TestWatchStartupGateAndSubscribeBeforeList(t *testing.T) {
	for _, initial := range []bool{false, true} {
		t.Run(map[bool]string{false: "since zero", true: "initial events"}[initial], func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				backend := &gatedWatchBackend{seed: make(chan watchSeed), events: make(chan *WrittenEvent)}
				srv := initWatchServer(t, backend)
				ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
				defer cancel()
				stream := newMockWatchServer(ctx)
				req := bookmarkWatchRequest()
				req.Since = 0
				if initial {
					req.Since = 1 // Initial events do not require historical coverage.
				}
				req.SendInitialEvents = initial
				listed := false
				backend.list = func() (int64, error) {
					listed = true
					requireMetricValue(t, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues(watchTestResource), 1)
					backend.events <- bookmarkWrittenEvent(101)
					return 100, nil
				}
				done := make(chan error, 1)
				go func() { done <- srv.Watch(req, stream) }()
				time.Sleep(10 * time.Second)
				require.False(t, listed)
				require.Empty(t, stream.events)
				backend.seed <- watchSeed{initialCacheFloor: 100, highestRV: 100}
				synctest.Wait()
				require.True(t, listed)
				if initial {
					bookmark := <-stream.events
					require.Equal(t, resourcepb.WatchEvent_BOOKMARK, bookmark.Type)
					require.Equal(t, int64(100), bookmark.Resource.Version)
				}
				event := <-stream.events
				require.Equal(t, int64(101), event.Resource.Version)
				cancel()
				require.NoError(t, <-done)
			})
		})
	}
}

func TestWatchStopWaitsForCapture(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		backend := &gatedWatchBackend{seed: make(chan watchSeed), events: make(chan *WrittenEvent), stopCapture: release}
		srv := initWatchServer(t, backend)
		backend.seed <- watchSeed{initialCacheFloor: 100, highestRV: 100}
		require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))
		stopped := make(chan error, 1)
		go func() { stopped <- srv.Stop(t.Context()) }()
		synctest.Wait()
		require.Empty(t, stopped, "backend must remain open until capture stops reading it")
		close(release)
		require.NoError(t, <-stopped)
	})
}

type recoverableWatchBackend struct {
	UnimplementedStorageBackend
	attempts atomic.Int32
	err      error
	events   chan *WrittenEvent
}

func (b *recoverableWatchBackend) watchWriteEventsWithSeed(ctx context.Context, _ *raisedFloors, captured func()) (watchSeed, <-chan *WrittenEvent, error) {
	if b.attempts.Add(1) == 1 {
		return watchSeed{}, nil, b.err
	}
	captured()
	context.AfterFunc(ctx, func() { close(b.events) })
	return watchSeed{initialCacheFloor: 100, highestRV: 100}, b.events, nil
}

func TestWatchStartupFailureRecoversOnNextWatch(t *testing.T) {
	startupErr := errors.New("database unavailable")
	backend := &recoverableWatchBackend{err: startupErr, events: make(chan *WrittenEvent)}
	srv := initWatchServer(t, backend)
	require.ErrorIs(t, srv.watchStartup.broadcaster.waitReady(t.Context()), startupErr)

	ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
	defer cancel()
	stream := newMockWatchServer(ctx)
	done := make(chan error, 1)
	go func() { done <- srv.Watch(bookmarkWatchRequest(), stream) }()
	requireMetricEventually(t, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues(watchTestResource), 1)
	require.Equal(t, int32(2), backend.attempts.Load())

	backend.events <- bookmarkWrittenEvent(101)
	select {
	case event := <-stream.events:
		require.Equal(t, resourcepb.WatchEvent_ADDED, event.Type)
		require.Equal(t, int64(101), event.Resource.Version)
	case <-time.After(time.Second):
		t.Fatal("watch did not recover after reinitialization")
	}
	cancel()
	require.NoError(t, <-done)
}

func TestWatchStartupFailureAndCancellation(t *testing.T) {
	for _, failure := range []string{"client", "server", "seed", "install"} {
		t.Run(failure, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				backend := &gatedWatchBackend{seed: make(chan watchSeed), err: errors.New("seed failed")}
				if failure == "install" {
					backend.err = nil
					backend.events = make(chan *WrittenEvent)
				}
				srv := initWatchServer(t, backend)
				ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
				defer cancel()
				stream := newMockWatchServer(ctx)
				done := make(chan error, 1)
				go func() { done <- srv.Watch(bookmarkWatchRequest(), stream) }()
				synctest.Wait()
				switch failure {
				case "client":
					cancel()
				case "server":
					srv.cancel()
				case "seed":
					backend.seed <- watchSeed{}
				case "install":
					backend.seed <- watchSeed{events: make([]*WrittenEvent, defaultCacheSize+1)}
				}
				err := <-done
				switch failure {
				case "client":
					require.NoError(t, err)
				case "server":
					require.ErrorIs(t, err, context.Canceled)
				case "seed":
					require.ErrorIs(t, err, backend.err)
				case "install":
					require.ErrorContains(t, err, "cache capacity")
					<-srv.watchStartup.stopped
				}
				require.Empty(t, stream.events)
				require.False(t, IsResourceVersionExpired(err))
			})
		})
	}
}

type legacyWatchBackend struct {
	UnimplementedStorageBackend
	events chan *WrittenEvent
}

func (b *legacyWatchBackend) WatchWriteEvents(context.Context) (<-chan *WrittenEvent, error) {
	return b.events, nil
}

type unseededKVWatchBackend struct {
	KVBackend
	events chan *WrittenEvent
}

func (b *unseededKVWatchBackend) WatchWriteEvents(context.Context) (<-chan *WrittenEvent, error) {
	return b.events, nil
}

func (b *unseededKVWatchBackend) Stop(context.Context) error { return nil }

func TestUnseededWatchByteEvictionExpiresResume(t *testing.T) {
	for _, backendType := range []string{"legacy", "kv"} {
		t.Run(backendType, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				base := snowflakeFromTime(advanceBookmarkClock().Add(-time.Hour))
				events := make(chan *WrittenEvent)
				defer close(events)
				var backend StorageBackend = &legacyWatchBackend{events: events}
				if backendType == "kv" {
					backend = &unseededKVWatchBackend{events: events}
				}
				srv := initWatchServerWithSeededWatches(t, backend, false)
				require.Nil(t, srv.watchStartup)
				synctest.Wait()
				b := srv.broadcaster
				first, second := bookmarkWrittenEvent(base+1), bookmarkWrittenEvent(base+2)
				b.cache.maxBytes = first.sizeBytes()
				events <- first
				events <- second
				synctest.Wait()
				require.Equal(t, 1, b.cache.cachedLen())

				ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
				defer cancel()
				req := bookmarkWatchRequest()
				req.Since = base
				stream := newMockWatchServer(ctx)
				done := make(chan error, 1)
				go func() { done <- srv.Watch(req, stream) }()
				synctest.Wait()
				select {
				case err := <-done:
					require.True(t, IsResourceVersionExpired(err), "expected expiry, got %v", err)
				default:
					t.Fatal("watch did not reject the evicted cursor")
				}
				require.Empty(t, stream.events)

				req.Since = first.ResourceVersion
				go func() { done <- srv.Watch(req, stream) }()
				synctest.Wait()
				require.Len(t, stream.events, 1)
				require.Equal(t, second.ResourceVersion, (<-stream.events).Resource.Version)
				cancel()
				require.NoError(t, <-done)
			})
		})
	}
}

func TestLegacyWatchHasNoStartupFloor(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend := &legacyWatchBackend{events: make(chan *WrittenEvent)}
		srv := initWatchServer(t, backend)
		require.Nil(t, srv.watchStartup)
		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		stream := newMockWatchServer(ctx)
		backend.events <- bookmarkWrittenEvent(500)
		synctest.Wait()
		done := make(chan error, 1)
		go func() { done <- srv.Watch(bookmarkWatchRequest(), stream) }()
		synctest.Wait()
		require.Equal(t, int64(500), (<-stream.events).Resource.Version)
		cancel()
		require.NoError(t, <-done)
		close(backend.events)
	})
}

func TestWatchOpenedBeforeStartupIgnoresStartupInvalidation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend := &gatedWatchBackend{
			seed: make(chan watchSeed), events: make(chan *WrittenEvent),
			list: func() (int64, error) { return 100, nil },
		}
		srv := initWatchServer(t, backend)

		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		req := bookmarkWatchRequest()
		req.AllowWatchBookmarks = false
		req.Since = 0
		stream := newMockWatchServer(ctx)
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, stream) }()
		synctest.Wait()

		// Capture starting expires the watches opened while it was unavailable.
		srv.watchExpiry.Invalidate()
		backend.seed <- watchSeed{initialCacheFloor: 100, highestRV: 100}
		synctest.Wait()

		backend.events <- bookmarkWrittenEvent(300)
		synctest.Wait()
		select {
		case err := <-done:
			t.Fatalf("a watch waiting for startup must not expire, got %v", err)
		case event := <-stream.events:
			require.Equal(t, int64(300), event.Resource.Version)
		default:
			t.Fatal("missing live event")
		}
		cancel()
		require.NoError(t, <-done)
	})
}

// compileHookAccess runs onCompile while a watch is being set up.
type compileHookAccess struct {
	authlib.AccessClient
	onCompile func()
}

func (a compileHookAccess) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	a.onCompile()
	//nolint:staticcheck // SA1019: the watch still uses Compile
	return a.AccessClient.Compile(ctx, id, req)
}

func TestWatchWaitingForStartupKeepsInvalidationsAfterCapture(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend := &gatedWatchBackend{seed: make(chan watchSeed), events: make(chan *WrittenEvent)}
		expiry := NewWatchExpiry()
		var srv *server
		// The cache becomes ready while the watch is set up, then misses an event.
		onCompile := func() {
			backend.seed <- watchSeed{initialCacheFloor: 200, highestRV: 200}
			require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))
			expiry.Invalidate()
		}
		srv, err := NewUninitializedResourceServer(ResourceServerOptions{
			Backend: backend, StorageMetrics: ProvideStorageMetrics(prometheus.NewRegistry()), WatchExpiry: expiry,
			SeededWatchesEnabled: true,
			AccessClient:         compileHookAccess{AccessClient: authlib.FixedAccessClient(true), onCompile: onCompile},
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			_ = srv.Stop(ctx)
		})
		require.NoError(t, srv.initWatcher())

		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		req := bookmarkWatchRequest()
		req.AllowWatchBookmarks = false
		req.Since = 250
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, newMockWatchServer(ctx)) }()
		synctest.Wait()
		select {
		case err := <-done:
			require.True(t, IsResourceVersionExpired(err), "got %v", err)
		default:
			t.Fatal("a missing event after capture must expire a watch that waited for startup")
		}
	})
}

func TestWatchKeepsMissingEventInvalidationsDuringSetup(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend := &gatedWatchBackend{seed: make(chan watchSeed, 1), events: make(chan *WrittenEvent)}
		backend.seed <- watchSeed{initialCacheFloor: 200, highestRV: 200}
		expiry := NewWatchExpiry()
		srv, err := NewUninitializedResourceServer(ResourceServerOptions{
			Backend: backend, StorageMetrics: ProvideStorageMetrics(prometheus.NewRegistry()), WatchExpiry: expiry,
			SeededWatchesEnabled: true,
			// A missing event while the watch is being set up.
			AccessClient: compileHookAccess{AccessClient: authlib.FixedAccessClient(true), onCompile: expiry.Invalidate},
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			_ = srv.Stop(ctx)
		})
		require.NoError(t, srv.initWatcher())
		require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))

		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		req := bookmarkWatchRequest()
		req.AllowWatchBookmarks = false
		req.Since = 250
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, newMockWatchServer(ctx)) }()
		synctest.Wait()
		select {
		case err := <-done:
			require.True(t, IsResourceVersionExpired(err), "got %v", err)
		default:
			t.Fatal("a missing event during setup must expire the watch once the cache is ready")
		}
	})
}

type resumeFloorBackend struct {
	legacyWatchBackend
	enabled bool
	floors  map[GroupResource]int64
	lost    ResumeFloors
}

func (b *resumeFloorBackend) WatchResumeFloorsEnabled() bool { return b.enabled }

func (b *resumeFloorBackend) WatchWriteEventsWithResumeFloors(ctx context.Context, floors ResumeFloors, captured func()) (map[GroupResource]int64, <-chan *WrittenEvent, error) {
	b.lost = floors
	captured()
	context.AfterFunc(ctx, func() { close(b.events) })
	return b.floors, b.events, nil
}

func TestWatchResumeFloors(t *testing.T) {
	gr := GroupResource{Group: watchTestGroup, Resource: watchTestResource}
	newBackend := func() *resumeFloorBackend {
		return &resumeFloorBackend{
			legacyWatchBackend: legacyWatchBackend{events: make(chan *WrittenEvent)},
			enabled:            true,
			floors:             map[GroupResource]int64{gr: 200},
		}
	}
	watch := func(t *testing.T, srv *server, since int64) (*mockWatchServer, chan error, context.CancelFunc) {
		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		req := bookmarkWatchRequest()
		req.AllowWatchBookmarks = false
		req.Since = since
		stream := newMockWatchServer(ctx)
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, stream) }()
		return stream, done, cancel
	}

	t.Run("resume from before the stream started expires", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			srv := initWatchServer(t, newBackend())
			require.NotNil(t, srv.watchStartup)

			stream, done, cancel := watch(t, srv, 199)
			defer cancel()
			synctest.Wait()
			select {
			case err := <-done:
				require.True(t, IsResourceVersionExpired(err), "got %v", err)
				require.Empty(t, stream.events)
			default:
				t.Fatal("a resume below the floor must expire")
			}
		})
	})

	t.Run("resume from the floor continues", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			backend := newBackend()
			srv := initWatchServer(t, backend)
			stream, done, cancel := watch(t, srv, 200)
			synctest.Wait()

			backend.events <- bookmarkWrittenEvent(300)
			synctest.Wait()
			select {
			case event := <-stream.events:
				require.Equal(t, int64(300), event.Resource.Version)
			default:
				t.Fatal("missing live event")
			}
			cancel()
			require.NoError(t, <-done)
		})
	})

	t.Run("disabled floors keep the legacy watch", func(t *testing.T) {
		backend := newBackend()
		backend.enabled = false
		srv := initWatchServer(t, backend)
		require.Nil(t, srv.watchStartup)
		close(backend.events)
	})
}

func TestWatchResumeExpiresBelowALostWrite(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		gr := GroupResource{Group: watchTestGroup, Resource: watchTestResource}
		backend := &resumeFloorBackend{
			legacyWatchBackend: legacyWatchBackend{events: make(chan *WrittenEvent)},
			enabled:            true,
			floors:             map[GroupResource]int64{gr: 200},
		}
		srv := initWatchServer(t, backend)
		require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))

		// The stream lost a write while no watch was open.
		backend.lost.Raise(gr, 300)

		resume := func(since int64) error {
			ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
			defer cancel()
			req := bookmarkWatchRequest()
			req.AllowWatchBookmarks = false
			req.Since = since
			done := make(chan error, 1)
			go func() { done <- srv.Watch(req, newMockWatchServer(ctx)) }()
			synctest.Wait()
			select {
			case err := <-done:
				return err
			default:
				cancel()
				return <-done
			}
		}
		err := resume(250)
		require.True(t, IsResourceVersionExpired(err), "a resume from before the lost write must expire, got %v", err)
		require.NoError(t, resume(300))

		// While the backend does not know which writes were lost, every resume expires.
		backend.lost.Hold()
		err = resume(300)
		require.True(t, IsResourceVersionExpired(err), "a held resume must expire, got %v", err)
		backend.lost.Release()
		require.NoError(t, resume(300))
	})
}

// A gap reported while the floors are raised for an earlier one keeps every
// resume held until they are raised again: the first raise read a boundary
// from before the newer gap.
func TestUnknownGapsHoldAcrossANewerGap(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		floors := &heldFloors{}
		var (
			mu                sync.Mutex
			raises            int
			heldAtSecondRaise bool
		)
		var gaps *UnknownGaps
		gaps = NewUnknownGaps(floors, func(context.Context) error {
			mu.Lock()
			raises++
			n := raises
			mu.Unlock()
			switch n {
			case 1:
				gaps.Report()
			case 2:
				mu.Lock()
				heldAtSecondRaise = floors.isHeld()
				mu.Unlock()
			}
			return nil
		}, &logging.NoOpLogger{})
		gaps.Capture(nil)
		go gaps.RaiseFloors(t.Context(), nil)

		gaps.Report()
		synctest.Wait()

		mu.Lock()
		defer mu.Unlock()
		require.Equal(t, 2, raises)
		require.True(t, heldAtSecondRaise, "resumes were released before the floors covered the newer gap")
		require.False(t, floors.isHeld())
	})
}

// heldFloors records whether resumes are held.
type heldFloors struct {
	mu   sync.Mutex
	held bool
}

func (f *heldFloors) Raise(GroupResource, int64) {}

func (f *heldFloors) Hold() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.held = true
}

func (f *heldFloors) Release() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.held = false
}

func (f *heldFloors) isHeld() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.held
}

func TestKVWatchResumeSurvivesOtherResourceBurst(t *testing.T) {
	backend := setupTestStorageBackend(t, withChannelNotifier)
	base := snowflakeFromTime(time.Now().Add(-time.Hour))
	seen, missed := durableWatchEvent(base), durableWatchEvent(base+1)
	saveWatchEvent(t, backend, seen)
	saveWatchEvent(t, backend, missed)
	srv := initWatchServer(t, backend)
	require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))

	ctx, cancel := context.WithTimeout(authlib.WithAuthInfo(t.Context(), newWatchTestUser()), 10*time.Second)
	defer cancel()
	// A dashboards watch tells when the broadcaster has processed the burst.
	dashboardsReq := bookmarkWatchRequest()
	dashboardsReq.AllowWatchBookmarks = false
	dashboardsReq.Options.Key = &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: watchTestNamespace}
	// A fixed cursor below the burst, unlike Since 0, does not depend on when
	// the watch reads the current RV.
	dashboardsReq.Since = missed.ResourceVersion
	dashboards := newMockWatchServer(ctx)
	go func() { _ = srv.Watch(dashboardsReq, dashboards) }()
	requireMetricEventually(t, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues("dashboards"), 1)

	const burst = defaultCacheSize + 100
	var last int64
	for i := range burst {
		event := durableWatchEvent(base + 2 + int64(i))
		event.Group, event.Resource = "dashboard.grafana.app", "dashboards"
		saveWatchEvent(t, backend, event)
		backend.notifier.Publish(event)
		last = event.ResourceVersion
	}
	for received := false; !received; {
		select {
		case event := <-dashboards.events:
			received = event.Resource.Version == last
		case <-ctx.Done():
			t.Fatal("broadcaster did not process the burst")
		}
	}

	req := bookmarkWatchRequest()
	req.AllowWatchBookmarks = false
	req.Options.Key.Name = ""
	req.Since = seen.ResourceVersion
	stream := newMockWatchServer(ctx)
	done := make(chan error, 1)
	go func() { done <- srv.Watch(req, stream) }()
	select {
	case event := <-stream.events:
		require.Equal(t, missed.ResourceVersion, event.Resource.Version)
	case err := <-done:
		t.Fatalf("watch ended before replaying the missed playlist event: %v", err)
	case <-ctx.Done():
		t.Fatal("missed playlist event was not replayed")
	}
	cancel()
	require.NoError(t, <-done)
}

func TestKVWatchIdleResourceBookmarksFollowOtherResources(t *testing.T) {
	for _, seeded := range []bool{false, true} {
		t.Run(map[bool]string{false: "unseeded", true: "seeded"}[seeded], func(t *testing.T) {
			backend := setupTestStorageBackend(t, withChannelNotifier)
			// Old enough that the filtered-progress delay does not cap the bookmark.
			base := snowflakeFromTime(time.Now().Add(-time.Hour))
			saveWatchEvent(t, backend, durableWatchEvent(base))
			srv := initWatchServerWithSeededWatches(t, backend, seeded)
			if seeded {
				require.NoError(t, srv.watchStartup.broadcaster.waitReady(t.Context()))
			}

			ctx, cancel := context.WithTimeout(authlib.WithAuthInfo(t.Context(), newWatchTestUser()), 10*time.Second)
			defer cancel()
			req := bookmarkWatchRequest()
			req.Options.Key.Name = ""
			req.Since = base
			stream := newMockWatchServer(ctx)
			done := make(chan error, 1)
			go func() { done <- srv.Watch(req, stream) }()
			requireMetricEventually(t, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues(watchTestResource), 1)

			dashboard := durableWatchEvent(base + 1)
			dashboard.Group, dashboard.Resource = "dashboard.grafana.app", "dashboards"
			saveWatchEvent(t, backend, dashboard)
			backend.notifier.Publish(dashboard)
			select {
			case event := <-stream.events:
				require.Equal(t, resourcepb.WatchEvent_BOOKMARK, event.Type)
				require.Equal(t, dashboard.ResourceVersion, event.Resource.Version)
			case err := <-done:
				t.Fatalf("watch ended early: %v", err)
			case <-ctx.Done():
				t.Fatal("other resources did not advance the idle watch's bookmark")
			}
			cancel()
			require.NoError(t, <-done)
		})
	}
}

type failingListKVWatchBackend struct {
	unseededKVWatchBackend
}

func (b *failingListKVWatchBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, errUnimplemented
}

func TestWatchBeforeBroadcasterIsInstalled(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend := &gatedWatchBackend{seed: make(chan watchSeed, 1), events: make(chan *WrittenEvent)}
		backend.seed <- watchSeed{initialCacheFloor: 100, highestRV: 100}
		expiry := NewWatchExpiry()
		var srv *server
		srv, err := NewUninitializedResourceServer(ResourceServerOptions{
			Backend: backend, StorageMetrics: ProvideStorageMetrics(prometheus.NewRegistry()), WatchExpiry: expiry,
			SeededWatchesEnabled: true,
			AccessClient: compileHookAccess{AccessClient: authlib.FixedAccessClient(true), onCompile: func() {
				// Init publishes the watcher during authorization, after Watch took its snapshot.
				expiry.Invalidate()
				require.NoError(t, srv.Init(t.Context()))
			}},
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, srv.Stop(t.Context())) }()

		ctx := authlib.WithAuthInfo(t.Context(), newWatchTestUser())
		err = srv.Watch(&resourcepb.WatchRequest{}, newMockWatchServer(ctx))
		require.Equal(t, codes.InvalidArgument, status.Code(err), "%v", err)
		err = srv.Watch(bookmarkWatchRequest(), newMockWatchServer(ctx))
		require.Equal(t, codes.Unavailable, status.Code(err), "%v", err)
	})
}

// Negative cursors predate resume floors: such watches still replay every
// cached event of their collection, as before watches were routed.
func TestWatchNegativeSinceReplaysCache(t *testing.T) {
	for _, backendType := range []string{"legacy", "kv"} {
		t.Run(backendType, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				events := make(chan *WrittenEvent)
				defer close(events)
				var backend StorageBackend = &legacyWatchBackend{events: events}
				if backendType == "kv" {
					backend = &unseededKVWatchBackend{events: events}
				}
				srv := initWatchServerWithSeededWatches(t, backend, false)
				events <- bookmarkWrittenEvent(100)
				synctest.Wait()

				ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
				defer cancel()
				req := bookmarkWatchRequest()
				req.Since = -1
				req.AllowWatchBookmarks = false
				stream := newMockWatchServer(ctx)
				done := make(chan error, 1)
				go func() { done <- srv.Watch(req, stream) }()
				synctest.Wait()
				require.NotEmpty(t, stream.events, "the cached event was not replayed")
				require.Equal(t, int64(100), (<-stream.events).Resource.Version)
				cancel()
				require.NoError(t, <-done)
			})
		})
	}
}

func TestWatchRefillsOverflowAsConsumerCatchesUp(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		srv, err := NewUninitializedResourceServer(ResourceServerOptions{Backend: &UnimplementedStorageBackend{}})
		require.NoError(t, err)
		defer srv.cancel()
		events := make(chan *WrittenEvent)
		b := newBroadcasterWithSizes(ctx, events, 1, 2, newBroadcasterMetrics(prometheus.NewRegistry()), writtenEventIdentity, nil)
		srv.setWatchState(b, nil)

		req := bookmarkWatchRequest()
		req.Since = -1
		req.AllowWatchBookmarks = false
		stream := newMockWatchServer(ctx)
		stream.events = make(chan *resourcepb.WatchEvent)
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, stream) }()
		synctest.Wait()

		// Block the first send, fill the delivery channel, and fill overflow to its cap.
		events <- bookmarkWrittenEvent(1)
		synctest.Wait()
		for rv := int64(2); rv <= 4; rv++ {
			events <- bookmarkWrittenEvent(rv)
		}
		foreign := bookmarkWrittenEvent(5)
		foreign.Key.Namespace = "other"
		events <- foreign

		for rv := int64(1); rv <= 4; rv++ {
			synctest.Wait()
			select {
			case event := <-stream.events:
				require.Equal(t, rv, event.Resource.Version)
			default:
				t.Fatalf("watch did not deliver RV %d before the next drain tick", rv)
			}
		}

		cancel()
		require.NoError(t, <-done)
	})
}

func TestLegacyWatchFromNowWithoutCurrentRV(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		events := make(chan *WrittenEvent)
		defer close(events)
		srv := initWatchServerWithSeededWatches(t, &legacyWatchBackend{events: events}, false)

		events <- bookmarkWrittenEvent(100)
		foreign := bookmarkWrittenEvent(200)
		foreign.Key.Resource = "other"
		events <- foreign
		synctest.Wait()

		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		req := bookmarkWatchRequest()
		req.Options.Key.Namespace = ""
		req.Since = 0
		req.AllowWatchBookmarks = false
		stream := newMockWatchServer(ctx)
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, stream) }()
		synctest.Wait()
		require.Empty(t, done, "the watch must stay open when list is unavailable")
		require.Empty(t, stream.events, "a watch from now must not replay its cache")

		// Another collection's higher RV cannot filter out a live event.
		events <- bookmarkWrittenEvent(150)
		synctest.Wait()
		require.Len(t, stream.events, 1)
		event := <-stream.events
		require.Equal(t, resourcepb.WatchEvent_ADDED, event.Type)
		require.Equal(t, int64(150), event.Resource.Version)
		cancel()
		require.NoError(t, <-done)
	})
}

// Without the current RV there is no safe start for a fresh KV watch:
// notification RVs can be ahead of writes that commit later.
func TestKVWatchFromNowFailsWithoutCurrentRV(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		events := make(chan *WrittenEvent)
		defer close(events)
		backend := &failingListKVWatchBackend{unseededKVWatchBackend{events: events}}
		srv := initWatchServerWithSeededWatches(t, backend, false)
		events <- bookmarkWrittenEvent(200)
		synctest.Wait()

		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		req := bookmarkWatchRequest()
		req.Since = 0
		stream := newMockWatchServer(ctx)
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, stream) }()
		synctest.Wait()
		select {
		case err := <-done:
			require.Equal(t, codes.Unavailable, status.Code(err), "got %v", err)
			require.NotContains(t, status.Convert(err).Message(), errUnimplemented.Error(), "backend errors must stay on the server")
		default:
			t.Fatal("the watch started without a safe cursor")
		}
		require.Empty(t, stream.events)
	})
}

// A watch only takes cross-collection progress from events the broadcaster
// received after it subscribed: earlier ones were not replayed to it, so a
// write in its own collection with a lower RV can still arrive.
func TestKVWatchBookmarksIgnoreProgressBeforeSubscribing(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		base := snowflakeFromTime(advanceBookmarkClock().Add(-time.Hour))
		events := make(chan *WrittenEvent)
		defer close(events)
		srv := initWatchServerWithSeededWatches(t, &unseededKVWatchBackend{events: events}, false)
		dashboard := func(rv int64) *WrittenEvent {
			event := bookmarkWrittenEvent(rv)
			event.Key = &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: watchTestNamespace, Name: "d"}
			return event
		}
		events <- dashboard(base + 200)
		synctest.Wait()

		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		req := bookmarkWatchRequest()
		req.Options.Key.Name = ""
		req.Since = base
		stream := newMockWatchServer(ctx)
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, stream) }()
		synctest.Wait()
		time.Sleep(2 * time.Second)
		synctest.Wait()
		require.Empty(t, stream.events, "progress from before the watch subscribed must not become a bookmark")

		events <- dashboard(base + 300)
		synctest.Wait()
		time.Sleep(time.Second)
		synctest.Wait()
		require.NotEmpty(t, stream.events)
		bookmark := <-stream.events
		require.Equal(t, resourcepb.WatchEvent_BOOKMARK, bookmark.Type)
		require.Equal(t, base+300, bookmark.Resource.Version)
		cancel()
		require.NoError(t, <-done)
	})
}

// A late KV write in another namespace of the watched collection still
// advances the bookmark, as it did when the watch received and filtered it.
func TestKVWatchBookmarksFollowLateSameCollectionWrites(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		base := snowflakeFromTime(advanceBookmarkClock().Add(-time.Hour))
		events := make(chan *WrittenEvent)
		defer close(events)
		srv := initWatchServerWithSeededWatches(t, &unseededKVWatchBackend{events: events}, false)
		dashboard := bookmarkWrittenEvent(base + 300)
		dashboard.Key = &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: watchTestNamespace, Name: "d"}
		events <- dashboard
		synctest.Wait()

		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), newWatchTestUser()))
		defer cancel()
		req := bookmarkWatchRequest()
		req.Options.Key.Name = ""
		req.Since = base + 100
		stream := newMockWatchServer(ctx)
		done := make(chan error, 1)
		go func() { done <- srv.Watch(req, stream) }()
		synctest.Wait()

		late := bookmarkWrittenEvent(base + 200)
		late.Key.Namespace = "other"
		events <- late
		synctest.Wait()
		time.Sleep(time.Second)
		synctest.Wait()
		require.NotEmpty(t, stream.events, "the late write must advance the bookmark")
		bookmark := <-stream.events
		require.Equal(t, resourcepb.WatchEvent_BOOKMARK, bookmark.Type)
		require.Equal(t, base+200, bookmark.Resource.Version)
		cancel()
		require.NoError(t, <-done)
	})
}

const previousReadTestRV = 150

type previousReadBackend struct {
	legacyWatchBackend
	reads      atomic.Int64
	beforeRead func(context.Context, int64)
}

func (b *previousReadBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	attempt := b.reads.Add(1)
	if b.beforeRead != nil {
		b.beforeRead(ctx, attempt)
	}
	if ctx.Err() != nil {
		return nil
	}
	return &BackendReadResponse{Key: req.Key, ResourceVersion: req.ResourceVersion, Folder: "a", Value: []byte(`{"previous":true}`)}
}

func newPreviousReadTestServer(t *testing.T, beforeRead func(context.Context, int64)) (*server, *previousReadBackend) {
	t.Helper()
	backend := &previousReadBackend{
		legacyWatchBackend: legacyWatchBackend{events: make(chan *WrittenEvent)},
		beforeRead:         beforeRead,
	}
	srv := initWatchServerWithSeededWatches(t, backend, false)
	t.Cleanup(func() { close(backend.events) })
	return srv, backend
}

type previousReadAccess struct {
	authlib.AccessClient
	check func(context.Context, authlib.AuthInfo, string) (authlib.CheckResponse, error)
}

func (a previousReadAccess) Check(ctx context.Context, user authlib.AuthInfo, _ authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return a.check(ctx, user, folder)
}

func (a previousReadAccess) Compile(ctx context.Context, user authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(_, folder string) bool {
		result, err := a.check(ctx, user, folder)
		return err == nil && result.Allowed
	}, authlib.NoopZookie{}, nil
}

func startPreviousReadWatch(t *testing.T, srv *server, user authlib.AuthInfo) (*mockWatchServer, <-chan error) {
	t.Helper()
	stream := newMockWatchServer(authlib.WithAuthInfo(t.Context(), user))
	req := bookmarkWatchRequest()
	req.AllowWatchBookmarks = false
	done := make(chan error, 1)
	go func() { done <- srv.Watch(req, stream) }()
	return stream, done
}

func previousReadUpdate() *WrittenEvent {
	event := bookmarkWrittenEvent(200)
	event.Type, event.Folder, event.PreviousRV = resourcepb.WatchEvent_MODIFIED, "b", previousReadTestRV
	return event
}

func TestWatchSharesPreviousVersionReads(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		releaseRead := sync.OnceFunc(func() { close(release) })
		defer releaseRead()
		srv, backend := newPreviousReadTestServer(t, func(ctx context.Context, _ int64) {
			select {
			case <-release:
			case <-ctx.Done():
			}
		})
		both, onlyB := newWatchTestUser(), newWatchTestUser()
		onlyB.UserUID = "u456"
		srv.access = previousReadAccess{srv.access, func(_ context.Context, user authlib.AuthInfo, folder string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{Allowed: folder == "b" || (folder == "a" && user.GetUID() == both.GetUID())}, nil
		}}
		users := []authlib.AuthInfo{both, both, onlyB, onlyB}
		streams := make([]*mockWatchServer, 0, len(users))
		for _, user := range users {
			stream, _ := startPreviousReadWatch(t, srv, user)
			streams = append(streams, stream)
		}
		synctest.Wait()

		backend.events <- previousReadUpdate() // The update moved the object from folder a to folder b.
		synctest.Wait()
		require.EqualValues(t, 1, backend.reads.Load(), "watches must share the in-flight read")
		releaseRead()
		synctest.Wait()

		for i, stream := range streams {
			require.Len(t, stream.events, 1)
			event := <-stream.events
			require.EqualValues(t, 200, event.Resource.Version)
			if users[i].GetUID() == both.GetUID() {
				require.NotNil(t, event.Previous)
				require.EqualValues(t, previousReadTestRV, event.Previous.Version)
			} else {
				require.Nil(t, event.Previous, "the watch may see folder b but cannot read the prior revision in folder a")
			}
		}
	})
}

func TestWatchPreviousReadPanicReturnsInternal(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		srv, backend := newPreviousReadTestServer(t, func(context.Context, int64) { panic("previous read failed") })
		stream, done := startPreviousReadWatch(t, srv, newWatchTestUser())
		synctest.Wait()
		backend.events <- previousReadUpdate()
		synctest.Wait()
		require.Len(t, done, 1)
		require.Equal(t, codes.Internal, status.Code(<-done))
		require.Empty(t, stream.events)
	})
}

func readPreviousForTest(ctx context.Context, srv *server) (*resourcepb.ReadResponse, error) {
	return srv.readPrevious(ctx, newWatchTestUser(), bookmarkWrittenEvent(200).Key, previousReadTestRV)
}

func startPreviousRead(ctx context.Context, srv *server) <-chan error {
	done := make(chan error, 1)
	go func() {
		_, err := readPreviousForTest(ctx, srv)
		done <- err
	}()
	synctest.Wait()
	return done
}

func TestWatchPreviousReadCancelsWhenLastWaiterLeaves(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		canceled := make(chan struct{}, 1)
		srv, backend := newPreviousReadTestServer(t, func(ctx context.Context, _ int64) {
			<-ctx.Done()
			canceled <- struct{}{}
		})
		first, cancelFirst := context.WithCancel(t.Context())
		defer cancelFirst()
		second, cancelSecond := context.WithCancel(t.Context())
		defer cancelSecond()
		firstDone := startPreviousRead(first, srv)
		secondDone := startPreviousRead(second, srv)
		require.EqualValues(t, 1, backend.reads.Load())

		cancelFirst()
		synctest.Wait()
		require.Equal(t, codes.Canceled, status.Code(<-firstDone))
		require.Empty(t, canceled, "the other watch still needs the read")

		cancelSecond()
		synctest.Wait()
		require.Equal(t, codes.Canceled, status.Code(<-secondDone))
		require.Len(t, canceled, 1, "the final waiter must cancel the backend read")
	})
}

type previousReadTestQueue struct {
	running    atomic.Bool
	admissions atomic.Int64
}

func (q *previousReadTestQueue) Enqueue(_ context.Context, _ string, run func()) error {
	q.admissions.Add(1)
	q.running.Store(true)
	defer q.running.Store(false)
	run()
	return nil
}

func TestWatchPreviousReadAuthorizesUnderQoS(t *testing.T) {
	for _, tc := range []struct {
		name string
		wait bool
	}{{"successful", false}, {"deadline", true}} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				srv, backend := newPreviousReadTestServer(t, nil)
				queue := &previousReadTestQueue{}
				srv.queue = queue
				srv.queueConfig.Timeout = 100 * time.Millisecond
				srv.access = previousReadAccess{srv.access, func(ctx context.Context, _ authlib.AuthInfo, _ string) (authlib.CheckResponse, error) {
					if !queue.running.Load() {
						return authlib.CheckResponse{}, errors.New("authorization ran outside QoS")
					}
					if tc.wait {
						if _, ok := ctx.Deadline(); !ok {
							return authlib.CheckResponse{}, errors.New("authorization has no deadline")
						}
						<-ctx.Done()
						return authlib.CheckResponse{}, ctx.Err()
					}
					return allow()
				}}

				for i := range 2 {
					start := time.Now()
					rsp, err := readPreviousForTest(t.Context(), srv)
					if tc.wait {
						require.Equal(t, codes.DeadlineExceeded, status.Code(err), "%v", err)
						require.Equal(t, srv.queueConfig.Timeout, time.Since(start))
					} else {
						require.NoError(t, err)
						require.EqualValues(t, previousReadTestRV, rsp.ResourceVersion)
					}
					// The watch can report its deadline before the inline callback unwinds.
					synctest.Wait()
					require.EqualValues(t, i+1, queue.admissions.Load(), "each watch should use one QoS admission")
				}
				require.EqualValues(t, 1, backend.reads.Load(), "the second watch must authorize the cached revision")
			})
		})
	}
}

func TestWatchPreviousReadRetriesUseIndependentDeadlines(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const budget = 100 * time.Millisecond
		retryDeadlines := make(chan time.Time, 2)
		srv, backend := newPreviousReadTestServer(t, func(ctx context.Context, attempt int64) {
			if attempt == 1 {
				<-ctx.Done()
				return
			}
			deadline, _ := ctx.Deadline()
			retryDeadlines <- deadline
			select {
			case <-ctx.Done():
			case <-time.After(2 * time.Millisecond):
			}
		})
		srv.queueConfig.Timeout = budget

		first := startPreviousRead(t.Context(), srv)
		time.Sleep(time.Millisecond)
		earlyDeadline := time.Now().Add(budget)
		early := startPreviousRead(t.Context(), srv)
		time.Sleep(budget/2 - time.Millisecond)
		lateDeadline := time.Now().Add(budget)
		require.EqualValues(t, 1, backend.reads.Load(), "the first read is still in flight")

		rsp, err := readPreviousForTest(t.Context(), srv)
		require.NoError(t, err, "the late caller has time for its own retry")
		require.EqualValues(t, previousReadTestRV, rsp.ResourceVersion)
		require.Equal(t, codes.DeadlineExceeded, status.Code(<-first))
		require.Equal(t, codes.DeadlineExceeded, status.Code(<-early))
		require.EqualValues(t, 3, backend.reads.Load(), "both followers must start independent retries")
		require.ElementsMatch(t, []time.Time{earlyDeadline, lateDeadline}, []time.Time{<-retryDeadlines, <-retryDeadlines})
	})
}

func TestWatchPreviousReadStopsWaitingForStalledInlineRetry(t *testing.T) {
	for _, stalled := range []string{"backend", "authorization"} {
		t.Run(stalled, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				const budget = 100 * time.Millisecond
				release := make(chan struct{})
				defer close(release)
				srv, backend := newPreviousReadTestServer(t, func(ctx context.Context, attempt int64) {
					if attempt == 1 {
						<-ctx.Done()
					} else if stalled == "backend" {
						<-release
					}
				})
				if stalled == "authorization" {
					srv.access = previousReadAccess{srv.access, func(context.Context, authlib.AuthInfo, string) (authlib.CheckResponse, error) {
						<-release
						return allow()
					}}
				}
				srv.queueConfig.Timeout = budget

				first := startPreviousRead(t.Context(), srv)
				time.Sleep(budget / 2)
				late := startPreviousRead(t.Context(), srv)
				time.Sleep(budget)
				synctest.Wait()
				require.EqualValues(t, 2, backend.reads.Load())
				require.Equal(t, codes.DeadlineExceeded, status.Code(<-first))
				require.Len(t, late, 1, "the late watch must return while its retry is still blocked")
				require.Equal(t, codes.DeadlineExceeded, status.Code(<-late))
			})
		})
	}
}

func TestWatchPreviousReadRetriesWhenInitialInlineReadStalls(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		defer close(release)
		srv, backend := newPreviousReadTestServer(t, func(_ context.Context, attempt int64) {
			if attempt == 1 {
				<-release
			}
		})
		const budget = 100 * time.Millisecond
		srv.queueConfig.Timeout = budget

		first := startPreviousRead(t.Context(), srv)
		time.Sleep(budget / 2)
		rsp, err := readPreviousForTest(t.Context(), srv)
		require.NoError(t, err, "the follower must retry while the initial read is still blocked")
		require.EqualValues(t, previousReadTestRV, rsp.ResourceVersion)
		require.Equal(t, codes.DeadlineExceeded, status.Code(<-first))
		require.EqualValues(t, 2, backend.reads.Load())
	})
}

type previousReadQueueFunc func(func()) error

func (q previousReadQueueFunc) Enqueue(_ context.Context, _ string, run func()) error {
	return q(run)
}

func TestWatchPreviousReadFollowerRetriesQueueFull(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		srv, backend := newPreviousReadTestServer(t, nil)
		srv.queueConfig.MinBackoff = time.Millisecond
		srv.queueConfig.MaxBackoff = time.Millisecond
		srv.queueConfig.MaxRetries = 1
		release := make(chan struct{})
		unblock := sync.OnceFunc(func() { close(release) })
		defer unblock()
		var admissions atomic.Int64
		srv.queue = previousReadQueueFunc(func(run func()) error {
			if admissions.Add(1) <= 2 {
				<-release
				return scheduler.ErrTenantQueueFull
			}
			run()
			return nil
		})

		first := startPreviousRead(t.Context(), srv)
		follower := startPreviousRead(t.Context(), srv)
		unblock()
		require.Equal(t, codes.ResourceExhausted, status.Code(<-first))
		require.NoError(t, <-follower, "the follower still has its own admission budget")
		require.EqualValues(t, 1, backend.reads.Load())
	})
}

func TestWatchPreviousReadStopsWaitingForStalledAuthorization(t *testing.T) {
	for _, caller := range []string{"follower", "cache hit"} {
		t.Run(caller, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				readGate, authGate := make(chan struct{}), make(chan struct{})
				releaseRead := sync.OnceFunc(func() { close(readGate) })
				defer releaseRead()
				defer close(authGate)
				srv, backend := newPreviousReadTestServer(t, func(context.Context, int64) { <-readGate })
				user := newWatchTestUser()
				user.UserUID = "blocked"
				authStarted := make(chan struct{}, 1)
				srv.access = previousReadAccess{srv.access, func(_ context.Context, u authlib.AuthInfo, _ string) (authlib.CheckResponse, error) {
					if u.GetUID() == user.GetUID() {
						authStarted <- struct{}{}
						<-authGate
					}
					return allow()
				}}

				first := startPreviousRead(t.Context(), srv)
				if caller == "cache hit" {
					releaseRead()
					require.NoError(t, <-first)
				}
				done := make(chan error, 1)
				go func() {
					_, err := srv.readPrevious(t.Context(), user, bookmarkWrittenEvent(200).Key, previousReadTestRV)
					done <- err
				}()
				synctest.Wait()
				if caller == "follower" {
					releaseRead()
					require.NoError(t, <-first)
				}
				synctest.Wait()
				require.Len(t, authStarted, 1)
				time.Sleep(srv.queueConfig.Timeout)
				synctest.Wait()
				require.Len(t, done, 1, "the watch must return while authorization is still blocked")
				require.Equal(t, codes.DeadlineExceeded, status.Code(<-done))
				require.EqualValues(t, 1, backend.reads.Load())
			})
		})
	}
}

type heldPreviousReadQueue chan func()

func (q heldPreviousReadQueue) Enqueue(ctx context.Context, _ string, run func()) error {
	select {
	case q <- run:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func TestWatchPreviousReadRetryRechecksCacheAfterAdmission(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const budget = 100 * time.Millisecond
		srv, backend := newPreviousReadTestServer(t, func(ctx context.Context, attempt int64) {
			if attempt == 1 {
				<-ctx.Done()
			}
		})
		srv.queueConfig.Timeout = budget
		queue := make(heldPreviousReadQueue, 2)
		srv.queue = queue
		checks := 0
		srv.access = previousReadAccess{srv.access, func(context.Context, authlib.AuthInfo, string) (authlib.CheckResponse, error) {
			checks++
			return allow()
		}}

		first := startPreviousRead(t.Context(), srv)
		require.Len(t, queue, 1)
		go (<-queue)()
		synctest.Wait()
		time.Sleep(budget / 2)
		lateA, lateB := startPreviousRead(t.Context(), srv), startPreviousRead(t.Context(), srv)
		time.Sleep(budget / 2)
		synctest.Wait()
		require.Equal(t, codes.DeadlineExceeded, status.Code(<-first))
		require.Len(t, queue, 2, "both retries reached the queue before either one completed")

		(<-queue)()
		(<-queue)()
		synctest.Wait()
		require.NoError(t, <-lateA)
		require.NoError(t, <-lateB)
		require.EqualValues(t, 2, backend.reads.Load(), "the second admitted retry must use the cached result")
		require.Equal(t, 2, checks, "both callers must still authorize the revision")
	})
}

func TestPreviousReadsCache(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		p := newPreviousReads()
		key := bookmarkWrittenEvent(200).Key
		read := func(rv int64, next *BackendReadResponse) *BackendReadResponse {
			result := p.read(t.Context(), key, rv, time.Second, func(_ context.Context, lookup previousReadLookup) previousReadResult {
				return previousReadResult{backend: lookup(func() *BackendReadResponse { return next })}
			})
			require.NoError(t, result.err)
			return result.backend
		}
		transient := &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError}}
		missing := &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotFound}}
		older := &BackendReadResponse{ResourceVersion: 1}

		require.Same(t, transient, read(2, transient))
		require.Same(t, older, read(2, older), "transient errors must be retried")
		require.Same(t, missing, read(2, missing), "a non-exact revision must not mask a later NotFound")
		require.Same(t, missing, read(2, transient), "confirmed misses stay cached")
		time.Sleep(previousReadsTTL + time.Second)
		require.Same(t, transient, read(2, transient), "expired reads are loaded again")

		small := &BackendReadResponse{ResourceVersion: 1, Value: []byte("small")}
		oversized := &BackendReadResponse{ResourceVersion: 2, Value: make([]byte, 1, previousReadsMaxBytes+1)}
		require.Same(t, small, read(1, small))
		require.Same(t, oversized, read(2, oversized))
		require.Same(t, transient, read(2, transient), "an oversized allocation must be loaded again")
		require.Same(t, small, read(1, transient), "an oversized read must preserve existing entries")

		first := &BackendReadResponse{ResourceVersion: 3, Value: make([]byte, previousReadsMaxBytes/2+1)}
		second := &BackendReadResponse{ResourceVersion: 4, Value: make([]byte, previousReadsMaxBytes/2+1)}
		require.Same(t, first, read(3, first))
		require.Same(t, second, read(4, second))
		require.Same(t, second, read(4, transient), "the newest read stays")
		require.Same(t, transient, read(3, transient), "the byte limit drops the oldest reads")
	})
}
