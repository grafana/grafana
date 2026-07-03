package appplugin

import (
	"context"
	"encoding/json"
	"io"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/watch"
)

const eventuallyTick = 2 * time.Millisecond

// fakeEventsStream implements storedObjectEventsStream: it records pushed
// events and lets tests feed subscription messages, mirroring the fake
// PluginClient pattern used by the admission tests.
type fakeEventsStream struct {
	mu      sync.Mutex
	sent    []*backend.StoredObjectEvent
	sendErr error

	subs      chan []string
	done      chan struct{}
	closeOnce sync.Once
}

func newFakeEventsStream() *fakeEventsStream {
	return &fakeEventsStream{
		subs: make(chan []string, 4),
		done: make(chan struct{}),
	}
}

func (f *fakeEventsStream) Send(ev *backend.StoredObjectEvent) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.sendErr != nil {
		return f.sendErr
	}
	f.sent = append(f.sent, ev)
	return nil
}

func (f *fakeEventsStream) RecvSubscription() ([]string, error) {
	select {
	case kinds := <-f.subs:
		return kinds, nil
	case <-f.done:
		return nil, io.EOF
	}
}

func (f *fakeEventsStream) Close() error {
	f.closeOnce.Do(func() { close(f.done) })
	return nil
}

func (f *fakeEventsStream) subscribe(kinds ...string) {
	f.subs <- kinds
}

func (f *fakeEventsStream) sentEvents() []*backend.StoredObjectEvent {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]*backend.StoredObjectEvent, len(f.sent))
	copy(out, f.sent)
	return out
}

func (f *fakeEventsStream) setSendErr(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sendErr = err
}

func (f *fakeEventsStream) closed() bool {
	select {
	case <-f.done:
		return true
	default:
		return false
	}
}

// fakeWatchSource implements storedObjectWatcher and records every watch it
// hands out so tests can emit events and observe stop calls.
type fakeWatchSource struct {
	mu       sync.Mutex
	watchers []*watch.RaceFreeFakeWatcher
	err      error
}

func (f *fakeWatchSource) Watch(_ context.Context, _ *metainternalversion.ListOptions) (watch.Interface, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	w := watch.NewRaceFreeFake()
	f.watchers = append(f.watchers, w)
	return w, nil
}

func (f *fakeWatchSource) watchCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.watchers)
}

func (f *fakeWatchSource) watcher(i int) *watch.RaceFreeFakeWatcher {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.watchers[i]
}

// fakeOpener hands out one fake stream per open call and records the calls.
type fakeOpener struct {
	mu      sync.Mutex
	streams []*fakeEventsStream
	err     error
}

func (f *fakeOpener) open(_ context.Context) (storedObjectEventsStream, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	s := newFakeEventsStream()
	f.streams = append(f.streams, s)
	return s, nil
}

func (f *fakeOpener) openCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.streams)
}

func (f *fakeOpener) stream(i int) *fakeEventsStream {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.streams[i]
}

func newTestPusher(open storedObjectEventsOpener, sources ...storedObjectEventSource) *storedObjectEventsPusher {
	return &storedObjectEventsPusher{
		pluginID:       "my-app",
		sources:        sources,
		open:           open,
		initialBackoff: time.Millisecond,
		maxBackoff:     20 * time.Millisecond,
		log:            logging.DefaultLogger,
	}
}

// startPusher runs the pusher and returns a stop function that cancels it and
// waits for the goroutine to exit.
func startPusher(t *testing.T, p *storedObjectEventsPusher) (stop func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		p.run(ctx)
	}()
	return func() {
		cancel()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Fatal("pusher did not stop after context cancellation")
		}
	}
}

