package resource

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	authlib "github.com/grafana/authlib/types"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

type fakeSubscription struct {
	mu           sync.Mutex
	unsubscribed bool
}

func (f *fakeSubscription) WaitReady(ctx context.Context) error { return ctx.Err() }

func (f *fakeSubscription) Unsubscribe() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.unsubscribed = true
	return nil
}

func (f *fakeSubscription) wasUnsubscribed() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.unsubscribed
}

type fakeEventSubscriber struct {
	enabled bool

	// mu guards the fields below: the notifier's retry loop may call Subscribe
	// concurrently with a test inspecting the wiring.
	mu          sync.Mutex
	onReconnect func()
	subErr      error
	subject     string
	handler     func(subject string, data []byte)
	sub         *fakeSubscription
}

func (f *fakeEventSubscriber) Enabled() bool { return f.enabled }

func (f *fakeEventSubscriber) Subscribe(_ context.Context, subject string, handler func(subject string, data []byte), onReconnect func()) (Subscription, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.subErr != nil {
		return nil, f.subErr
	}
	f.subject = subject
	f.handler = handler
	f.onReconnect = onReconnect
	f.sub = &fakeSubscription{}
	return f.sub, nil
}

func (f *fakeEventSubscriber) setSubErr(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.subErr = err
}

func (f *fakeEventSubscriber) currentHandler() func(subject string, data []byte) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.handler
}

func mustMarshalNotification(t *testing.T, n *resourcepb.WatchNotification) []byte {
	t.Helper()
	data, err := proto.Marshal(n)
	require.NoError(t, err)
	return data
}

// recvEvent reads one Event from the channel, failing if none arrives promptly.
func recvEvent(t *testing.T, ch <-chan Event) Event {
	t.Helper()
	select {
	case evt, ok := <-ch:
		require.True(t, ok, "channel closed, expected an event")
		return evt
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event")
		return Event{}
	}
}

// expectNoEvent asserts nothing is delivered within a short window.
func expectNoEvent(t *testing.T, ch <-chan Event) {
	t.Helper()
	select {
	case evt := <-ch:
		t.Fatalf("expected no event, got %+v", evt)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestNatsNotifierWatch_ConvertsNotifications(t *testing.T) {
	cases := []struct {
		name   string
		typ    resourcepb.WatchNotification_Type
		action kv.DataAction
	}{
		{"added", resourcepb.WatchNotification_ADDED, DataActionCreated},
		{"modified", resourcepb.WatchNotification_MODIFIED, DataActionUpdated},
		{"deleted", resourcepb.WatchNotification_DELETED, DataActionDeleted},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sub := &fakeEventSubscriber{enabled: true}
			n := newNatsNotifier(sub, nil, log.NewNopLogger())

			ctx := t.Context()
			out := n.Watch(ctx, WatchOptions{})
			require.NotNil(t, sub.handler)
			assert.Equal(t, resourcewatch.SubjectAllResources, sub.subject)

			sub.handler("some.subject", mustMarshalNotification(t, &resourcepb.WatchNotification{
				Type:                    tc.typ,
				Group:                   "playlist.grafana.app",
				Resource:                "playlists",
				Namespace:               "default",
				Name:                    "abc",
				ResourceVersion:         42,
				Folder:                  "folder1",
				PreviousResourceVersion: 41,
			}))

			evt := recvEvent(t, out)
			assert.Equal(t, "playlist.grafana.app", evt.Group)
			assert.Equal(t, "playlists", evt.Resource)
			assert.Equal(t, "default", evt.Namespace)
			assert.Equal(t, "abc", evt.Name)
			assert.Equal(t, int64(42), evt.ResourceVersion)
			assert.Equal(t, "folder1", evt.Folder)
			assert.Equal(t, tc.action, evt.Action)
			// PreviousRV is carried on the wire.
			assert.Equal(t, int64(41), evt.PreviousRV)
		})
	}
}

