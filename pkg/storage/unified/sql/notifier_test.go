package sql

import (
	"context"
	"errors"
	"fmt"
	"maps"
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
	reconnects    []func()
	subscriptions int
	// failSubscribe fails this many subscriptions before the next succeeds.
	failSubscribe int
}

type fakeBusSubscription struct{}

func (fakeBusSubscription) WaitReady(ctx context.Context) error { return ctx.Err() }
func (fakeBusSubscription) Unsubscribe() error                  { return nil }

func (b *fakeBus) Enabled() bool { return true }

func (b *fakeBus) Subscribe(_ context.Context, _ string, handler func(string, []byte), onReconnect func()) (resource.Subscription, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.failSubscribe > 0 {
		b.failSubscribe--
		return nil, errors.New("bus unavailable")
	}
	b.handlers = append(b.handlers, handler)
	b.reconnects = append(b.reconnects, onReconnect)
	b.subscriptions++
	return fakeBusSubscription{}, nil
}

func (b *fakeBus) reconnect() {
	b.mu.Lock()
	reconnects := append([]func(){}, b.reconnects...)
	b.mu.Unlock()
	for _, r := range reconnects {
		r()
	}
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
	// onInvalidate runs with the lock held, as a resume admitted right after.
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
	// latestErr, when set, fails every latest RV read.
	latestErr error
	// latestReads counts the latest RV reads.
	latestReads int
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
	h.latestReads++
	if h.latestErr != nil {
		return nil, h.latestErr
	}
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
	// stop stops the backend, as backend.Stop does.
	stop func()
}

func newNatsNotifierTest(t *testing.T) *natsNotifierTest {
	return newNatsNotifierTestWithBuffer(t, 5)
}

func newNatsNotifierTestWithBuffer(t *testing.T, bufferSize int) *natsNotifierTest {
	done := make(chan struct{})
	stop := sync.OnceFunc(func() { close(done) })
	t.Cleanup(stop)
	nt := &natsNotifierTest{
		stop:        stop,
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

// watch starts the watch server's stream.
func (nt *natsNotifierTest) watch(t *testing.T) (<-chan *resource.WrittenEvent, *floorRecorder) {
	t.Helper()
	floors := &floorRecorder{}
	_, events, err := nt.notifier.watchWithFloors(t.Context(), floors, func() {})
	require.NoError(t, err)
	return events, floors
}

// floorRecorder records raised and held resume floors.
type floorRecorder struct {
	mu     sync.Mutex
	floors map[resource.GroupResource]int64
	held   bool
}

func (f *floorRecorder) Hold() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.held = true
}

func (f *floorRecorder) Release() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.held = false
}

func (f *floorRecorder) isHeld() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.held
}

func (f *floorRecorder) Raise(gr resource.GroupResource, rv int64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.floors == nil {
		f.floors = map[resource.GroupResource]int64{}
	}
	f.floors[gr] = max(f.floors[gr], rv)
}

func (f *floorRecorder) get() map[resource.GroupResource]int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	return maps.Clone(f.floors)
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
		events, _ := nt.watch(t)
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
		var reported []missingEvent
		deliveredWhenReported := -1
		require.True(t, nt.notifier.deliver(t.Context(), batch, groupResourceRV{}, out, func(e missingEvent) {
			reported = append(reported, e)
			deliveredWhenReported = len(out)
		}))

		// The gap is reported before a later write reaches the stream, so no
		// watch moves past the missing writes before it expires.
		require.Len(t, reported, 1)
		require.Zero(t, deliveredWhenReported)
		require.Len(t, reported[0].lost, 2)
		require.Equal(t, "kept", receive(t, out).Key.Name)
		// The metric counts lost writes, not batches.
		require.Equal(t, float64(2), nt.missingEvents(missingReasonHistoryMissing))

		nt.history.mu.Lock()
		nt.history.readErr = errors.New("database unavailable")
		nt.history.mu.Unlock()
		reported = nil
		require.True(t, nt.notifier.deliver(t.Context(), batch, groupResourceRV{}, out, func(e missingEvent) { reported = append(reported, e) }))
		require.Len(t, reported, 1)
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

