package sql

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestChannelNotifier(t *testing.T) {
	t.Run("should notify subscribers of events", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		n := newChannelNotifier(5, &logging.NoOpLogger{})

		events, err := n.notify(ctx)
		require.NoError(t, err)

		testEvent := &resource.WrittenEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key: &resourcepb.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Name:      "test1",
				Namespace: "test",
			},
			ResourceVersion: 1,
		}
		n.send(ctx, testEvent)

		select {
		case event := <-events:
			require.Equal(t, testEvent, event)
		case <-ctx.Done():
			t.Fatal("timeout waiting for event")
		}
	})

	t.Run("should drop events when buffer is full", func(t *testing.T) {
		bufferSize := 2
		n := newChannelNotifier(bufferSize, &logging.NoOpLogger{})

		events, err := n.notify(context.Background())
		require.NoError(t, err)

		for i := 0; i < bufferSize+1; i++ {
			n.send(context.Background(), &resource.WrittenEvent{
				ResourceVersion: int64(i),
			})
		}

		require.Equal(t, bufferSize, len(events))
	})

	t.Run("should close subscriber channels when context cancelled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		n := newChannelNotifier(5, &logging.NoOpLogger{})

		events, err := n.notify(ctx)
		require.NoError(t, err)

		cancel()

		_, ok := <-events
		require.False(t, ok, "channel should be closed")
	})
}

type fakeBus struct {
	mu            sync.Mutex
	handlers      []func(subject string, data []byte)
	subscriptions int
}

type fakeBusSubscription struct{}

func (fakeBusSubscription) WaitReady(ctx context.Context) error { return ctx.Err() }
func (fakeBusSubscription) Unsubscribe() error                  { return nil }

func (b *fakeBus) Enabled() bool { return true }

func (b *fakeBus) Subscribe(_ context.Context, _ string, handler func(string, []byte), _ func()) (resource.Subscription, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers = append(b.handlers, handler)
	b.subscriptions++
	return fakeBusSubscription{}, nil
}

func (b *fakeBus) publish(t *testing.T, n *resourcepb.WatchNotification) {
	t.Helper()
	data, err := proto.Marshal(n)
	require.NoError(t, err)
	b.mu.Lock()
	handlers := append([]func(string, []byte){}, b.handlers...)
	b.mu.Unlock()
	require.NotEmpty(t, handlers, "not subscribed")
	for _, h := range handlers {
		h("subject", data)
	}
}

type countingInvalidator struct {
	mu    sync.Mutex
	count int
	// onInvalidate, when set, runs on each invalidation.
	onInvalidate func()
}

func (c *countingInvalidator) Invalidate() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.count++
	if c.onInvalidate != nil {
		c.onInvalidate()
	}
}

func (c *countingInvalidator) invalidations() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.count
}

// fakeHistory serves history rows for the versions it was given.
type fakeHistory struct {
	mu   sync.Mutex
	rows map[historyVersion]*historyPollResponse
	// everything serves a row for any version.
	everything bool
	// readErr, when set, fails every history read.
	readErr error
}

func (h *fakeHistory) add(name string, rv int64, action resourcepb.WatchEvent_Type) {
	h.mu.Lock()
	defer h.mu.Unlock()
	v := historyVersion{Namespace: "ns", Group: "g", Resource: "r", Name: name, ResourceVersion: rv}
	prev := rv - 1
	h.rows[v] = &historyPollResponse{
		Key:             resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: name},
		ResourceVersion: rv,
		PreviousRV:      &prev,
		Value:           []byte(name),
		Action:          int(action),
		Folder:          "folder",
	}
}

func (h *fakeHistory) read(_ context.Context, versions []historyVersion) (map[historyVersion]*historyPollResponse, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.readErr != nil {
		return nil, h.readErr
	}
	found := make(map[historyVersion]*historyPollResponse)
	for _, v := range versions {
		if row, ok := h.rows[v]; ok {
			found[v] = row
		} else if h.everything {
			found[v] = &historyPollResponse{
				Key:             resourcepb.ResourceKey{Namespace: v.Namespace, Group: v.Group, Resource: v.Resource, Name: v.Name},
				ResourceVersion: v.ResourceVersion,
				Action:          int(resourcepb.WatchEvent_MODIFIED),
			}
		}
	}
	return found, nil
}

