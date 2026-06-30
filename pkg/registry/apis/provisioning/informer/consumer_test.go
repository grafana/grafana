package informer

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

const testNamespace = "default"

// fakeSubscriber is a nats.Subscriber that records subscriptions and lets a test
// deliver notifications synchronously, so the consumer can be exercised without
// a real NATS server.
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

// publish delivers a notification on a subject to a registered handler.
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

func newRepo(name, rv, title string) *provisioningapis.Repository {
	return &provisioningapis.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:            name,
			Namespace:       testNamespace,
			ResourceVersion: rv,
		},
		Spec: provisioningapis.RepositorySpec{Title: title},
	}
}

// repoEvent builds a metadata-only notification for a repository, the way a
// publisher would: no object payload, just identity + version (+ folder).
func repoEvent(action resourcepb.WatchNotification_Type, name string, rv int64) *resourcepb.WatchNotification {
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
	return &resourcepb.WatchNotification{
		Type:            action,
		Group:           gvr.Group,
		Resource:        gvr.Resource,
		Namespace:       testNamespace,
		Name:            name,
		ResourceVersion: rv,
	}
}

func repoSubject() string {
	return resourcewatch.Subject(provisioningapis.RepositoryResourceInfo.GroupVersionResource(), testNamespace)
}

// watchRepositories opens a NATS-backed watch on repositories in testNamespace,
// resolving objects through the given client.
func watchRepositories(t *testing.T, sub nats.Subscriber, client versioned.Interface) watch.Interface {
	t.Helper()
	c := NewConsumer(sub, time.Minute)
	get := func(ctx context.Context, name string, o metav1.GetOptions) (runtime.Object, error) {
		return client.ProvisioningV0alpha1().Repositories(testNamespace).Get(ctx, name, o)
	}
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
	w, err := c.Watch(context.Background(), gvr, testNamespace, get, metav1.ListOptions{})
	require.NoError(t, err)
	t.Cleanup(w.Stop)
	return w
}

func nextRepo(t *testing.T, w watch.Interface, wantType watch.EventType) *provisioningapis.Repository {
	t.Helper()
	select {
	case evt, ok := <-w.ResultChan():
		require.True(t, ok, "watch channel closed unexpectedly")
		require.Equal(t, wantType, evt.Type)
		repo, ok := evt.Object.(*provisioningapis.Repository)
		require.True(t, ok, "expected *Repository, got %T", evt.Object)
		return repo
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for %s event", wantType)
		return nil
	}
}

func requireNoEvent(t *testing.T, w watch.Interface) {
	t.Helper()
	select {
	case evt, ok := <-w.ResultChan():
		if ok {
			t.Fatalf("unexpected event: %s %#v", evt.Type, evt.Object)
		}
	case <-time.After(250 * time.Millisecond):
	}
}

// On add/modify the consumer fetches the current object via GET, so the
// delivered object reflects the store (full spec, store resourceVersion), not
// whatever the metadata-only notification carried.
func TestConsumer_MaterializesAddModifyViaGet(t *testing.T) {
	sub := newFakeSubscriber()
	client := fake.NewClientset(newRepo("repo-a", "10", "hello"))
	w := watchRepositories(t, sub, client)

	// Event RV (1) differs from the store RV (10) on purpose.
	sub.publish(t, repoSubject(), repoEvent(resourcepb.WatchNotification_ADDED, "repo-a", 1))
	repo := nextRepo(t, w, watch.Added)
	assert.Equal(t, "repo-a", repo.Name)
	assert.Equal(t, "hello", repo.Spec.Title, "object must come from GET, not the notification")
	assert.Equal(t, "10", repo.ResourceVersion, "resourceVersion must come from the store")
}

// A delete whose object is truly gone produces no synthetic event — removal is
// left to the periodic relist, which has the faithful last-known copy.
func TestConsumer_DeletedObjectDefersToRelist(t *testing.T) {
	sub := newFakeSubscriber()
	w := watchRepositories(t, sub, fake.NewClientset()) // empty store -> GET 404s

	sub.publish(t, repoSubject(), repoEvent(resourcepb.WatchNotification_DELETED, "repo-a", 9))
	requireNoEvent(t, w)
}