// A watch server far behind makes the bus side drop notifications, as on KV:
// the watches expire, and the stream keeps delivering once it catches up.
func TestNatsNotifierBusOverflowExpiresWatchesAndRecovers(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTestWithBuffer(t, 2)
		nt.history.everything = true
		events, _ := nt.watch(t)
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

// Other consumers recover from their own missing events by reopening their
// stream, so client watches go on.
func TestNatsNotifierClosesANonWatchConsumerOnOverflow(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTestWithBuffer(t, 2)
		nt.history.everything = true
		events, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		synctest.Wait()

		rv := time.Now().UnixMicro()
		for i := range int64(10100) {
			nt.publish(t, "item", rv+i)
		}
		settle()
		for i := range int64(10100) {
			nt.publish(t, "item", rv+20000+i)
		}
		synctest.Wait()

		requireClosed(t, events)
		require.Zero(t, nt.invalidator.invalidations())
	})
}

// requireClosed drains what the consumer was given and checks the stream ended.
func requireClosed(t *testing.T, events <-chan *resource.WrittenEvent) {
	t.Helper()
	for {
		select {
		case _, open := <-events:
			if !open {
				return
			}
			synctest.Wait()
		default:
			t.Fatal("the stream is still open")
		}
	}
}

func TestNatsNotifierRaisesFloorsForLostWrites(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		_, floors := nt.watch(t)
		synctest.Wait()

		rv := time.Now().UnixMicro()
		nt.publish(t, "pruned", rv)
		settle()

		require.Equal(t, map[resource.GroupResource]int64{{Group: "g", Resource: "r"}: rv}, floors.get())
	})
}

func TestNatsNotifierRaisesAllFloorsAfterABusReconnect(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		_, floors := nt.watch(t)
		other, err := nt.notifier.notify(t.Context())
		require.NoError(t, err)
		synctest.Wait()

		rv := time.Now().UnixMicro()
		nt.history.add("written", rv, resourcepb.WatchEvent_ADDED)
		// A reconnect may have lost any write, so every collection's floor
		// moves to its latest RV.
		nt.bus.reconnect()
		synctest.Wait()

		require.Equal(t, map[resource.GroupResource]int64{{Group: "g", Resource: "r"}: rv + 1}, floors.get())
		require.Equal(t, 1, nt.invalidator.invalidations(), "only the watch server's missing events expire watches")
		requireClosed(t, other)
	})
}

// A resume admitted right after the watches expire takes the new expiry
// generation, so only a floor raised, or a hold placed, before the expiry can
// reject it.
func TestNatsNotifierRaisesFloorsBeforeExpiringWatches(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		_, floors := nt.watch(t)
		gr := resource.GroupResource{Group: "g", Resource: "r"}
		type floorState struct {
			floor int64
			held  bool
		}
		var seen []floorState
		nt.invalidator.mu.Lock()
		nt.invalidator.onInvalidate = func() { seen = append(seen, floorState{floors.get()[gr], floors.isHeld()}) }
		nt.invalidator.mu.Unlock()
		synctest.Wait()

		rv := time.Now().UnixMicro()
		nt.publish(t, "pruned", rv)
		settle()
		nt.history.add("written", rv+10, resourcepb.WatchEvent_ADDED)
		// Keeps the floors from being raised and released before the
		// reconnect's expiry is seen.
		nt.history.mu.Lock()
		nt.history.latestErr = errors.New("database unavailable")
		nt.history.mu.Unlock()
		nt.bus.reconnect()
		synctest.Wait()

		require.Equal(t, 2, nt.invalidator.invalidations())
		// A missing row raises its floor; a bus reconnect holds every resume
		// until the latest RVs are read.
		require.Equal(t, []floorState{{rv, false}, {rv, true}}, seen)

		nt.history.mu.Lock()
		nt.history.latestErr = nil
		nt.history.mu.Unlock()
		time.Sleep(10 * time.Second)
		synctest.Wait()
		require.Equal(t, rv+11, floors.get()[gr])
		require.False(t, floors.isHeld())
	})
}

