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

// NewConnectionDeltaSource returns the connection delta source and the getter it
// backs. Under NATS the getter reads reconcile state fresh from the API;
// otherwise it reads the informer's cache lister.
//
// A non-nil keys makes the NATS re-list keys-only (identity, no bodies); nil
// keeps the full-object list. Both callers follow [provisioning]
// keys_only_relist, in process over storage and in the operator over HTTP.
//
// freshness instruments how the getter's reads compare to the notifications
// that triggered them (see freshness.go); nil disables the observation, and it
// applies to the NATS path only.
func NewConnectionDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics *RelistProjectionMetrics, freshness *FreshnessMetrics) (appinformer.DeltaSource, appinformer.ConnectionGetter) {
	if nats.Enabled(subscriber) {
		gvr := provisioningapis.ConnectionResourceInfo.GroupVersionResource()
		recorder := metrics.Recorder(gvr)
		source := NewConnectionInformer(subscriber, client, "", resync, usinformer.NewStore(), keys, recorder)
		// Same as the repository informer: the controller's only feed, with
		// connection health checks driven by the re-list, so it must keep
		// operating at the re-list cadence while NATS is unavailable rather
		// than gate on the subscription.
		source.AllowDegradedStart()
		announced := newAnnouncements()
		source.SetAnnouncements(announced)
		getter := appinformer.NewClientConnectionGetter(client.ProvisioningV0alpha1())
		return source, observeConnectionFreshness(getter, announced, freshness.Recorder(gvr.Resource))
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Connections()
	return inf.Informer(), appinformer.NewCachedConnectionGetter(inf.Lister())
}

// NewConnectionInformer builds an Informer for connections. When keys is
// non-nil the periodic re-list is keys-only; otherwise it lists full objects.
func NewConnectionInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, keys keysapi.Lister, recorder RelistRecorder) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return appinformer.Identity(ns, name, "")
	}
	list := identityList(keys, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return c.Connections(namespace).List(ctx, opts)
	}, recorder)
	return usinformer.NewInformer(subscriber, provisioningapis.ConnectionResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}