// A delete notification whose object still exists (finalization in progress) is
// delivered as MODIFIED carrying the real object — finalizers, deletionTimestamp
// and the rest are preserved because the object came from GET, not a fabricated
// tombstone.
func TestConsumer_FinalizingDeleteDeliveredAsModified(t *testing.T) {
	sub := newFakeSubscriber()
	repo := newRepo("repo-a", "9", "hello")
	now := metav1.Now()
	repo.DeletionTimestamp = &now
	repo.Finalizers = []string{"provisioning.grafana.app/cleanup"}
	w := watchRepositories(t, sub, fake.NewClientset(repo))

	sub.publish(t, repoSubject(), repoEvent(resourcepb.WatchNotification_DELETED, "repo-a", 9))
	got := nextRepo(t, w, watch.Modified)
	assert.Equal(t, "repo-a", got.Name)
	assert.NotNil(t, got.DeletionTimestamp, "finalizing object must keep its deletionTimestamp")
	assert.Equal(t, []string{"provisioning.grafana.app/cleanup"}, got.Finalizers, "finalizers must be preserved")
}

// An add/modify whose object has already vanished is skipped, not fatal: a later
// notification for a present object still arrives.
func TestConsumer_SkipsVanishedObject(t *testing.T) {
	sub := newFakeSubscriber()
	w := watchRepositories(t, sub, fake.NewClientset(newRepo("real", "5", "hi")))

	sub.publish(t, repoSubject(), repoEvent(resourcepb.WatchNotification_ADDED, "ghost", 1)) // 404 -> skipped
	sub.publish(t, repoSubject(), repoEvent(resourcepb.WatchNotification_MODIFIED, "real", 5))

	repo := nextRepo(t, w, watch.Modified)
	assert.Equal(t, "real", repo.Name, "the vanished add must be skipped, not block later events")
}

func TestConsumer_SkipsMalformedAndUnknown(t *testing.T) {
	sub := newFakeSubscriber()
	w := watchRepositories(t, sub, fake.NewClientset(newRepo("survivor", "7", "hi")))

	// Garbage envelope.
	sub.deliver(t, repoSubject(), []byte("not json"))
	// Unknown verb.
	sub.publish(t, repoSubject(), repoEvent(resourcepb.WatchNotification_UNKNOWN, "x", 1))

	// A valid notification after the bad ones must still arrive — bad
	// notifications are skipped, not fatal to the watch.
	sub.publish(t, repoSubject(), repoEvent(resourcepb.WatchNotification_ADDED, "survivor", 7))
	repo := nextRepo(t, w, watch.Added)
	assert.Equal(t, "survivor", repo.Name)
}

// The watch ends itself with a Gone error every relistInterval so the reflector
// re-LISTs — the only thing that reconciles hard deletes and other gaps. This
// asserts the watch-level signal (a watch.Error carrying a 410 Status).
func TestConsumer_RelistsAfterInterval(t *testing.T) {
	c := NewConsumer(newFakeSubscriber(), 200*time.Millisecond)

	client := fake.NewClientset()
	get := func(ctx context.Context, name string, o metav1.GetOptions) (runtime.Object, error) {
		return client.ProvisioningV0alpha1().Repositories(testNamespace).Get(ctx, name, o)
	}
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
	w, err := c.Watch(context.Background(), gvr, testNamespace, get, metav1.ListOptions{})
	require.NoError(t, err)
	t.Cleanup(w.Stop)

	select {
	case evt, ok := <-w.ResultChan():
		require.True(t, ok, "watch channel closed unexpectedly")
		require.Equal(t, watch.Error, evt.Type)
		status, ok := evt.Object.(*metav1.Status)
		require.True(t, ok, "expected *metav1.Status, got %T", evt.Object)
		assert.Equal(t, int32(http.StatusGone), status.Code, "must be Gone so the reflector re-LISTs")
	case <-time.After(5 * time.Second):
		t.Fatal("expected a relist (watch.Error) event")
	}
}

func TestConsumer_RequiresGet(t *testing.T) {
	c := NewConsumer(newFakeSubscriber(), time.Minute)
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
	// Get deliberately nil.
	_, err := c.Watch(context.Background(), gvr, testNamespace, nil, metav1.ListOptions{})
	require.Error(t, err)
}
