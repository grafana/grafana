package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewHistoricJobDeltaSource returns the historic-job delta source. When NATS is
// off it is an apiserver-backed SharedIndexInformer: the watch populates a cache
// that each resync replays, so cleanup re-triggers without re-listing. When NATS
// is on there is no watch to feed a cache, so it is a CachelessPeriodicInformer that
// re-lists on a schedule instead. Historic cleanup is age-based and needs no live
// events, so neither path subscribes to notifications.
//
// The choice is driven by the natsEnabled flag (from cfg.NATS.Enabled), not by a
// live subscriber: the historic-cleanup operator has no NATS consumer role, so it
// must not depend on holding a subscriber to pick the cacheless source. Cleanup
// reads no lister, so callers need only the DeltaSource.
func NewHistoricJobDeltaSource(natsEnabled bool, client versioned.Interface, resync time.Duration) DeltaSource {
	if natsEnabled {
		return NewHistoricJobPeriodicInformer(client, "", resync)
	}
	return informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().HistoricJobs().Informer()
}

// NewHistoricJobPeriodicInformer builds the NATS-mode historic-job source: a
// periodic lister that re-lists historic jobs every resync and delivers each one
// so the handler can act on its age. namespace scopes the list (empty lists every
// namespace).
func NewHistoricJobPeriodicInformer(client versioned.Interface, namespace string, resync time.Duration) *usinformer.CachelessPeriodicInformer {
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
	return usinformer.NewCachelessPeriodicInformer(provisioningapis.HistoricJobResourceInfo.GroupVersionResource().Resource, resync, list)
}
