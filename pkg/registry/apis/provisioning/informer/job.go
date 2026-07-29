package informer

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewJobDeltaSource returns the job delta source: a NATS-backed informer when the
// subscriber is enabled, otherwise an apiserver-backed SharedIndexInformer. The
// job controller reads no lister, so callers need only the DeltaSource. Either
// source reports its event deliveries on the informer delivery metrics,
// registered on reg (nil disables them).
func NewJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration, reg prometheus.Registerer) DeltaSource {
	metrics := newInformerMetrics(reg)
	resourceName := provisioningapis.JobResourceInfo.GroupVersionResource().Resource
	if nats.Enabled(subscriber) {
		jobInformer := NewJobInformer(subscriber, client, "", resync, usinformer.NewStore())
		// The informer is the job driver's only feed, so gating the initial list
		// on the subscription (the default) would stall the whole job queue while
		// NATS is unavailable — e.g. during startup of the embedded server. In
		// degraded mode jobs are still picked up at the re-list cadence; only the
		// live-event latency is lost until the subscription opens.
		jobInformer.AllowDegradedStart()
		jobInformer.SetMetrics(natsRecorder{metrics: metrics, resourceName: resourceName})
		return jobInformer
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Jobs().Informer()
	// One metering handler observes each delivery once, however many controller
	// handlers register. AddEventHandler cannot fail on a not-yet-started informer.
	_, _ = inf.AddEventHandler(apiServerMeter{metrics: metrics, resourceName: resourceName})
	return inf
}

// NewJobInformer builds an Informer for jobs.
func NewJobInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Job{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, error) {
		return listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Jobs(namespace).List(ctx, opts)
		})
	}
	return usinformer.NewInformer(subscriber, provisioningapis.JobResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}
