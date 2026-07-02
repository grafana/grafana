package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewHistoricJobDeltaSource returns the historic-job delta source: a NATS-backed
// informer when the subscriber is enabled, otherwise an apiserver-backed
// SharedIndexInformer. Cleanup reads no lister, so callers need only the
// DeltaSource.
func NewHistoricJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration, metrics *Metrics) DeltaSource {
	if nats.Enabled(subscriber) {
		return NewHistoricJobInformer(subscriber, client, "", resync, usinformer.NewStore(), metrics)
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().HistoricJobs().Informer()
	return metrics.MeterAPIServer(provisioningapis.HistoricJobResourceInfo.GroupVersionResource().Resource, inf)
}

// NewHistoricJobInformer builds an Informer for historic jobs. It passes a nil
// object builder, so it is driven only by the periodic re-list of full objects:
// the cleanup handler reads each job's creation timestamp directly (it does not
// re-fetch), so a minimal live-event object would make it act on a job that has
// no age. Cleanup is resync-driven anyway, so live notifications add nothing.
func NewHistoricJobInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, metrics *Metrics) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	list := func(ctx context.Context) ([]runtime.Object, error) {
		l, err := c.HistoricJobs(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		out := make([]runtime.Object, len(l.Items))
		for i := range l.Items {
			out[i] = &l.Items[i]
		}
		return out, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.HistoricJobResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, nil, list, metrics.NATSRecorder())
}
