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
	apiinformers "github.com/grafana/grafana/pkg/services/apiserver/informers"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewHistoricJobDeltaSource returns the historic-job delta source. Historic
// cleanup is age-based, so it needs only the resync and no live events: the
// selector gives it the cacheless re-list when it offers one (under NATS), and
// otherwise the apiserver watch, whose cache each resync replays. Cleanup reads
// no lister, so callers need only the DeltaSource.
func NewHistoricJobDeltaSource(selector *apiinformers.Selector, client versioned.Interface, resync time.Duration) (DeltaSource, error) {
	return selector.Source(apiinformers.Sources{
		GVR:   provisioningapis.HistoricJobResourceInfo.GroupVersionResource(),
		Needs: operator.WatchOptions{Resync: &operator.WatchResyncOptions{}},
		Watch: func() DeltaSource {
			return informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().HistoricJobs().Informer()
		},
		ReList: func() DeltaSource {
			return NewHistoricJobPeriodicInformer(client, "", resync)
		},
	})
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
