package informer

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type recordedCall struct {
	kind     string // live | relist | reconnect | drop | relist_done | relist_error
	resource string
	verb     string
	rv       int64
	initial  bool
	reason   string // drop reason
	trigger  string // relist trigger
	count    int    // relist object count
}

// fakeMetrics records the informer's Metrics hook calls for assertion.
type fakeMetrics struct {
	mu    sync.Mutex
	calls []recordedCall
}

func (m *fakeMetrics) ObserveLiveEvent(resource, verb string, rv int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, recordedCall{kind: "live", resource: resource, verb: verb, rv: rv})
}

func (m *fakeMetrics) ObserveRelistEvent(resource, verb string, rv int64, initial bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, recordedCall{kind: "relist", resource: resource, verb: verb, rv: rv, initial: initial})
}

func (m *fakeMetrics) ObserveReconnect(resource string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, recordedCall{kind: "reconnect", resource: resource})
}

func (m *fakeMetrics) ObserveDrop(resource, reason string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, recordedCall{kind: "drop", resource: resource, reason: reason})
}

func (m *fakeMetrics) ObserveRelist(resource, trigger string, count int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, recordedCall{kind: "relist_done", resource: resource, trigger: trigger, count: count})
}

func (m *fakeMetrics) ObserveRelistError(resource string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, recordedCall{kind: "relist_error", resource: resource})
}

func (m *fakeMetrics) snapshot() []recordedCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]recordedCall(nil), m.calls...)
}

func (m *fakeMetrics) byKind(kind string) []recordedCall {
	var out []recordedCall
	for _, c := range m.snapshot() {
		if c.kind == kind {
			out = append(out, c)
		}
	}
	return out
}

var _ Metrics = (*fakeMetrics)(nil)

func objWithRV(name string, rv int64) *metav1.PartialObjectMetadata {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
		Name:            name,
		Namespace:       testNamespace,
		ResourceVersion: strconv.FormatInt(rv, 10),
	}}
}

func eventRV(action resourcepb.WatchNotification_Type, name string, rv int64) *resourcepb.WatchNotification {
	e := event(action, name)
	e.ResourceVersion = rv
	return e
}

// A live notification records ObserveLiveEvent with the notification's verb and
// resource version, so consumer-side latency and throughput can be derived.
func TestInformer_Metrics_LiveEvents(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		sub := newFakeSubscriber()
		m := &fakeMetrics{}
		list := func(context.Context) ([]runtime.Object, error) { return nil, nil }
		n := NewInformer(sub, testGVR, testNamespace, time.Minute, testQueueGroup, NewStore(), newObjectFunc, list, m)
		_, err := n.AddEventHandler(&recordingHandler{})
		require.NoError(t, err)

		stopCh := make(chan struct{})
		go n.Run(stopCh)
		defer func() { close(stopCh); synctest.Wait() }()

		synctest.Wait()
		require.True(t, sub.subscribed(subject()))

		sub.publish(t, subject(), eventRV(resourcepb.WatchNotification_ADDED, "a", 100))
		sub.publish(t, subject(), eventRV(resourcepb.WatchNotification_MODIFIED, "b", 200))
		sub.publish(t, subject(), eventRV(resourcepb.WatchNotification_DELETED, "c", 300))
		synctest.Wait()

		live := m.byKind("live")
		require.Len(t, live, 3)
		assert.Equal(t, recordedCall{kind: "live", resource: testGVR.Resource, verb: "add", rv: 100}, live[0])
		assert.Equal(t, recordedCall{kind: "live", resource: testGVR.Resource, verb: "update", rv: 200}, live[1])
		assert.Equal(t, recordedCall{kind: "live", resource: testGVR.Resource, verb: "delete", rv: 300}, live[2])
	})
}