func TestStoredObjectEventsPusher(t *testing.T) {
	t.Run("nothing is pushed before the plugin subscribes", func(t *testing.T) {
		source := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open, storedObjectEventSource{kind: "Watchlist", watcher: source})
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		// Give the pusher time to (incorrectly) start watches if it were going to.
		time.Sleep(25 * time.Millisecond)
		require.Zero(t, source.watchCount())
		require.Empty(t, opener.stream(0).sentEvents())

		opener.stream(0).subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 1 }, time.Second, eventuallyTick)
	})

	t.Run("only events after subscribe are pushed and mapping is correct", func(t *testing.T) {
		source := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open, storedObjectEventSource{kind: "Watchlist", watcher: source})
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		stream := opener.stream(0)
		stream.subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 1 }, time.Second, eventuallyTick)

		obj := newWatchlist(map[string]any{"title": "outages"})
		w := source.watcher(0)
		w.Add(obj)
		w.Modify(obj)
		w.Delete(obj)

		require.Eventually(t, func() bool { return len(stream.sentEvents()) == 3 }, time.Second, eventuallyTick)
		sent := stream.sentEvents()
		require.Equal(t, backend.StoredObjectEventCreated, sent[0].Type)
		require.Equal(t, backend.StoredObjectEventUpdated, sent[1].Type)
		require.Equal(t, backend.StoredObjectEventDeleted, sent[2].Type)
		for _, ev := range sent {
			require.Equal(t, "Watchlist", ev.Kind)
			require.Equal(t, "my-app", ev.PluginContext.PluginID)
			require.Equal(t, "default", ev.PluginContext.Namespace)

			var envelope map[string]any
			require.NoError(t, json.Unmarshal(ev.ObjectBytes, &envelope))
			require.Equal(t, "Watchlist", envelope["kind"])
			metadata, ok := envelope["metadata"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, "watchlist-1", metadata["name"])
		}
	})

	t.Run("org id is derived from the object namespace", func(t *testing.T) {
		source := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open, storedObjectEventSource{kind: "Watchlist", watcher: source})
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		stream := opener.stream(0)
		stream.subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 1 }, time.Second, eventuallyTick)

		obj := newWatchlist(nil)
		obj.Namespace = "org-2"
		source.watcher(0).Add(obj)

		require.Eventually(t, func() bool { return len(stream.sentEvents()) == 1 }, time.Second, eventuallyTick)
		ev := stream.sentEvents()[0]
		require.Equal(t, "org-2", ev.PluginContext.Namespace)
	})

	t.Run("subscription replacement starts and stops kind watches", func(t *testing.T) {
		watchlists := &fakeWatchSource{}
		alerts := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open,
			storedObjectEventSource{kind: "Watchlist", watcher: watchlists},
			storedObjectEventSource{kind: "Alert", watcher: alerts},
		)
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		stream := opener.stream(0)

		stream.subscribe("Watchlist")
		require.Eventually(t, func() bool { return watchlists.watchCount() == 1 }, time.Second, eventuallyTick)
		require.Zero(t, alerts.watchCount())

		// Full replacement: Alert in, Watchlist out.
		stream.subscribe("Alert")
		require.Eventually(t, func() bool { return alerts.watchCount() == 1 }, time.Second, eventuallyTick)
		require.Eventually(t, func() bool { return watchlists.watcher(0).IsStopped() }, time.Second, eventuallyTick)

		// The stopped watch is inert; only the Alert watch feeds the stream.
		watchlists.watcher(0).Add(newWatchlist(nil))
		alerts.watcher(0).Add(newWatchlist(nil))
		require.Eventually(t, func() bool { return len(stream.sentEvents()) == 1 }, time.Second, eventuallyTick)
		require.Equal(t, "Alert", stream.sentEvents()[0].Kind)
	})

	t.Run("empty subscription stops pushes but keeps the stream open", func(t *testing.T) {
		source := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open, storedObjectEventSource{kind: "Watchlist", watcher: source})
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		stream := opener.stream(0)
		stream.subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 1 }, time.Second, eventuallyTick)

		stream.subscribe() // empty replacement set
		require.Eventually(t, func() bool { return source.watcher(0).IsStopped() }, time.Second, eventuallyTick)
		require.False(t, stream.closed())
		require.Equal(t, 1, opener.openCount())

		// Re-subscribing on the same stream starts a fresh watch.
		stream.subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 2 }, time.Second, eventuallyTick)
	})

	t.Run("subscribing to an undeclared kind is ignored", func(t *testing.T) {
		source := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open, storedObjectEventSource{kind: "Watchlist", watcher: source})
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		stream := opener.stream(0)
		stream.subscribe("Nope", "Watchlist")

		require.Eventually(t, func() bool { return source.watchCount() == 1 }, time.Second, eventuallyTick)
		time.Sleep(25 * time.Millisecond)
		// The unknown kind neither starts a watch nor kills the session.
		require.Equal(t, 1, opener.openCount())
		require.False(t, stream.closed())
	})

	t.Run("send failure reconnects and waits for a fresh subscription", func(t *testing.T) {
		source := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open, storedObjectEventSource{kind: "Watchlist", watcher: source})
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		first := opener.stream(0)
		first.subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 1 }, time.Second, eventuallyTick)

		first.setSendErr(io.ErrClosedPipe)
		source.watcher(0).Add(newWatchlist(nil))

		require.Eventually(t, func() bool { return opener.openCount() == 2 }, time.Second, eventuallyTick)
		require.True(t, first.closed())
		require.Eventually(t, func() bool { return source.watcher(0).IsStopped() }, time.Second, eventuallyTick)

		// The new session pushes nothing until the plugin subscribes again.
		time.Sleep(25 * time.Millisecond)
		require.Equal(t, 1, source.watchCount())

		second := opener.stream(1)
		second.subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 2 }, time.Second, eventuallyTick)
		source.watcher(1).Add(newWatchlist(nil))
		require.Eventually(t, func() bool { return len(second.sentEvents()) == 1 }, time.Second, eventuallyTick)
	})

	t.Run("unexpected watch close reconnects the whole session", func(t *testing.T) {
		source := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open, storedObjectEventSource{kind: "Watchlist", watcher: source})
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		opener.stream(0).subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 1 }, time.Second, eventuallyTick)

		// Simulate the storage watch dying underneath the forwarder.
		source.watcher(0).Stop()

		require.Eventually(t, func() bool { return opener.openCount() == 2 }, time.Second, eventuallyTick)
		require.True(t, opener.stream(0).closed())
	})

	t.Run("unimplemented is retried only at the max backoff", func(t *testing.T) {
		var mu sync.Mutex
		var calls []time.Time
		open := func(_ context.Context) (storedObjectEventsStream, error) {
			mu.Lock()
			calls = append(calls, time.Now())
			mu.Unlock()
			return nil, grpcstatus.Error(codes.Unimplemented, "unknown service")
		}
		p := newTestPusher(open, storedObjectEventSource{kind: "Watchlist", watcher: &fakeWatchSource{}})
		stop := startPusher(t, p)
		defer stop()

		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()
			return len(calls) >= 2
		}, time.Second, eventuallyTick)
		mu.Lock()
		gap := calls[1].Sub(calls[0])
		mu.Unlock()
		require.GreaterOrEqual(t, gap, p.maxBackoff)
	})

	t.Run("shutdown stops the pusher and closes the stream", func(t *testing.T) {
		source := &fakeWatchSource{}
		opener := &fakeOpener{}
		p := newTestPusher(opener.open, storedObjectEventSource{kind: "Watchlist", watcher: source})
		stop := startPusher(t, p)

		require.Eventually(t, func() bool { return opener.openCount() == 1 }, time.Second, eventuallyTick)
		opener.stream(0).subscribe("Watchlist")
		require.Eventually(t, func() bool { return source.watchCount() == 1 }, time.Second, eventuallyTick)

		stop() // fails the test if run does not return promptly

		require.True(t, opener.stream(0).closed())
		require.True(t, source.watcher(0).IsStopped())
		require.Equal(t, 1, opener.openCount())
	})
}

