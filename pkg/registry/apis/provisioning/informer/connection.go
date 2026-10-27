package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/operator"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/services/apiserver/keys/keyslister"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// ConnectionGetter is the read seam the connection controller reconciles
// against. It exposes only the single connection under reconciliation, so the
// source can be swapped without touching the controller.
type ConnectionGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error)
}

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
func NewConnectionDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics *operator.BusInformerMetrics, freshness *operator.FreshnessMetrics) (DeltaSource, ConnectionGetter, error) {
	if nats.Enabled(subscriber) {
		announced := operator.NewAnnouncementTracker(operator.AnnouncementTrackerOptions{})
		source, err := NewConnectionInformer(subscriber, client, "", resync, keys, usinformer.BusSourceOptions{
			Announcements: announced,
			Metrics:       metrics,
		})
		if err != nil {
			return nil, nil, err
		}
		getter := NewClientConnectionGetter(client.ProvisioningV0alpha1())
		return source, observeConnectionFreshness(getter, announced, freshness.Recorder(usinformer.SDKKind(&provisioningapis.ConnectionResourceInfo))), nil
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Connections()
	return inf.Informer(), NewCachedConnectionGetter(inf.Lister()), nil
}

// NewConnectionInformer builds the NATS-mode connection source. namespace scopes
// the subscription and the re-list; pass "" to cover every namespace.
func NewConnectionInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, keys keysapi.Lister, opts usinformer.BusSourceOptions) (usinformer.BusSource, error) {
	c := client.ProvisioningV0alpha1()
	if keys != nil {
		opts.Keys = keyslister.New(keys)
	}
	opts.Namespace = namespace
	opts.Group = queueGroup
	page := func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Connections(namespace).List(ctx, opts)
		}
	return usinformer.NewBusDeltaSource(subscriber, &metav1.PartialObjectMetadata{},
		&provisioningapis.ConnectionResourceInfo, resync, page, opts)
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
// the NATS watch where there is no informer cache to serve a fresh reconcile read.
func NewClientConnectionGetter(c typedclient.ProvisioningV0alpha1Interface) ConnectionGetter {
	return clientConnectionGetter{client: c}
}

type clientConnectionGetter struct {
	client typedclient.ProvisioningV0alpha1Interface
}

func (g clientConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return g.client.Connections(namespace).Get(ctx, name, metav1.GetOptions{})
}