// latest mirrors resource_version, which holds the RV after the last write.
func (h *fakeHistory) latest(context.Context) (groupResourceRV, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	latest := groupResourceRV{}
	for v := range h.rows {
		if latest[v.Group] == nil {
			latest[v.Group] = map[string]int64{}
		}
		latest[v.Group][v.Resource] = max(latest[v.Group][v.Resource], v.ResourceVersion+1)
	}
	return latest, nil
}

type natsNotifierTest struct {
	bus         *fakeBus
	history     *fakeHistory
	invalidator *countingInvalidator
	reg         *prometheus.Registry
	notifier    *natsNotifier
}

func newNatsNotifierTest(t *testing.T) *natsNotifierTest {
	return newNatsNotifierTestWithBuffer(t, 5)
}

func newNatsNotifierTestWithBuffer(t *testing.T, bufferSize int) *natsNotifierTest {
	done := make(chan struct{})
	t.Cleanup(func() { close(done) })
	nt := &natsNotifierTest{
		bus:         &fakeBus{},
		history:     &fakeHistory{rows: make(map[historyVersion]*historyPollResponse)},
		invalidator: &countingInvalidator{},
		reg:         prometheus.NewRegistry(),
	}
	nt.notifier = newNatsNotifier(notifierConfig{
		subscriber:      nt.bus,
		invalidator:     nt.invalidator,
		readHistory:     nt.history.read,
		listLatestRVs:   nt.history.latest,
		reg:             nt.reg,
		log:             &logging.NoOpLogger{},
		done:            done,
		watchBufferSize: bufferSize,
	})
	return nt
}

func (nt *natsNotifierTest) publish(t *testing.T, name string, rv int64) {
	nt.bus.publish(t, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_MODIFIED, Namespace: "ns", Group: "g", Resource: "r", Name: name,
		ResourceVersion: rv, PreviousResourceVersion: rv - 1,
	})
}

func (nt *natsNotifierTest) missingEvents(reason string) float64 {
	return testutil.ToFloat64(nt.notifier.missingEvents.WithLabelValues(reason))
}

// settle waits past the settle delay of the event source.
func settle() {
	time.Sleep(5 * time.Second)
	synctest.Wait()
}

func receive(t *testing.T, ch <-chan *resource.WrittenEvent) *resource.WrittenEvent {
	t.Helper()
	select {
	case e, ok := <-ch:
		require.True(t, ok, "channel closed")
		return e
	default:
		t.Fatal("expected an event")
		return nil
	}
}

func TestNatsNotifierHydratesEachConsumer(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		first, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		second, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		synctest.Wait()

		rv := time.Now().UnixMicro()
		nt.history.add("a", rv, resourcepb.WatchEvent_MODIFIED)
		nt.history.add("b", rv+1, resourcepb.WatchEvent_MODIFIED)
		// Arrival order is not RV order across instances.
		nt.publish(t, "b", rv+1)
		nt.publish(t, "a", rv)
		settle()

		for _, ch := range []<-chan *resource.WrittenEvent{first, second} {
			a := receive(t, ch)
			require.Equal(t, &resource.WrittenEvent{
				Key:             &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: "a"},
				Value:           []byte("a"),
				Type:            resourcepb.WatchEvent_MODIFIED,
				PreviousRV:      rv - 1,
				Folder:          "folder",
				ResourceVersion: rv,
			}, a)
			require.Equal(t, rv+1, receive(t, ch).ResourceVersion)
		}
		// Each consumer subscribes and reads on its own, as on KV.
		require.Equal(t, 2, nt.bus.subscriptions)
		require.Zero(t, nt.invalidator.invalidations())
	})
}

func TestNatsNotifierExpiresWatchesWhenHistoryIsGone(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		events, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		synctest.Wait()

		rv := time.Now().UnixMicro()
		nt.history.add("kept", rv+1, resourcepb.WatchEvent_MODIFIED)
		nt.publish(t, "pruned", rv)
		nt.publish(t, "kept", rv+1)
		settle()

		require.Equal(t, "kept", receive(t, events).Key.Name)
		require.Empty(t, events)
		require.Equal(t, 1, nt.invalidator.invalidations())
		require.Equal(t, float64(1), nt.missingEvents(missingReasonHistoryMissing))
	})
}

