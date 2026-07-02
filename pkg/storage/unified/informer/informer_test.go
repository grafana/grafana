package informer

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

const (
	testNamespace  = "default"
	testQueueGroup = "test-informer"
)

var testGVR = schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "widgets"}

// fakeSubscriber is a nats.Subscriber that records subscriptions and lets a test
// deliver notifications synchronously, so the informer can be exercised without
// a real NATS server.
type fakeSubscriber struct {
	mu       sync.Mutex
	handlers map[string]nats.MessageHandler
	failN    int // fail the next failN Subscribe calls, mimicking a not-yet-ready server
}

func newFakeSubscriber() *fakeSubscriber {
	return &fakeSubscriber{handlers: map[string]nats.MessageHandler{}}
}

func (f *fakeSubscriber) Enabled() bool { return true }

// failSubscribes makes the next n Subscribe calls fail, as they do while the
// embedded NATS server is still starting and has no client URL.
func (f *fakeSubscriber) failSubscribes(n int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failN = n
}

func (f *fakeSubscriber) Subscribe(_ context.Context, subject string, handler nats.MessageHandler, _ ...nats.SubscribeOption) (nats.Subscription, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.failN > 0 {
		f.failN--
		return nil, fmt.Errorf("no nats client urls configured")
	}
	f.handlers[subject] = handler
	return fakeSubscription{}, nil
}

func (f *fakeSubscriber) waitForSubscription(t *testing.T, subject string) {
	t.Helper()
	require.Eventually(t, func() bool {
		f.mu.Lock()
		defer f.mu.Unlock()
		_, ok := f.handlers[subject]
		return ok
	}, 5*time.Second, 5*time.Millisecond, "informer never subscribed to %q", subject)
}

func (f *fakeSubscriber) publish(t *testing.T, subject string, evt *resourcepb.WatchNotification) {
	t.Helper()
	data, err := proto.Marshal(evt)
	require.NoError(t, err)
	f.deliver(t, subject, data)
}

func (f *fakeSubscriber) deliver(t *testing.T, subject string, data []byte) {
	t.Helper()
	f.mu.Lock()
	handler, ok := f.handlers[subject]
	f.mu.Unlock()
	require.Truef(t, ok, "no subscription for subject %q", subject)
	handler(subject, data)
}

type fakeSubscription struct{}

func (fakeSubscription) Unsubscribe() error { return nil }

var _ nats.Subscriber = (*fakeSubscriber)(nil)

// recordingHandler captures the OnAdd/OnUpdate calls an informer makes.
type recordingHandler struct {
	mu      sync.Mutex
	adds    []*metav1.PartialObjectMetadata
	updates []*metav1.PartialObjectMetadata
	deletes []*metav1.PartialObjectMetadata
}

func (h *recordingHandler) OnAdd(obj interface{}, _ bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.adds = append(h.adds, obj.(*metav1.PartialObjectMetadata))
}

func (h *recordingHandler) OnUpdate(_, newObj interface{}) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.updates = append(h.updates, newObj.(*metav1.PartialObjectMetadata))
}

func (h *recordingHandler) OnDelete(obj interface{}) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.deletes = append(h.deletes, obj.(*metav1.PartialObjectMetadata))
}

func (h *recordingHandler) addedNames() []string   { return names(&h.mu, h.adds) }
func (h *recordingHandler) updatedNames() []string { return names(&h.mu, h.updates) }
func (h *recordingHandler) deletedNames() []string { return names(&h.mu, h.deletes) }

func names(mu *sync.Mutex, objs []*metav1.PartialObjectMetadata) []string {
	mu.Lock()
	defer mu.Unlock()
	out := make([]string, len(objs))
	for i, o := range objs {
		out[i] = o.Name
	}
	return out
}

var _ cache.ResourceEventHandler = (*recordingHandler)(nil)

func obj(name string) *metav1.PartialObjectMetadata {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: testNamespace}}
}

func newObjectFunc(namespace, name string) runtime.Object {
	return obj(name)
}

func event(action resourcepb.WatchNotification_Type, name string) *resourcepb.WatchNotification {
	return &resourcepb.WatchNotification{
		Type:      action,
		Group:     testGVR.Group,
		Resource:  testGVR.Resource,
		Namespace: testNamespace,
		Name:      name,
	}
}

func subject() string {
	return resourcewatch.Subject(testGVR, testNamespace)
}