func TestNatsNotifierDecode_PreviousMetadata(t *testing.T) {
	for _, tc := range []struct {
		name           string
		previousType   resourcepb.WatchNotification_Type
		previousFolder string
		previousAction kv.DataAction
	}{
		{name: "older publisher omits metadata"},
		{name: "created in root", previousType: resourcepb.WatchNotification_ADDED, previousAction: DataActionCreated},
		{name: "created in folder", previousType: resourcepb.WatchNotification_ADDED, previousFolder: "old-folder", previousAction: DataActionCreated},
		{name: "updated", previousType: resourcepb.WatchNotification_MODIFIED, previousFolder: "old-folder", previousAction: DataActionUpdated},
		{name: "deleted", previousType: resourcepb.WatchNotification_DELETED, previousFolder: "old-folder", previousAction: DataActionDeleted},
		{name: "unrecognized previous type still delivers current event", previousType: resourcepb.WatchNotification_Type(99), previousFolder: "old-folder"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			n := newNatsNotifier(nil, nil, log.NewNopLogger())
			data := mustMarshalNotification(t, &resourcepb.WatchNotification{
				Type:                    resourcepb.WatchNotification_MODIFIED,
				Group:                   "playlist.grafana.app",
				Resource:                "playlists",
				Namespace:               "default",
				Name:                    "abc",
				ResourceVersion:         42,
				Folder:                  "new-folder",
				PreviousResourceVersion: 41,
				PreviousType:            tc.previousType,
				PreviousFolder:          tc.previousFolder,
			})

			event, ok := n.decode("some.subject", data)
			require.True(t, ok)
			require.Equal(t, Event{
				Namespace:       "default",
				Group:           "playlist.grafana.app",
				Resource:        "playlists",
				Name:            "abc",
				ResourceVersion: 42,
				Action:          DataActionUpdated,
				Folder:          "new-folder",
				PreviousRV:      41,
				PreviousAction:  tc.previousAction,
				PreviousFolder:  tc.previousFolder,
			}, event)
		})
	}
}

func TestNatsNotifierWatch_EmitsInResourceVersionOrder(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true}
	n := newNatsNotifier(sub, nil, log.NewNopLogger())

	ctx := t.Context()
	out := n.Watch(ctx, WatchOptions{})
	require.NotNil(t, sub.handler)

	// Deliver notifications for the same object out of RV order, all within one
	// settle window. The settle buffer must reorder them so the watcher sees
	// ascending resource versions regardless of bus arrival order.
	for _, rv := range []int64{30, 10, 20} {
		sub.handler("some.subject", mustMarshalNotification(t, &resourcepb.WatchNotification{
			Type:                    resourcepb.WatchNotification_MODIFIED,
			Group:                   "playlist.grafana.app",
			Resource:                "playlists",
			Namespace:               "default",
			Name:                    "abc",
			ResourceVersion:         rv,
			PreviousResourceVersion: rv - 1,
		}))
	}

	require.Equal(t, int64(10), recvEvent(t, out).ResourceVersion)
	require.Equal(t, int64(20), recvEvent(t, out).ResourceVersion)
	require.Equal(t, int64(30), recvEvent(t, out).ResourceVersion)
}

func TestNatsNotifierWatch_DropsUnknownType(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true}
	dropped := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "dropped_total"}, []string{"reason"})
	n := newNatsNotifier(sub, dropped, log.NewNopLogger())

	ctx := t.Context()
	out := n.Watch(ctx, WatchOptions{})

	sub.handler("some.subject", mustMarshalNotification(t, &resourcepb.WatchNotification{
		Type:            resourcepb.WatchNotification_UNKNOWN,
		Group:           "g",
		Resource:        "r",
		ResourceVersion: 1,
	}))

	expectNoEvent(t, out)
	assert.Equal(t, float64(1), testutil.ToFloat64(dropped.WithLabelValues("unknown_type")))
}

func TestNatsNotifierWatch_DropsUnmarshalableData(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true}
	dropped := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "dropped_total"}, []string{"reason"})
	n := newNatsNotifier(sub, dropped, log.NewNopLogger())

	ctx := t.Context()
	out := n.Watch(ctx, WatchOptions{})

	sub.handler("some.subject", []byte("not a valid protobuf"))

	expectNoEvent(t, out)
	assert.Equal(t, float64(1), testutil.ToFloat64(dropped.WithLabelValues("unmarshal_error")))
}