func TestNatsNotifierDeliverReportsMissingWritesFirst(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		rv := time.Now().UnixMicro()
		nt.history.add("kept", rv+2, resourcepb.WatchEvent_MODIFIED)
		batch := []resource.Event{
			{Namespace: "ns", Group: "g", Resource: "r", Name: "pruned", ResourceVersion: rv},
			{Namespace: "ns", Group: "g", Resource: "r", Name: "also-pruned", ResourceVersion: rv + 1},
			{Namespace: "ns", Group: "g", Resource: "r", Name: "kept", ResourceVersion: rv + 2},
		}

		out := make(chan *resource.WrittenEvent, len(batch))
		deliveredWhenExpired := -1
		nt.invalidator.onInvalidate = func() { deliveredWhenExpired = len(out) }
		require.True(t, nt.notifier.deliver(t.Context(), batch, groupResourceRV{}, out))

		// The gap is reported before a later write reaches the stream, so no
		// watch moves past the missing writes before it expires.
		require.Equal(t, 1, nt.invalidator.invalidations())
		require.Zero(t, deliveredWhenExpired)
		require.Equal(t, "kept", receive(t, out).Key.Name)
		// The metric counts lost writes, not batches.
		require.Equal(t, float64(2), nt.missingEvents(missingReasonHistoryMissing))

		nt.history.mu.Lock()
		nt.history.readErr = errors.New("database unavailable")
		nt.history.mu.Unlock()
		require.True(t, nt.notifier.deliver(t.Context(), batch, groupResourceRV{}, out))
		require.Equal(t, 2, nt.invalidator.invalidations())
		require.Empty(t, out)
		require.Equal(t, float64(len(batch)), nt.missingEvents(missingReasonHistoryReadFailed))
	})
}

func TestNatsNotifierStalledConsumerDoesNotDelayOthers(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTestWithBuffer(t, 2)
		stalled, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		other, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		synctest.Wait()

		rv := time.Now().UnixMicro()
		for i := range 3 {
			nt.history.add(fmt.Sprintf("item-%d", i), rv+int64(i), resourcepb.WatchEvent_ADDED)
			nt.publish(t, fmt.Sprintf("item-%d", i), rv+int64(i))
		}
		settle()

		// The other consumer gets every write while the stalled one is full.
		for i := range 3 {
			require.Equal(t, rv+int64(i), receive(t, other).ResourceVersion)
			synctest.Wait()
		}
		require.Len(t, stalled, 2)

		// The stalled consumer holds back its own delivery instead of losing writes.
		for i := range 3 {
			require.Equal(t, rv+int64(i), receive(t, stalled).ResourceVersion)
			synctest.Wait()
		}
		require.Zero(t, nt.invalidator.invalidations())
	})
}

// A consumer far behind makes the bus side drop notifications, as on KV: the
// watches expire, and the stream keeps delivering once the consumer catches up.
func TestNatsNotifierBusOverflowExpiresWatchesAndRecovers(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTestWithBuffer(t, 2)
		nt.history.everything = true
		events, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		synctest.Wait()

		rv := time.Now().UnixMicro()
		publishFrom := func(from int64, n int) {
			for i := range int64(n) {
				nt.publish(t, "item", from+i)
			}
		}
		// Fill the consumer and the settled buffer, so delivery blocks.
		publishFrom(rv, 10100)
		settle()
		// Then overflow the notifications waiting for it.
		publishFrom(rv+20000, 10100)
		synctest.Wait()
		require.Positive(t, nt.invalidator.invalidations(), "dropped notifications expire the watches")

		for len(events) > 0 {
			<-events
			synctest.Wait()
		}
		later := rv + 40000
		nt.publish(t, "later", later)
		settle()
		for e := range events {
			if e.ResourceVersion == later {
				break
			}
			synctest.Wait()
		}
		select {
		case _, open := <-events:
			require.True(t, open, "the stream is not closed")
		default:
		}
	})
}