// start wires an informer to the given seed list and handler, runs it, and waits
// until the initial list has synced.
func start(t *testing.T, sub *fakeSubscriber, seed []runtime.Object, newObject ObjectFunc, handler cache.ResourceEventHandler) *Informer {
	t.Helper()
	list := func(context.Context) ([]runtime.Object, error) { return seed, nil }
	n := NewInformer(sub, testGVR, testNamespace, time.Minute, testQueueGroup, NewStore(), newObject, list)
	_, err := n.AddEventHandler(handler)
	require.NoError(t, err)

	stopCh := make(chan struct{})
	go n.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	if newObject != nil {
		sub.waitForSubscription(t, subject())
	}
	require.Eventually(t, n.HasSynced, 5*time.Second, 5*time.Millisecond, "informer never synced")
	return n
}

// The initial list drives an OnAdd per existing object and marks HasSynced, so a
// controller can start reconciling the full set — just like an informer's
// LIST-seeded cache.
func TestInformer_InitialListDeliversAdds(t *testing.T) {
	sub := newFakeSubscriber()
	handler := &recordingHandler{}

	start(t, sub, []runtime.Object{obj("a"), obj("b")}, newObjectFunc, handler)

	assert.ElementsMatch(t, []string{"a", "b"}, handler.addedNames())
}

// A live ADDED goes through OnAdd; a MODIFIED/DELETED through OnUpdate. The
// delivered object is the minimal one built from the notification's identity —
// the controllers re-fetch, so the informer does not read the object.
func TestInformer_LiveEventsDispatchMinimalObject(t *testing.T) {
	sub := newFakeSubscriber()
	handler := &recordingHandler{}
	start(t, sub, nil, newObjectFunc, handler)

	sub.publish(t, subject(), event(resourcepb.WatchNotification_ADDED, "fresh"))
	sub.publish(t, subject(), event(resourcepb.WatchNotification_MODIFIED, "changed"))
	sub.publish(t, subject(), event(resourcepb.WatchNotification_DELETED, "gone"))

	assert.Equal(t, []string{"fresh"}, handler.addedNames())
	assert.Equal(t, []string{"changed", "gone"}, handler.updatedNames())
}

// Malformed envelopes and unknown verbs are skipped; a valid notification after
// them still arrives.
func TestInformer_SkipsMalformedAndUnknown(t *testing.T) {
	sub := newFakeSubscriber()
	handler := &recordingHandler{}
	start(t, sub, nil, newObjectFunc, handler)

	sub.deliver(t, subject(), []byte("not proto"))
	sub.publish(t, subject(), event(resourcepb.WatchNotification_UNKNOWN, "x"))
	sub.publish(t, subject(), event(resourcepb.WatchNotification_MODIFIED, "survivor"))

	assert.Equal(t, []string{"survivor"}, handler.updatedNames())
}

// A nil object builder disables live notifications: the informer never
// subscribes and is driven only by the (initial) list.
func TestInformer_NilObjectFuncSkipsSubscription(t *testing.T) {
	sub := newFakeSubscriber()
	handler := &recordingHandler{}

	start(t, sub, []runtime.Object{obj("only-listed")}, nil, handler)

	sub.mu.Lock()
	_, subscribed := sub.handlers[subject()]
	sub.mu.Unlock()
	assert.False(t, subscribed, "must not subscribe when live notifications are disabled")
	assert.Equal(t, []string{"only-listed"}, handler.addedNames())
}

// A re-list diffs against the previous snapshot: an object that has vanished is
// delivered as a delete carrying its last-known state, which is how a hard delete
// is caught even though no live notification reliably reaches this replica.
func TestInformer_RelistDiffEmitsDeletes(t *testing.T) {
	sub := newFakeSubscriber()
	handler := &recordingHandler{}

	// list returns [a, b] first, then just [a] on the next call.
	var calls int
	list := func(context.Context) ([]runtime.Object, error) {
		calls++
		if calls == 1 {
			return []runtime.Object{obj("a"), obj("b")}, nil
		}
		return []runtime.Object{obj("a")}, nil
	}
	n := NewInformer(sub, testGVR, testNamespace, time.Minute, testQueueGroup, NewStore(), newObjectFunc, list)
	_, err := n.AddEventHandler(handler)
	require.NoError(t, err)

	n.relist(context.Background(), true)  // initial: adds a, b; no deletes
	n.relist(context.Background(), false) // resync: b is gone -> delete

	assert.ElementsMatch(t, []string{"a", "b"}, handler.addedNames())
	assert.Equal(t, []string{"b"}, handler.deletedNames(), "vanished object must be delivered as a delete")
}

func TestInformer_AddEventHandlerRejectsNil(t *testing.T) {
	n := NewInformer(newFakeSubscriber(), testGVR, testNamespace, time.Minute, testQueueGroup, NewStore(), newObjectFunc, nil)
	_, err := n.AddEventHandler(nil)
	require.Error(t, err)
}

