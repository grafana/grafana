package informer

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const testNamespace = "default"

// fakeSubscriber is a nats.Subscriber that records subscriptions and lets a test
// deliver notifications synchronously, so an informer can be exercised without a
// real NATS server.
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