func TestNatsNotifierClosesConsumersOnCancel(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		ctx, cancel := context.WithCancel(t.Context())
		events, err := nt.notifier.notify(ctx)
		require.NoError(t, err)

		nt.notifier.send(ctx, &resource.WrittenEvent{ResourceVersion: 1})
		synctest.Wait()
		require.Empty(t, events, "own writes come back through the bus")

		cancel()
		synctest.Wait()
		_, open := <-events
		require.False(t, open)
	})
}

func TestNatsNotifierStartsAfterTheLatestRVs(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		rv := time.Now().UnixMicro()
		// Written before the consumer started, announced after.
		nt.history.add("before", rv, resourcepb.WatchEvent_ADDED)
		events, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		// resource_version holds the RV after the last write, so the next one is above it.
		nt.history.add("after", rv+2, resourcepb.WatchEvent_ADDED)
		nt.publish(t, "before", rv)
		nt.publish(t, "after", rv+2)
		settle()

		require.Equal(t, "after", receive(t, events).Key.Name, "like a poller, a consumer starts after the latest RVs")
		require.Empty(t, events)
	})
}

func TestNatsNotifierClosesConsumersWhenTheBackendStops(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		done := make(chan struct{})
		h := &fakeHistory{rows: make(map[historyVersion]*historyPollResponse)}
		n := newNatsNotifier(notifierConfig{
			subscriber: &fakeBus{}, readHistory: h.read, listLatestRVs: h.latest,
			reg: prometheus.NewRegistry(), log: &logging.NoOpLogger{}, done: done, watchBufferSize: 5,
		})
		events, err := n.notify(t.Context())
		require.NoError(t, err)

		close(done)
		synctest.Wait()
		_, open := <-events
		require.False(t, open)

		later, err := n.notify(t.Context())
		require.NoError(t, err)
		_, open = <-later
		require.False(t, open, "a stopped backend has no stream")
	})
}

func TestNewNotifierSelectsNats(t *testing.T) {
	done := make(chan struct{})
	defer close(done)
	cfg := &notifierConfig{
		watchBufferSize: 10, log: &logging.NoOpLogger{}, done: done,
		subscriber: &fakeBus{}, readHistory: (&fakeHistory{}).read, listLatestRVs: (&fakeHistory{}).latest,
	}
	n, err := newNotifier(cfg)
	require.NoError(t, err)
	require.IsType(t, &natsNotifier{}, n)

	cfg.subscriber = &disabledBus{}
	n, err = newNotifier(cfg)
	require.NoError(t, err)
	require.IsType(t, &channelNotifier{}, n, "a disabled bus falls back to the default notifier")
}

type disabledBus struct{ fakeBus }

func (*disabledBus) Enabled() bool { return false }

// Global search follows written keys, which report lost keys so it reconciles,
// instead of the watch stream, which does not.
func TestBackendWatchWrittenKeys(t *testing.T) {
	types := []schema.GroupResource{{Group: "g", Resource: "r"}}

	t.Run("reads keys from the bus with the NATS notifier", func(t *testing.T) {
		bus := &fakeBus{}
		b := &backend{notifier: &natsNotifier{subscriber: bus}, log: &logging.NoOpLogger{}}
		keys, err := b.WatchWrittenKeys(t.Context(), types, func(string) {})
		require.NoError(t, err)

		bus.publish(t, &resourcepb.WatchNotification{
			Type: resourcepb.WatchNotification_ADDED, Group: "g", Resource: "r", Namespace: "ns", Name: "n", ResourceVersion: 7,
		})
		select {
		case key := <-keys:
			require.Equal(t, "n", key.Key.Name)
			require.Equal(t, int64(7), key.ResourceVersion)
		default:
			t.Fatal("expected the written key")
		}
	})

	t.Run("is unsupported without it", func(t *testing.T) {
		b := &backend{notifier: newChannelNotifier(1, &logging.NoOpLogger{}), log: &logging.NoOpLogger{}}
		_, err := b.WatchWrittenKeys(t.Context(), types, func(string) {})
		require.ErrorIs(t, err, resource.ErrWrittenKeysUnsupported)
	})
}