func TestThrottledLog_ReleasesOneLinePerInterval(t *testing.T) {
	// The fake clock lets the interval expire without the test waiting for it.
	synctest.Test(t, func(t *testing.T) {
		tl := newThrottledLog(time.Hour)

		suppressed, ok := tl.next("reason")
		require.True(t, ok, "first occurrence must always be logged")
		assert.Zero(t, suppressed)

		for range 5 {
			_, ok := tl.next("reason")
			assert.False(t, ok, "further occurrences within the interval must be throttled")
		}

		// Once the interval expires the next line is released, reporting everything
		// suppressed since the previous one.
		time.Sleep(time.Hour)
		suppressed, ok = tl.next("reason")
		require.True(t, ok)
		assert.Equal(t, int64(5), suppressed)

		// The count resets once reported.
		time.Sleep(time.Hour)
		suppressed, ok = tl.next("reason")
		require.True(t, ok)
		assert.Zero(t, suppressed)
	})
}

func TestThrottledLog_ThrottlesKeysIndependently(t *testing.T) {
	tl := newThrottledLog(time.Hour)

	_, ok := tl.next("first")
	require.True(t, ok)
	_, ok = tl.next("first")
	require.False(t, ok)

	// A storm on one key must not hide the first occurrence of another.
	_, ok = tl.next("second")
	assert.True(t, ok)
}

func TestNatsNotifierDrop_CountsEveryDropWhileThrottlingLogs(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		sub := &fakeEventSubscriber{enabled: true}
		dropped := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "dropped_total"}, []string{"reason"})
		logger := &logtest.Fake{}
		n := newNatsNotifier(sub, dropped, logger)

		// The counter is the source of truth for drop rates, so it must stay exact
		// even though the warning is throttled to one line per interval.
		for range 100 {
			n.drop(dropReasonBufferFull, "dropped watch notification, channel full", "subject", "some.subject")
		}
		assert.Equal(t, float64(100), testutil.ToFloat64(dropped.WithLabelValues(dropReasonBufferFull)))
		require.Equal(t, 1, logger.WarnLogs.Calls, "only the first drop should be logged within the interval")

		// The next drop after the interval logs again and reports the backlog, so a
		// throttled line still conveys volume.
		time.Sleep(dropLogInterval)
		n.drop(dropReasonBufferFull, "dropped watch notification, channel full", "subject", "some.subject")
		require.Equal(t, 2, logger.WarnLogs.Calls)
		assert.Contains(t, logger.WarnLogs.Ctx, "suppressed_since_last_log")
		assert.Contains(t, logger.WarnLogs.Ctx, int64(99))
	})
}

func TestNatsNotifierWatch_ClosesAndUnsubscribesOnContextCancel(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true}
	n := newNatsNotifier(sub, nil, log.NewNopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	out := n.Watch(ctx, WatchOptions{})
	cancel()

	select {
	case _, ok := <-out:
		assert.False(t, ok, "channel should be closed after context cancel")
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for channel to close")
	}

	// AfterFunc runs asynchronously; give it a moment.
	require.Eventually(t, func() bool {
		return sub.sub != nil && sub.sub.wasUnsubscribed()
	}, 2*time.Second, 10*time.Millisecond, "expected Unsubscribe to be called")
}

func TestNatsNotifierWatch_RetriesUntilSubscribeSucceeds(t *testing.T) {
	// Bus unreachable at first, then available: Watch must keep the channel open
	// and re-subscribe rather than closing it and losing the watch.
	sub := &fakeEventSubscriber{enabled: true, subErr: errors.New("boom")}
	n := newNatsNotifier(sub, nil, log.NewNopLogger())

	ctx := t.Context()
	// Small backoff bounds keep the subscription retry loop fast for the test.
	out := n.Watch(ctx, WatchOptions{MinBackoff: 10 * time.Millisecond, MaxBackoff: 20 * time.Millisecond})

	// The channel must stay open across the failed subscribe.
	select {
	case _, ok := <-out:
		require.True(t, ok, "channel closed on subscribe error; expected retry to keep it open")
	case <-time.After(50 * time.Millisecond):
	}

	// Bus recovers; the retry loop should subscribe and start delivering.
	sub.setSubErr(nil)
	require.Eventually(t, func() bool {
		return sub.currentHandler() != nil
	}, 2*time.Second, 10*time.Millisecond, "expected retry to subscribe once the bus is reachable")

	sub.currentHandler()("some.subject", mustMarshalNotification(t, &resourcepb.WatchNotification{
		Type:            resourcepb.WatchNotification_ADDED,
		Group:           "playlist.grafana.app",
		Resource:        "playlists",
		Namespace:       "default",
		Name:            "abc",
		ResourceVersion: 1,
	}))
	assert.Equal(t, "abc", recvEvent(t, out).Name)
}