// A reconnect signal drives an out-of-band re-list, so events missed while the
// round-robin subscription was down are reconciled without waiting for the resync
// tick. The resync is set far in the future so only the reconnect can trigger the
// second list.
func TestInformer_ReconnectTriggersRelist(t *testing.T) {
	sub := newFakeSubscriber()
	handler := &recordingHandler{}

	var calls atomic.Int64
	list := func(context.Context) ([]runtime.Object, error) {
		calls.Add(1)
		return []runtime.Object{obj("a")}, nil
	}
	n := NewInformer(sub, testGVR, testNamespace, time.Hour, testQueueGroup, NewStore(), newObjectFunc, list)
	_, err := n.AddEventHandler(handler)
	require.NoError(t, err)

	stopCh := make(chan struct{})
	go n.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	sub.waitForSubscription(t, subject())
	require.Eventually(t, n.HasSynced, 5*time.Second, 5*time.Millisecond, "informer never synced")
	require.EqualValues(t, 1, calls.Load(), "only the initial list should have run")

	n.signalReconnect()

	require.Eventually(t, func() bool { return calls.Load() >= 2 }, 5*time.Second, 5*time.Millisecond,
		"reconnect must trigger a re-list")
}

// A subscribe failure (e.g. the embedded NATS server not yet started, so no
// client URL) is not fatal: the informer still syncs from the initial re-list,
// retries the subscription, and delivers live events once it opens.
func TestInformer_RetriesSubscribeUntilAvailable(t *testing.T) {
	sub := newFakeSubscriber()
	sub.failSubscribes(2) // first two attempts fail, then it succeeds
	handler := &recordingHandler{}

	list := func(context.Context) ([]runtime.Object, error) { return []runtime.Object{obj("a")}, nil }
	n := NewInformer(sub, testGVR, testNamespace, time.Hour, testQueueGroup, NewStore(), newObjectFunc, list)
	n.retryInterval = 10 * time.Millisecond // shorten the retry cadence for the test
	_, err := n.AddEventHandler(handler)
	require.NoError(t, err)
	stopCh := make(chan struct{})
	go n.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	// HasSynced fires from the initial re-list even though subscribing failed.
	require.Eventually(t, n.HasSynced, 5*time.Second, 5*time.Millisecond, "informer must sync despite subscribe failure")
	assert.Equal(t, []string{"a"}, handler.addedNames(), "initial list must be delivered")

	// The retry eventually opens the subscription, and live events then flow.
	sub.waitForSubscription(t, subject())
	sub.publish(t, subject(), event(resourcepb.WatchNotification_ADDED, "fresh"))
	require.Eventually(t, func() bool {
		return len(handler.addedNames()) == 2
	}, 5*time.Second, 5*time.Millisecond, "live events must flow once the retry subscribes")
	assert.Equal(t, []string{"a", "fresh"}, handler.addedNames())
}

// A failing initial list must not mark the informer synced: HasSynced stays false
// (so WaitForCacheSync keeps blocking) until the first list succeeds, then the
// seeded objects are delivered as adds.
func TestInformer_DoesNotSyncUntilInitialListSucceeds(t *testing.T) {
	sub := newFakeSubscriber()
	handler := &recordingHandler{}

	var calls atomic.Int64
	list := func(context.Context) ([]runtime.Object, error) {
		if calls.Add(1) < 3 {
			return nil, fmt.Errorf("api unavailable")
		}
		return []runtime.Object{obj("a")}, nil
	}
	n := NewInformer(sub, testGVR, testNamespace, time.Hour, testQueueGroup, NewStore(), newObjectFunc, list)
	n.retryInterval = 10 * time.Millisecond // shorten the initial-list retry for the test
	_, err := n.AddEventHandler(handler)
	require.NoError(t, err)

	stopCh := make(chan struct{})
	go n.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	// While the list keeps failing, the informer must not report synced.
	require.Never(t, n.HasSynced, 20*time.Millisecond, 5*time.Millisecond, "must not sync while the initial list fails")

	// Once a list succeeds, it syncs and delivers the seeded object as an add.
	require.Eventually(t, n.HasSynced, 5*time.Second, 5*time.Millisecond, "must sync after the initial list succeeds")
	assert.Equal(t, []string{"a"}, handler.addedNames())
}

// signalReconnect never blocks: a pending signal coalesces additional reconnects
// so a burst of reconnects while the run loop is busy cannot deadlock the client's
// reconnect goroutine.
func TestInformer_SignalReconnectDoesNotBlock(t *testing.T) {
	n := NewInformer(newFakeSubscriber(), testGVR, testNamespace, time.Minute, testQueueGroup, NewStore(), newObjectFunc, nil)
	// The run loop is not started, so nothing drains the channel; every call must
	// still return immediately.
	for i := 0; i < 100; i++ {
		n.signalReconnect()
	}
}
