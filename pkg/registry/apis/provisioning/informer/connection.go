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
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
	apiinformers "github.com/grafana/grafana/pkg/services/apiserver/informers"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// ConnectionGetter is the read seam the connection controller reconciles
// against. It exposes only the single connection under reconciliation, so the
// source can be swapped without touching the controller.
type ConnectionGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error)
}

// NewConnectionDeltaSource returns the connection delta source the supplier
// selects and the getter the controller reconciles against. The informer's cache
// is not exposed whichever mechanism serves it, so the getter reads the API.
func NewConnectionDeltaSource(supplier operator.InformerSupplier, clients resource.ClientGenerator, client versioned.Interface, resync time.Duration) (DeltaSource, ConnectionGetter, error) {
	source, err := newDeltaSource(supplier, clients, provisioningapis.ConnectionResourceInfo, apiinformers.KeyedNeeds, resync,
		func() runtime.Object { return &provisioningapis.Connection{} })
	if err != nil {
		return nil, nil, err
	}
	return source, NewClientConnectionGetter(client.ProvisioningV0alpha1()), nil
}

// natsConnectionSource is the NATS-fed connection source with the getter it
// backs, which reads fresh from the API. No supplier builds it until the NATS
// mechanisms have SDK implementations; see natsRepositorySource.
func natsConnectionSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics *RelistProjectionMetrics, freshness *FreshnessMetrics) (DeltaSource, ConnectionGetter) {
	gvr := provisioningapis.ConnectionResourceInfo.GroupVersionResource()
	source := NewConnectionInformer(subscriber, client, "", resync, usinformer.NewStore(), keys, metrics.Recorder(gvr))
	// Same as the repository informer: the controller's only feed, with
	// connection health checks driven by the re-list, so it must keep
	// operating at the re-list cadence while NATS is unavailable rather
	// than gate on the subscription.
	source.AllowDegradedStart()
	announced := newAnnouncements()
	source.SetAnnouncements(announced)
	return source, observeConnectionFreshness(NewClientConnectionGetter(client.ProvisioningV0alpha1()), announced, freshness.Recorder(gvr.Resource))
}

// NewConnectionInformer builds an Informer for connections. When keys is
// non-nil the periodic re-list is keys-only; otherwise it lists full objects.
func NewConnectionInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, keys keysapi.Lister, recorder RelistRecorder) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return identity(ns, name, "")
	}
	list := identityList(keys, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return c.Connections(namespace).List(ctx, opts)
	}, recorder)
	return usinformer.NewInformer(subscriber, provisioningapis.ConnectionResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}

// NewCachedConnectionGetter backs a ConnectionGetter with the informer's
// generated lister, i.e. the informer's local cache.
func NewCachedConnectionGetter(lister listers.ConnectionLister) ConnectionGetter {
	return cachedConnectionGetter{lister: lister}
}

type cachedConnectionGetter struct {
	lister listers.ConnectionLister
}

func (g cachedConnectionGetter) Get(_ context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return g.lister.Connections(namespace).Get(name)
}

// NewClientConnectionGetter backs a ConnectionGetter with the API client, for
// informers whose cache cannot serve a fresh reconcile read.
func NewClientConnectionGetter(c typedclient.ProvisioningV0alpha1Interface) ConnectionGetter {
	return clientConnectionGetter{client: c}
}

type clientConnectionGetter struct {
	client typedclient.ProvisioningV0alpha1Interface
}

func (g clientConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return g.client.Connections(namespace).Get(ctx, name, metav1.GetOptions{})
}
