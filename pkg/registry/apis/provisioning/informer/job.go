package informer

import (
	"context"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewJobDeltaSource returns the job delta source: an app-sdk bus informer when the subscriber is enabled, otherwise
// an apiserver-backed SharedIndexInformer. The job controller reads no lister, so callers need only the DeltaSource.
//
// Both paths report their deliveries on the same app-sdk families, in metrics; a nil value disables them.
func NewJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration, metrics Metrics) (DeltaSource, error) {
	if nats.Enabled(subscriber) {
		return NewJobBusDeltaSource(subscriber, client, "", resync, metrics)
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Jobs().Informer()
	// One metering handler observes each delivery once, however many controller
	// handlers register. AddEventHandler cannot fail on a not-yet-started informer.
	_, _ = inf.AddEventHandler(operator.NewDeliveryMeter(provisioningapis.JobResourceInfo.GroupVersionKind(), metrics.Delivery))
	return inf, nil
}

// NewJobBusDeltaSource builds the NATS-mode job source. namespace scopes the subscription and the re-list; pass ""
// to cover every namespace.
func NewJobBusDeltaSource(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, metrics Metrics) (DeltaSource, error) {
	c := client.ProvisioningV0alpha1()
	page := func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return c.Jobs(namespace).List(ctx, opts)
	}
	return usinformer.NewBusDeltaSource(subscriber, &provisioningapis.Job{}, &provisioningapis.JobResourceInfo,
		resync, page, usinformer.BusSourceOptions{Namespace: namespace, Group: queueGroup, Metrics: metrics.Bus, Delivery: metrics.Delivery})
}