func TestNatsNotifierPublishIsNoOp(t *testing.T) {
	n := newNatsNotifier(&fakeEventSubscriber{enabled: true}, nil, log.NewNopLogger())
	assert.NotPanics(t, func() {
		n.Publish(Event{Group: "g", Resource: "r", ResourceVersion: 1})
	})
}

func TestNATSWatchRecovery(t *testing.T) {
	startBroker := func(port int) *natsserver.Server {
		broker, err := natsserver.NewServer(&natsserver.Options{Host: "127.0.0.1", Port: port, NoSigs: true, NoLog: true})
		require.NoError(t, err)
		broker.Start()
		t.Cleanup(func() { broker.Shutdown(); broker.WaitForShutdown() })
		require.True(t, broker.ReadyForConnections(5*time.Second))
		return broker
	}
	broker := startBroker(natsserver.RANDOM_PORT)
	port := broker.Addr().(*net.TCPAddr).Port
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{broker.ClientURL()}}
	busCfg := nats.ProvideNATSConfig(cfg, nil)
	pubConn, err := natsclient.Connect(broker.ClientURL(), natsclient.ReconnectBufSize(-1), natsclient.MaxReconnects(-1), natsclient.ReconnectWait(10*time.Millisecond))
	require.NoError(t, err)
	t.Cleanup(pubConn.Close)
	pub := unbufferedWatchPublisher{conn: pubConn}
	sub := nats.ProvideSubscriber(busCfg, prometheus.NewRegistry())
	startNatsService(t, t.Context(), sub)
	// Restarted brokers register later cleanups; close clients before any broker.
	defer func() {
		pubConn.Close()
		sub.StopAsync()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		require.NoError(t, sub.AwaitTerminated(ctx))
	}()
	srv := newWatchTestServer(t, watchTestServerOpts{EventSubscriber: natsSubscriberAdapter{sub: sub}, EventPublisher: pub})
	ctx := authlib.WithAuthInfo(t.Context(), newWatchTestUser())
	req := &resourcepb.WatchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Group: watchTestGroup, Resource: watchTestResource, Namespace: watchTestNamespace}}, SendInitialEvents: true, AllowWatchBookmarks: true}
	require.NoError(t, createTestPlaylist(ctx, srv))
	watch, done := startNatsRecoveryWatch(t, ctx, srv, req)
	requireNatsRecoveryEvent(t, watch, resourcepb.WatchEvent_BOOKMARK)
	require.NoError(t, createTestPlaylist(ctx, srv))
	requireNatsRecoveryEvent(t, watch, resourcepb.WatchEvent_ADDED)
	broker.Shutdown()
	broker.WaitForShutdown()
	// The broker stays stopped until startBroker below, so clients cannot
	// reconnect while we wait for them to detect the outage.
	require.Eventually(t, func() bool { return sub.Health(ctx) != nil && !pubConn.IsConnected() }, 5*time.Second, time.Millisecond)
	// Publish fails while disconnected, but the committed resource survives in storage.
	require.ErrorIs(t, pub.Publish(ctx, "outage.probe", nil), natsclient.ErrReconnectBufExceeded)
	require.NoError(t, createTestPlaylist(ctx, srv))
	select {
	case err := <-done:
		t.Fatalf("watch expired before reconnect: %v", err)
	default:
	}
	startBroker(port)
	select {
	case err := <-done:
		require.True(t, IsResourceVersionExpired(err), "expected ResourceExpired, got %v", err)
		require.EqualValues(t, 410, AsErrorResult(err).Code)
	case <-time.After(10 * time.Second):
		t.Fatal("reconnected watch did not expire")
	}
	// A client receiving Expired must list again before opening its next watch.
	count := 0
	_, err = srv.backend.ListIterator(ctx, &resourcepb.ListRequest{Options: req.Options}, func(iter ListIterator) error {
		for iter.Next() {
			count++
		}
		return iter.Error()
	})
	require.NoError(t, err)
	require.Equal(t, 3, count, "relist must recover the resource whose notification was missed")
	replacement, _ := startNatsRecoveryWatch(t, ctx, srv, req)
	requireNatsRecoveryEvent(t, replacement, resourcepb.WatchEvent_BOOKMARK)
	require.Eventually(t, func() bool { return pubConn.IsConnected() }, 5*time.Second, time.Millisecond)
	require.NoError(t, createTestPlaylist(ctx, srv))
	requireNatsRecoveryEvent(t, replacement, resourcepb.WatchEvent_ADDED)
}

