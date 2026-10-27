package informer

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
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

// testInfo is a kind whose plural is not its name with an "s", which is what the app-sdk's simple schema would
// otherwise derive and subscribe on.
type testInfo struct{}

func (testInfo) GroupVersionKind() schema.GroupVersionKind {
	return schema.GroupVersionKind{Group: "example.grafana.app", Version: "v1", Kind: "Entry"}
}

func (testInfo) GroupVersionResource() schema.GroupVersionResource {
	return schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "entries"}
}

func entry(namespace, name string) runtime.Object {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name}}
}

// recorder keeps the objects as delivered, so a test can assert what a handler would type-assert.
type recorder struct {
	mu   sync.Mutex
	objs []any
}

func (r *recorder) OnAdd(obj any, _ bool)  { r.record(obj) }
func (r *recorder) OnUpdate(_, newObj any) { r.record(newObj) }
func (r *recorder) OnDelete(obj any)       { r.record(obj) }

func (r *recorder) record(obj any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.objs = append(r.objs, obj)
}

func (r *recorder) last() any {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.objs) == 0 {
		return nil
	}
	return r.objs[len(r.objs)-1]
}

var _ cache.ResourceEventHandler = (*recorder)(nil)

type fakeSubscriber struct {
	mu       sync.Mutex
	handlers map[string]nats.MessageHandler
}

func newFakeSubscriber() *fakeSubscriber {
	return &fakeSubscriber{handlers: map[string]nats.MessageHandler{}}
}

func (f *fakeSubscriber) Enabled() bool { return true }

func (f *fakeSubscriber) Subscribe(_ context.Context, subject string, handler nats.MessageHandler, _ ...nats.SubscribeOption) (nats.Subscription, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.handlers[subject] = handler
	return fakeSubscription{}, nil
}

func (f *fakeSubscriber) subscribed(subject string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.handlers[subject]
	return ok
}

func (f *fakeSubscriber) publish(t *testing.T, subject string, evt *resourcepb.WatchNotification) {
	t.Helper()
	data, err := proto.Marshal(evt)
	require.NoError(t, err)
	f.mu.Lock()
	handler, ok := f.handlers[subject]
	f.mu.Unlock()
	require.Truef(t, ok, "no subscription for subject %q", subject)
	handler(subject, data)
}

type fakeSubscription struct{}

func (fakeSubscription) WaitReady(ctx context.Context) error { return ctx.Err() }
func (fakeSubscription) Unsubscribe() error                  { return nil }

func runPeriodicSource(t *testing.T, list PeriodicListFunc) (*recorder, cache.ResourceEventHandlerRegistration) {
	t.Helper()
	src, err := NewPeriodicDeltaSource(testInfo{}, time.Hour, list)
	require.NoError(t, err)

	rec := &recorder{}
	registration, err := src.AddEventHandler(rec)
	require.NoError(t, err)

	stop := make(chan struct{})
	t.Cleanup(func() { close(stop) })
	go src.Run(stop)

	return rec, registration
}

// The controllers type-assert their own object off what is delivered, so the app-sdk wrapper the lister puts on has
// to come back off before delivery.
func TestPeriodicDeltaSourceDeliversTheListedObject(t *testing.T) {
	listed := entry("ns", "one")
	rec, _ := runPeriodicSource(t, func(context.Context) ([]runtime.Object, error) {
		return []runtime.Object{listed}, nil
	})

	require.Eventually(t, func() bool { return rec.last() != nil }, 5*time.Second, 5*time.Millisecond)

	delivered, ok := rec.last().(*metav1.PartialObjectMetadata)
	require.True(t, ok, "expected the listed type, got %T", rec.last())
	assert.Equal(t, listed, delivered)
}

// A failed list must not report the source as synced, or the handler is released against nothing.
func TestPeriodicDeltaSourceRetriesTheInitialList(t *testing.T) {
	_, registration := runPeriodicSource(t, func(context.Context) ([]runtime.Object, error) {
		return nil, errors.New("api unavailable")
	})

	assert.Never(t, registration.HasSynced, 200*time.Millisecond, 20*time.Millisecond)
}

func TestPeriodicListerRejectsANonKubernetesObject(t *testing.T) {
	_, _, err := periodicLister{list: func(context.Context) ([]runtime.Object, error) {
		return []runtime.Object{&notAnObject{}}, nil
	}}.List(context.Background())

	assert.ErrorContains(t, err, "not a kubernetes object")
}

// notAnObject is a runtime.Object with no metadata accessors, which the app-sdk's wrapper cannot adapt.
type notAnObject struct{}

func (o *notAnObject) GetObjectKind() schema.ObjectKind { return schema.EmptyObjectKind }
func (o *notAnObject) DeepCopyObject() runtime.Object   { return &notAnObject{} }

