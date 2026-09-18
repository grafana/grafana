package resource

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
)

func initWatchServer(t *testing.T, backend StorageBackend) *server {
	t.Helper()
	srv, err := NewUninitializedResourceServer(ResourceServerOptions{
		Backend: backend, StorageMetrics: ProvideStorageMetrics(prometheus.NewRegistry()), BookmarkFrequency: time.Second,
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
					require.Equal(t, codes.OutOfRange, status.Code(err))
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
			event := durableWatchEvent(backend.snowflake.Generate().Int64())
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

func (b *gatedWatchBackend) watchWriteEventsWithSeed(ctx context.Context) (watchSeed, <-chan *WrittenEvent, error) {
	select {
	case <-ctx.Done():
		return watchSeed{}, nil, ctx.Err()
	case seed := <-b.seed:
		if b.err != nil {
			return watchSeed{}, nil, b.err
		}
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

func (b *recoverableWatchBackend) watchWriteEventsWithSeed(ctx context.Context) (watchSeed, <-chan *WrittenEvent, error) {
	if b.attempts.Add(1) == 1 {
		return watchSeed{}, nil, b.err
	}
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