// The initial list records every object as a relist add with initial=true (its
// latency is object age, not delivery delay); a steady-state relist records only
// the reconciled add/delete set, not the unchanged re-delivered updates.
func TestInformer_Metrics_RelistReconciledSetOnly(t *testing.T) {
	sub := newFakeSubscriber()
	m := &fakeMetrics{}

	var mu sync.Mutex
	seed := []runtime.Object{objWithRV("a", 10), objWithRV("b", 20)}
	list := func(context.Context) ([]runtime.Object, error) {
		mu.Lock()
		defer mu.Unlock()
		return seed, nil
	}
	n := NewInformer(sub, testGVR, testNamespace, time.Hour, testQueueGroup, NewStore(), newObjectFunc, list, m)
	_, err := n.AddEventHandler(&recordingHandler{})
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, n.relist(ctx, TriggerInitial)) // initial

	initial := m.byKind("relist")
	require.Len(t, initial, 2)
	for _, c := range initial {
		assert.Equal(t, "add", c.verb)
		assert.True(t, c.initial, "initial-list adds must be flagged initial")
	}

	// b vanishes, c appears; a is unchanged. Only the reconciled add(c)/delete(b)
	// are recorded — a's unchanged re-delivery is not an event.
	mu.Lock()
	seed = []runtime.Object{objWithRV("a", 10), objWithRV("c", 30)}
	mu.Unlock()
	require.NoError(t, n.relist(ctx, TriggerResync))

	var steady []recordedCall
	for _, c := range m.byKind("relist") {
		if !c.initial {
			steady = append(steady, c)
		}
	}
	require.Len(t, steady, 2)
	verbs := map[string]int64{}
	for _, c := range steady {
		verbs[c.verb] = c.rv
	}
	assert.Equal(t, int64(30), verbs["add"], "c added, carrying its RV")
	assert.Equal(t, int64(20), verbs["delete"], "b deleted, carrying its last-known RV")
}

// A NATS reconnect is recorded, marking a window in which live events may have
// been missed and are recovered on the following re-list.
func TestInformer_Metrics_Reconnect(t *testing.T) {
	m := &fakeMetrics{}
	n := NewInformer(newFakeSubscriber(), testGVR, testNamespace, time.Minute, testQueueGroup, NewStore(), newObjectFunc, nil, m)

	n.signalReconnect()

	rc := m.byKind("reconnect")
	require.Len(t, rc, 1)
	assert.Equal(t, testGVR.Resource, rc[0].resource)
}

// A malformed envelope and an unknown verb are each recorded as a drop with the
// reason the dashboard's "Dropped / Malformed" panel reads.
func TestInformer_Metrics_DroppedNotifications(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		sub := newFakeSubscriber()
		m := &fakeMetrics{}
		list := func(context.Context) ([]runtime.Object, error) { return nil, nil }
		n := NewInformer(sub, testGVR, testNamespace, time.Minute, testQueueGroup, NewStore(), newObjectFunc, list, m)
		_, err := n.AddEventHandler(&recordingHandler{})
		require.NoError(t, err)

		stopCh := make(chan struct{})
		go n.Run(stopCh)
		defer func() { close(stopCh); synctest.Wait() }()
		synctest.Wait()
		require.True(t, sub.subscribed(subject()))

		sub.deliver(t, subject(), []byte("not proto"))
		sub.publish(t, subject(), event(resourcepb.WatchNotification_UNKNOWN, "x"))
		synctest.Wait()

		drops := m.byKind("drop")
		require.Len(t, drops, 2)
		assert.ElementsMatch(t, []string{DropUnmarshalError, DropUnknownType},
			[]string{drops[0].reason, drops[1].reason})
	})
}

// Each re-list records its trigger on success and a distinct error signal on
// failure, backing the relist-rate and relist-error dashboard panels.
func TestInformer_Metrics_RelistSuccessAndError(t *testing.T) {
	m := &fakeMetrics{}
	var mu sync.Mutex
	fail := false
	list := func(context.Context) ([]runtime.Object, error) {
		mu.Lock()
		defer mu.Unlock()
		if fail {
			return nil, fmt.Errorf("list boom")
		}
		return []runtime.Object{objWithRV("a", 10)}, nil
	}
	n := NewInformer(newFakeSubscriber(), testGVR, testNamespace, time.Hour, testQueueGroup, NewStore(), newObjectFunc, list, m)

	ctx := context.Background()
	require.NoError(t, n.relist(ctx, TriggerInitial))
	require.NoError(t, n.relist(ctx, TriggerReconnect))
	mu.Lock()
	fail = true
	mu.Unlock()
	require.Error(t, n.relist(ctx, TriggerResync))

	done := m.byKind("relist_done")
	require.Len(t, done, 2)
	assert.Equal(t, TriggerInitial, done[0].trigger)
	assert.Equal(t, 1, done[0].count, "re-list reports the number of objects returned")
	assert.Equal(t, TriggerReconnect, done[1].trigger)
	assert.Len(t, m.byKind("relist_error"), 1)
}
