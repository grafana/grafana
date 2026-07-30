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
//
// hasCapacity backpressures the NATS-backed re-list: while it reports false the
// re-list stops paginating after the current page (see NewJobInformer). Pass the
// driver's HasCapacity; a nil predicate always reads every page.
func NewJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration, reg prometheus.Registerer, hasCapacity func() bool) DeltaSource {
	metrics := newInformerMetrics(reg)
	resourceName := provisioningapis.JobResourceInfo.GroupVersionResource().Resource
	if nats.Enabled(subscriber) {
		onRequest := func() { metrics.observeRelistRequest(resourceName) }
		jobInformer := NewJobInformer(subscriber, client, "", resync, usinformer.NewStore(), onRequest, hasCapacity)
		// The informer is the job driver's only feed, so gating the initial list
		// on the subscription (the default) would stall the whole job queue while
		// NATS is unavailable — e.g. during startup of the embedded server. In
		// degraded mode jobs are still picked up at the re-list cadence; only the
		// live-event latency is lost until the subscription opens.
		jobInformer.AllowDegradedStart()
		jobInformer.SetMetrics(newNATSRecorder(metrics, resourceName))
		return jobInformer
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Jobs().Informer()
	// One metering handler observes each delivery once, however many controller
	// handlers register. AddEventHandler cannot fail on a not-yet-started informer.
	_, _ = inf.AddEventHandler(apiServerMeter{metrics: metrics, resourceName: resourceName})
	return inf
}

// NewJobInformer builds an Informer for jobs. onRequest, when non-nil, is called
// once per LIST request the re-list issues (one per page), so callers can meter
// pagination.
//
// hasCapacity backpressures the re-list: it is checked between pages, and once it
// reports false the re-list stops following continue tokens and returns what it
// has as a partial list (ErrPartialList). Objects beyond the current page cannot
// be processed until a worker frees, so fetching them would only grow the queue
// and memory; the next resync reconciles the rest once capacity returns. The first
// page is always read, so the workers stay fed. A nil hasCapacity reads every page.
func NewJobInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, onRequest func(), hasCapacity func() bool) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Job{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, int64, error) {
		objs, listRV, complete, err := listPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			if onRequest != nil {
				onRequest()
			}
			return c.Jobs(namespace).List(ctx, opts)
		}, hasCapacity)
		if err != nil {
			return nil, 0, err
		}
		if !complete {
			// Signal the truncation so the informer upserts what we read instead of
			// diffing it for deletes; the objects we skipped are unread, not gone.
			return objs, listRV, usinformer.ErrPartialList
		}
		return objs, listRV, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.JobResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}
