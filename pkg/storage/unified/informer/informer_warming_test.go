package informer

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// objWith builds a stored object carrying an identity/freshness the warm path
// validates against the notification.
func objWith(name, uid string, generation int64) *metav1.PartialObjectMetadata {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
		Name:       name,
		Namespace:  testNamespace,
		UID:        types.UID(uid),
		Generation: generation,
	}}
}

// fakeGet is a controllable GetFunc: it returns NotFound for the first
// notFounds calls, then the configured object (if any), tracking call count.
type fakeGet struct {
	mu        sync.Mutex
	obj       runtime.Object
	notFounds int
	calls     int
}

func (g *fakeGet) get(_ context.Context, _, name string) (runtime.Object, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.calls++
	if g.notFounds > 0 {
		g.notFounds--
		return nil, notFoundErr(name)
	}
	if g.obj == nil {
		return nil, notFoundErr(name)
	}
	return g.obj, nil
}

func notFoundErr(name string) error {
	return apierrors.NewNotFound(schema.GroupResource{Group: testGVR.Group, Resource: testGVR.Resource}, name)
}

// newWarmingInformer builds an informer in warming mode with a fast backoff and
// returns it plus the raw notification handler to drive directly (no Run loop).
func newWarmingInformer(t *testing.T, get GetFunc, handler *recordingHandler) (*Informer, func(evt *resourcepb.WatchNotification)) {
	t.Helper()
	noList := func(context.Context) ([]runtime.Object, error) { return nil, nil }
	n := NewInformer(newFakeSubscriber(), testGVR, testNamespace, time.Minute, testQueueGroup, NewStore(), newObjectFunc, noList, WithGet(get))
	n.warmBackoff = []time.Duration{time.Millisecond, time.Millisecond, time.Millisecond}
	_, err := n.AddEventHandler(handler)
	require.NoError(t, err)
	h := n.onNotification(context.Background())
	return n, func(evt *resourcepb.WatchNotification) {
		data, err := proto.Marshal(evt)
		require.NoError(t, err)
		h(subject(), data)
	}
}

func warmEvent(t resourcepb.WatchNotification_Type, name, uid string, generation int64) *resourcepb.WatchNotification {
	return &resourcepb.WatchNotification{
		Type: t, Group: testGVR.Group, Resource: testGVR.Resource,
		Namespace: testNamespace, Name: name, Uid: uid, Generation: generation,
	}
}

// A warmed notification fetches the object, writes it to the store, and
// dispatches the real object — so a getter reading the store finds it present.
func TestInformer_WarmDispatchesFetchedObject(t *testing.T) {
	get := &fakeGet{obj: objWith("repo-a", "u1", 2)}
	handler := &recordingHandler{}
	n, publish := newWarmingInformer(t, get.get, handler)

	publish(warmEvent(resourcepb.WatchNotification_MODIFIED, "repo-a", "u1", 2))

	require.Eventually(t, func() bool { return len(handler.updatedNames()) == 1 }, time.Second, time.Millisecond)
	got, ok := n.store.Get(context.Background(), testNamespace, "repo-a")
	require.True(t, ok, "warmed object must be in the store")
	assert.Equal(t, "repo-a", got.(*metav1.PartialObjectMetadata).Name)
}

// A not-yet-visible object is retried until the write appears, then dispatched.
func TestInformer_WarmRetriesUntilVisible(t *testing.T) {
	get := &fakeGet{obj: objWith("repo-a", "u1", 1), notFounds: 2}
	handler := &recordingHandler{}
	n, publish := newWarmingInformer(t, get.get, handler)

	publish(warmEvent(resourcepb.WatchNotification_ADDED, "repo-a", "u1", 1))

	require.Eventually(t, func() bool { return len(handler.addedNames()) == 1 }, time.Second, time.Millisecond)
	_, ok := n.store.Get(context.Background(), testNamespace, "repo-a")
	assert.True(t, ok)
	get.mu.Lock()
	defer get.mu.Unlock()
	assert.GreaterOrEqual(t, get.calls, 3, "should have retried through the two NotFounds")
}

// An event whose UID no longer matches the live object is a stale delete/recreate
// and is ignored: nothing is stored or dispatched.
func TestInformer_WarmIgnoresStaleUIDMismatch(t *testing.T) {
	get := &fakeGet{obj: objWith("repo-a", "current", 1)}
	handler := &recordingHandler{}
	n, publish := newWarmingInformer(t, get.get, handler)

	publish(warmEvent(resourcepb.WatchNotification_MODIFIED, "repo-a", "previous", 1))

	assert.Never(t, func() bool { return len(handler.updatedNames()) > 0 }, 50*time.Millisecond, 5*time.Millisecond)
	_, ok := n.store.Get(context.Background(), testNamespace, "repo-a")
	assert.False(t, ok, "a stale-UID event must not populate the store")
}

// A fetched object older than the event's generation is retried until the newer
// generation is observed.
func TestInformer_WarmWaitsForGeneration(t *testing.T) {
	get := &fakeGet{obj: objWith("repo-a", "u1", 1)} // stale generation 1 vs event 3
	handler := &recordingHandler{}
	_, publish := newWarmingInformer(t, get.get, handler)

	publish(warmEvent(resourcepb.WatchNotification_MODIFIED, "repo-a", "u1", 3))

	// The generation never advances, so it retries and gives up without dispatch.
	assert.Never(t, func() bool { return len(handler.updatedNames()) > 0 }, 50*time.Millisecond, 5*time.Millisecond)
	get.mu.Lock()
	defer get.mu.Unlock()
	assert.GreaterOrEqual(t, get.calls, 2, "should have retried waiting for the newer generation")
}

// A delete removes the object from the authoritative store and wakes the handler.
func TestInformer_WarmDeleteRemovesFromStore(t *testing.T) {
	get := &fakeGet{obj: objWith("repo-a", "u1", 1)}
	handler := &recordingHandler{}
	n, publish := newWarmingInformer(t, get.get, handler)
	n.store.Update(context.Background(), objWith("repo-a", "u1", 1))

	publish(warmEvent(resourcepb.WatchNotification_DELETED, "repo-a", "u1", 1))

	require.Eventually(t, func() bool { return len(handler.updatedNames()) == 1 }, time.Second, time.Millisecond)
	_, ok := n.store.Get(context.Background(), testNamespace, "repo-a")
	assert.False(t, ok, "a delete must remove the object from the store")
}