// The subject a live event arrives on is composed from the resource, not from the kind: the app-sdk's simple schema
// would pluralise "Entry" as "entrys" and subscribe to a subject nothing publishes on.
func TestBusDeltaSourceSubscribesOnTheResource(t *testing.T) {
	subscriber := newFakeSubscriber()
	src, err := NewBusDeltaSource(subscriber, &metav1.PartialObjectMetadata{}, testInfo{}, time.Hour,
		func(context.Context) ([]runtime.Object, error) { return nil, nil }, BusSourceOptions{Namespace: "ns"})
	require.NoError(t, err)

	rec := &recorder{}
	_, err = src.AddEventHandler(rec)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	subject := resourcewatch.Subject(testInfo{}.GroupVersionResource(), "ns")
	require.Eventually(t, func() bool { return subscriber.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)

	subscriber.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_ADDED, Namespace: "ns", Name: "one", ResourceVersion: 7,
	})

	require.Eventually(t, func() bool { return rec.last() != nil }, 5*time.Second, 5*time.Millisecond)
	delivered, ok := rec.last().(*metav1.PartialObjectMetadata)
	require.True(t, ok, "expected the configured type, got %T", rec.last())
	assert.Equal(t, "one", delivered.Name)
	assert.Equal(t, "ns", delivered.Namespace)
	assert.Equal(t, "7", delivered.ResourceVersion)
}

// Metadata the publisher announced with an event reaches the handler on the delivered object, which is what lets a
// controller filter on a label or an annotation without reading the object. Storage announces only what the
// resource's owner registered, so an absent key here means unannounced rather than unset.
func TestBusDeltaSourceCarriesAnnouncedMetadata(t *testing.T) {
	subscriber := newFakeSubscriber()
	src, err := NewBusDeltaSource(subscriber, &metav1.PartialObjectMetadata{}, testInfo{}, time.Hour,
		func(context.Context) ([]runtime.Object, error) { return nil, nil }, BusSourceOptions{Namespace: "ns"})
	require.NoError(t, err)

	rec := &recorder{}
	_, err = src.AddEventHandler(rec)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	subject := resourcewatch.Subject(testInfo{}.GroupVersionResource(), "ns")
	require.Eventually(t, func() bool { return subscriber.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)

	subscriber.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_MODIFIED, Namespace: "ns", Name: "one", ResourceVersion: 8,
		Metadata: &resourcepb.NotificationMetadata{
			Labels:                  map[string]string{"encrypted": "true"},
			Annotations:             map[string]string{"example.grafana.app/paused": "true"},
			Finalizers:              []string{"example.grafana.app/cleanup"},
			Generation:              3,
			DeletionTimestampMillis: 1700000000000,
		},
	})

	require.Eventually(t, func() bool { return rec.last() != nil }, 5*time.Second, 5*time.Millisecond)
	delivered, ok := rec.last().(*metav1.PartialObjectMetadata)
	require.True(t, ok, "expected the configured type, got %T", rec.last())
	assert.Equal(t, map[string]string{"encrypted": "true"}, delivered.Labels)
	assert.Equal(t, map[string]string{"example.grafana.app/paused": "true"}, delivered.Annotations)
	assert.Equal(t, []string{"example.grafana.app/cleanup"}, delivered.Finalizers)
	assert.Equal(t, int64(3), delivered.Generation)
	require.NotNil(t, delivered.DeletionTimestamp)
	assert.Equal(t, int64(1700000000000), delivered.DeletionTimestamp.UnixMilli())
}

func TestBusDeltaSourceRequiresNats(t *testing.T) {
	_, err := NewBusDeltaSource(nil, &metav1.PartialObjectMetadata{}, testInfo{}, time.Hour,
		func(context.Context) ([]runtime.Object, error) { return nil, nil }, BusSourceOptions{})
	assert.ErrorContains(t, err, "nats is not enabled")
}

// Announcements are the freshness instrumentation's view of the live stream, so a re-list delivery must not reach
// them: its version came from the lister, not from a notification.
func TestBusDeltaSourceAnnouncesOnlyLiveDeliveries(t *testing.T) {
	announced := operator.NewAnnouncementTracker(operator.AnnouncementTrackerOptions{})
	subscriber := newFakeSubscriber()
	src, err := NewBusDeltaSource(subscriber, &metav1.PartialObjectMetadata{}, testInfo{}, time.Hour,
		func(context.Context) ([]runtime.Object, error) { return []runtime.Object{entry("ns", "listed")}, nil },
		BusSourceOptions{Namespace: "ns", Announcements: announced})
	require.NoError(t, err)

	rec := &recorder{}
	_, err = src.AddEventHandler(rec)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	subject := resourcewatch.Subject(testInfo{}.GroupVersionResource(), "ns")
	require.Eventually(t, func() bool { return subscriber.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)
	// The initial list delivers "listed" as an add; it must leave no announcement.
	require.Eventually(t, func() bool { return rec.last() != nil }, 5*time.Second, 5*time.Millisecond)
	assert.Zero(t, announced.Len(), "a re-list add is not an announcement")

	subscriber.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_MODIFIED, Namespace: "ns", Name: "live", ResourceVersion: 9,
	})

	live := resource.Identifier{Namespace: "ns", Name: "live"}
	require.Eventually(t, func() bool { return announced.Announced(live) != 0 }, 5*time.Second, 5*time.Millisecond)
	assert.Equal(t, int64(9), announced.Announced(live))
	assert.Equal(t, 1, announced.Len())
}