// A first subscription that succeeds only on a retry reports a gap before
// capture. The floors read after capture already cover it, so no resume is
// held.
func TestNatsNotifierRetriedStartHoldsNoResumes(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		nt.bus.failSubscribe = 1

		floors := &floorRecorder{}
		var heldAtCapture bool
		_, _, err := nt.notifier.watchWithFloors(t.Context(), floors, func() { heldAtCapture = floors.isHeld() })
		require.NoError(t, err)
		synctest.Wait()
		require.Equal(t, 1, nt.invalidator.invalidations(), "the retried subscription reported a gap")
		require.False(t, heldAtCapture)
		require.False(t, floors.isHeld())
	})
}

// A start that fails after the bus reported a gap, here a reconnect right
// after capture, must not leave every resume held.
func TestNatsNotifierFailedStartReleasesItsHold(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		nt.history.mu.Lock()
		nt.history.latestErr = errors.New("database unavailable")
		nt.history.mu.Unlock()

		floors := &floorRecorder{}
		var heldBeforeFailure bool
		_, _, err := nt.notifier.watchWithFloors(t.Context(), floors, func() {
			nt.bus.reconnect()
			synctest.Wait()
			heldBeforeFailure = floors.isHeld()
		})
		require.Error(t, err)
		require.True(t, heldBeforeFailure, "the reconnect held every resume")
		synctest.Wait()
		require.Equal(t, 1, nt.invalidator.invalidations())
		require.False(t, floors.isHeld())
	})
}

func TestNatsNotifierHoldsResumesUntilFloorsCanBeRaised(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		_, floors := nt.watch(t)
		gr := resource.GroupResource{Group: "g", Resource: "r"}
		synctest.Wait()

		rv := time.Now().UnixMicro()
		nt.history.add("written", rv, resourcepb.WatchEvent_ADDED)
		nt.history.mu.Lock()
		nt.history.latestErr = errors.New("database unavailable")
		nt.history.mu.Unlock()
		nt.bus.reconnect()
		synctest.Wait()

		// The watches expire at once, and resumes stay held while the floors
		// cannot be raised.
		require.Equal(t, 1, nt.invalidator.invalidations())
		time.Sleep(time.Minute)
		synctest.Wait()
		require.True(t, floors.isHeld())
		require.Zero(t, floors.get()[gr])

		nt.history.mu.Lock()
		nt.history.latestErr = nil
		nt.history.mu.Unlock()
		time.Sleep(10 * time.Second)
		synctest.Wait()
		require.False(t, floors.isHeld())
		require.Equal(t, rv+1, floors.get()[gr])
	})
}

// The worker that raises the floors after a reconnect ends with the backend,
// even while the latest RVs cannot be read and the watch context lives on.
func TestNatsNotifierStopsRaisingFloorsWithTheBackend(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		nt := newNatsNotifierTest(t)
		_, floors := nt.watch(t)
		synctest.Wait()

		nt.history.mu.Lock()
		nt.history.latestErr = errors.New("database unavailable")
		nt.history.mu.Unlock()
		nt.bus.reconnect()
		synctest.Wait()
		require.True(t, floors.isHeld())

		nt.stop()
		synctest.Wait()
		nt.history.mu.Lock()
		reads := nt.history.latestReads
		nt.history.mu.Unlock()
		time.Sleep(time.Minute)
		synctest.Wait()
		nt.history.mu.Lock()
		defer nt.history.mu.Unlock()
		require.Equal(t, reads, nt.history.latestReads, "latest RVs read after the backend stopped")
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
