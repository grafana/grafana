package informer

import (
	"context"
	appinformer "github.com/grafana/grafana/apps/provisioning/pkg/informer"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/nats"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewRepositoryDeltaSource returns the repository delta source and the getter it
// backs. Under NATS the getter reads reconcile state fresh from the API and the
// quota count from the informer's store; otherwise the getter reads the
// informer's cache lister.
//
// A non-nil keys makes the NATS re-list keys-only; nil keeps the full-object
// list.
//
// freshness instruments how the getter's reads compare to the notifications
// that triggered them (see freshness.go); nil disables the observation. It
// applies to the NATS path only — the apiserver path reads a cache the watch
// keeps current, so there is no cross-replica read visibility to measure.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics *RelistProjectionMetrics, freshness *FreshnessMetrics) (DeltaSource, appinformer.RepositoryGetter) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
		recorder := metrics.Recorder(gvr)
		source := NewRepositoryInformer(subscriber, client, "", resync, store, keys, recorder)
		// The informer is the repository controller's only feed, and everything
		// that creates provisioning work lives in its reconcile: scheduled syncs,
		// health checks, webhook create/rotate, quota. Gating the initial list on
		// the subscription would stall all of it while NATS is unavailable — and
		// gating buys no safety here, since reconcile reads come fresh from the
		// API and the re-list (not the live stream) is what keeps a replica
		// reconciled under round-robin delivery. In degraded mode only the
		// live-event latency is lost until the subscription opens.
		source.AllowDegradedStart()
		announced := newAnnouncements()
		source.SetAnnouncements(announced)
		getter := appinformer.NewClientRepositoryGetter(client.ProvisioningV0alpha1(), store)
		return source, observeRepositoryFreshness(getter, announced, freshness.Recorder(gvr.Resource))
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Repositories()
	return inf.Informer(), appinformer.NewCachedRepositoryGetter(inf.Lister())
}

// NewRepositoryInformer builds an Informer for repositories. When keys is
// non-nil the periodic re-list is keys-only; otherwise it lists full objects.
func NewRepositoryInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, keys keysapi.Lister, recorder RelistRecorder) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return appinformer.Identity(ns, name, "")
	}
	list := identityList(keys, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return c.Repositories(namespace).List(ctx, opts)
	}, recorder)
	return usinformer.NewInformer(subscriber, provisioningapis.RepositoryResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}
