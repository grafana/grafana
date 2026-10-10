package informer

import (
	"context"
	"maps"
	"sync"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const testNamespace = "default"

// The two kinds whose re-list is keys-only; the metrics are labelled by both.
var (
	connGVR = provisioningapis.ConnectionResourceInfo.GroupVersionResource()
	repoGVR = provisioningapis.RepositoryResourceInfo.GroupVersionResource()
)

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

func (fakeSubscription) WaitReady(ctx context.Context) error { return ctx.Err() }
func (fakeSubscription) Unsubscribe() error                  { return nil }

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

// newTestRecorder returns a recorder bound to resourceName and the registry it
// writes to. Tests assert on the real counters rather than a captured callback,
// because the metric names and labels are what the keys_only_relist rollout is
// read by.
func newTestRecorder(gvr schema.GroupVersionResource) (RelistRecorder, *prometheus.Registry) {
	reg := prometheus.NewRegistry()
	return NewRelistProjectionMetrics(reg).Recorder(gvr), reg
}

// counterValue reads one fully labelled counter out of reg, 0 when the series
// has not been touched.
func counterValue(t *testing.T, reg *prometheus.Registry, name string, labels map[string]string) float64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)

	for _, mf := range families {
		if mf.GetName() != name {
			continue
		}
		for _, m := range mf.GetMetric() {
			got := make(map[string]string, len(m.GetLabel()))
			for _, l := range m.GetLabel() {
				got[l.GetName()] = l.GetValue()
			}
			if maps.Equal(got, labels) {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}

func projectionCount(t *testing.T, reg *prometheus.Registry, gvr schema.GroupVersionResource, projection string) float64 {
	t.Helper()
	return counterValue(t, reg, "grafana_provisioning_informer_relist_projection_total",
		map[string]string{"group": gvr.Group, "resource": gvr.Resource, "projection": projection})
}

func hydrationCount(t *testing.T, reg *prometheus.Registry, gvr schema.GroupVersionResource) float64 {
	t.Helper()
	return counterValue(t, reg, "grafana_provisioning_informer_relist_hydrations_total",
		map[string]string{"group": gvr.Group, "resource": gvr.Resource})
}
