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
)

// NewHistoricJobDeltaSource returns the historic-job delta source. When NATS is
// off it is an apiserver-backed SharedIndexInformer: the watch populates a cache
// that each resync replays, so cleanup re-triggers without re-listing. When NATS
// is on there is no watch to feed a cache, so it is a CachelessCronSource that re-lists
// on a schedule instead. Historic cleanup is age-based and needs no live events,
// so neither path subscribes to notifications. Cleanup reads no lister, so callers
// need only the DeltaSource.
func NewHistoricJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) DeltaSource {
	if nats.Enabled(subscriber) {
		return NewHistoricJobCronSource(client, "", resync)
	}
	return informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().HistoricJobs().Informer()
}

// NewHistoricJobCronSource builds the NATS-mode historic-job source: a cron-style
// source that re-lists historic jobs every resync and delivers each one so the
// handler can act on its age. namespace scopes the list (empty lists every
// namespace).
func NewHistoricJobCronSource(client versioned.Interface, namespace string, resync time.Duration) *CachelessCronSource {
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
	return NewCachelessCronSource(provisioningapis.HistoricJobResourceInfo.GroupVersionResource().Resource, resync, list)
}
