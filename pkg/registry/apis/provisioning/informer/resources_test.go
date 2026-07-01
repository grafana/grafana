package informer

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

const testNamespace = "default"

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

func (fakeSubscription) Unsubscribe() error { return nil }

var _ nats.Subscriber = (*fakeSubscriber)(nil)

// typeRecorder records the concrete Go type of every object an informer delivers,
// so a test can assert each constructor wires its own resource type.
type typeRecorder struct {
	mu   sync.Mutex
	objs []interface{}
}

func (r *typeRecorder) OnAdd(obj interface{}, _ bool)  { r.record(obj) }
func (r *typeRecorder) OnUpdate(_, newObj interface{}) { r.record(newObj) }
func (r *typeRecorder) OnDelete(interface{})           {}

func (r *typeRecorder) record(obj interface{}) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.objs = append(r.objs, obj)
}

func (r *typeRecorder) last() interface{} {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.objs) == 0 {
		return nil
	}
	return r.objs[len(r.objs)-1]
}

var _ cache.ResourceEventHandler = (*typeRecorder)(nil)

// A live repository notification is delivered as the concrete *Repository the
// controller's handler expects, built from the notification's identity.
func TestNewRepositoryInformer_DeliversRepositoryType(t *testing.T) {
	sub := newFakeSubscriber()
	rec := &typeRecorder{}
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()

	inf := NewRepositoryInformer(sub, fake.NewClientset(), testNamespace, time.Minute, NewStore())
	_, err := inf.AddEventHandler(rec)
	require.NoError(t, err)
	stopCh := make(chan struct{})
	inf.Start(stopCh)
	t.Cleanup(func() { close(stopCh) })

	subject := resourcewatch.Subject(gvr, testNamespace)
	require.Eventually(t, func() bool { return sub.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)

	sub.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_MODIFIED, Group: gvr.Group, Resource: gvr.Resource,
		Namespace: testNamespace, Name: "repo-a",
	})

	require.Eventually(t, func() bool { return rec.last() != nil }, 5*time.Second, 5*time.Millisecond)
	repo, ok := rec.last().(*provisioningapis.Repository)
	require.True(t, ok, "expected *Repository, got %T", rec.last())
	assert.Equal(t, "repo-a", repo.Name)
	assert.Equal(t, testNamespace, repo.Namespace)
}

// The historic-job informer takes no live notifications (its handler reads the
// object directly), so it never subscribes — it is driven only by the re-list.
func TestNewHistoricJobInformer_DoesNotSubscribe(t *testing.T) {
	sub := newFakeSubscriber()
	gvr := provisioningapis.HistoricJobResourceInfo.GroupVersionResource()

	inf := NewHistoricJobInformer(sub, fake.NewClientset(), testNamespace, time.Minute, NewStore())
	_, err := inf.AddEventHandler(&typeRecorder{})
	require.NoError(t, err)
	stopCh := make(chan struct{})
	inf.Start(stopCh)
	t.Cleanup(func() { close(stopCh) })

	require.Eventually(t, inf.HasSynced, 5*time.Second, 5*time.Millisecond)
	assert.False(t, sub.subscribed(resourcewatch.Subject(gvr, testNamespace)),
		"historic-job informer must not subscribe to live notifications")
}