func startNatsRecoveryWatch(t *testing.T, ctx context.Context, srv *server, req *resourcepb.WatchRequest) (*mockWatchServer, <-chan error) {
	t.Helper()
	ctx, cancel := context.WithCancel(ctx)
	stream := newMockWatchServer(ctx)
	result := make(chan error, 1)
	exited := make(chan struct{})
	go func() {
		defer close(exited)
		result <- srv.Watch(req, stream)
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case <-exited:
		case <-time.After(5 * time.Second):
			t.Error("watch did not stop")
		}
	})
	return stream, result
}

func requireNatsRecoveryEvent(t *testing.T, stream *mockWatchServer, kind resourcepb.WatchEvent_Type) {
	t.Helper()
	timer := time.NewTimer(5 * time.Second)
	defer timer.Stop()
	for {
		select {
		case event := <-stream.events:
			if event.Type == kind {
				return
			}
		case <-timer.C:
			t.Fatalf("timed out waiting for %s", kind)
		}
	}
}

// reconnectDuringListBackend forces the gap after watch setup has started but
// before the watch enters its live loop.
type reconnectDuringListBackend struct {
	*kvStorageBackend
	reconnect func()
}

func (b *reconnectDuringListBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	b.reconnect()
	return b.kvStorageBackend.ListIterator(ctx, req, cb)
}

func TestNATSWatchReconnectDuringSetup(t *testing.T) {
	for _, initial := range []bool{false, true} {
		t.Run(fmt.Sprintf("initial_events_%t", initial), func(t *testing.T) {
			sub := &fakeEventSubscriber{enabled: true}
			srv := newWatchTestServer(t, watchTestServerOpts{EventSubscriber: sub})
			backend := srv.backend.(*kvStorageBackend)
			srv.backend = &reconnectDuringListBackend{kvStorageBackend: backend, reconnect: func() {
				sub.mu.Lock()
				reconnect := sub.onReconnect
				sub.mu.Unlock()
				require.NotNil(t, reconnect)
				reconnect()
			}}
			ctx, cancel := context.WithTimeout(authlib.WithAuthInfo(t.Context(), newWatchTestUser()), 5*time.Second)
			defer cancel()
			err := srv.Watch(&resourcepb.WatchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Group: watchTestGroup, Resource: watchTestResource}}, SendInitialEvents: initial}, newMockWatchServer(ctx))
			require.True(t, IsResourceVersionExpired(err), "reconnect during setup must expire the watch: %v", err)
		})
	}
}

func TestNATSNotifierInvalidatesAfterEachReconnect(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		sub := &fakeEventSubscriber{enabled: true}
		n := newNatsNotifier(sub, nil, log.NewNopLogger())
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		n.Watch(ctx, WatchOptions{})
		sub.mu.Lock()
		reconnect := sub.onReconnect
		sub.mu.Unlock()

		// A replacement watch must also expire if the bus disconnects again.
		for reconnectNumber := 1; reconnectNumber <= 2; reconnectNumber++ {
			watchBeforeReconnect := n.WatchInvalidation()
			select {
			case <-watchBeforeReconnect:
				t.Fatal("new watch is already expired")
			default:
			}
			reconnect()
			synctest.Wait()
			select {
			case <-watchBeforeReconnect:
			default:
				t.Fatalf("watch missed reconnect %d", reconnectNumber)
			}
		}
	})
}

// Core NATS can lose notifications while a subscriber is offline. Disable the
// publisher's reconnect buffer so this test cannot recover the write by replay.
type unbufferedWatchPublisher struct{ conn *natsclient.Conn }

func (p unbufferedWatchPublisher) Enabled() bool { return true }
func (p unbufferedWatchPublisher) Publish(ctx context.Context, subject string, data []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return p.conn.Publish(subject, data)
}