func TestIsStoredObjectEventsUnimplemented(t *testing.T) {
	require.False(t, isStoredObjectEventsUnimplemented(nil))
	require.False(t, isStoredObjectEventsUnimplemented(io.EOF))
	require.True(t, isStoredObjectEventsUnimplemented(grpcstatus.Error(codes.Unimplemented, "nope")))
	// Wrapped along the way, as runOnce does with %w.
	wrapped := grpcstatus.Error(codes.Unimplemented, "nope")
	require.True(t, isStoredObjectEventsUnimplemented(&wrapErr{inner: wrapped}))
}

type wrapErr struct{ inner error }

func (w *wrapErr) Error() string { return "wrapped: " + w.inner.Error() }
func (w *wrapErr) Unwrap() error { return w.inner }

func TestStoredObjectEventsPostStartHook(t *testing.T) {
	watchlist := pluginschema.StoredObject{
		Name:     "Watchlist",
		Plural:   "watchlists",
		Singular: "watchlist",
		Spec:     objectSchema(),
	}

	t.Run("no stored objects declared registers no hook", func(t *testing.T) {
		b := newParseTestBuilder()
		b.eventsOpener = (&fakeOpener{}).open
		hooks, err := b.GetPostStartHooks()
		require.NoError(t, err)
		require.Empty(t, hooks)
	})

	t.Run("no events opener registers no hook", func(t *testing.T) {
		b := newParseTestBuilder(watchlist)
		hooks, err := b.GetPostStartHooks()
		require.NoError(t, err)
		require.Empty(t, hooks)
	})

	t.Run("declared stored objects with an opener register one hook", func(t *testing.T) {
		b := newParseTestBuilder(watchlist)
		b.eventsOpener = (&fakeOpener{}).open
		hooks, err := b.GetPostStartHooks()
		require.NoError(t, err)
		require.Len(t, hooks, 1)
		require.Contains(t, hooks, "appplugin-my-app-stored-object-events")
	})

	t.Run("parse error is propagated", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{Name: "Watchlist", Spec: objectSchema()})
		b.eventsOpener = (&fakeOpener{}).open
		_, err := b.GetPostStartHooks()
		require.Error(t, err)
	})
}
