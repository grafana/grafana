package informer

import (
	"context"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewHistoricJobDeltaSource returns the historic-job delta source. Historic
// cleanup is age-based, so it needs only the resync and no live events: the
// supplier gives it the cacheless re-list when it offers one (under NATS), and
// otherwise the apiserver watch, whose cache each resync replays. Cleanup reads
// no lister, so callers need only the DeltaSource.
func NewHistoricJobDeltaSource(supplier operator.InformerSupplier, clients resource.ClientGenerator, resync time.Duration) (DeltaSource, error) {
	return newDeltaSource(supplier, clients, provisioningapis.HistoricJobResourceInfo,
		operator.WatchOptions{Resync: &operator.WatchResyncOptions{}}, resync,
		func() runtime.Object { return &provisioningapis.HistoricJob{} })
}

// NewHistoricJobPeriodicInformer builds the NATS-mode historic-job source: a
// periodic lister that re-lists historic jobs every resync and delivers each one
// so the handler can act on its age. namespace scopes the list (empty lists every
// namespace).
func NewHistoricJobPeriodicInformer(client versioned.Interface, namespace string, resync time.Duration) *usinformer.CachelessPeriodicInformer {
	c := client.ProvisioningV0alpha1()
	// The periodic informer has no live subscription and so no re-list/live race
	// to reconcile; discard the list resource version.
	list := func(ctx context.Context) ([]runtime.Object, error) {
		objs, _, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.HistoricJobs(namespace).List(ctx, opts)
		})
		return objs, err
	}
	return usinformer.NewCachelessPeriodicInformer(provisioningapis.HistoricJobResourceInfo.GroupVersionResource().Resource, resync, list)
}
