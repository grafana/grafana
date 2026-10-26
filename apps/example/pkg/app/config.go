package app

import (
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/resourcebus"
)

// ExampleConfig is an example app-specific config type
type ExampleConfig struct {
	EnableReconciler  bool
	EnableSomeFeature bool

	// ResourceBus is a delta source which announces resource changes out of band of the kubernetes watch, letting
	// the reconciler run against an informer that keeps no per-object cache. It is injected as an interface value,
	// so the app never learns which bus is behind it. A nil value selects the watch.
	ResourceBus resourcebus.Subscriber
	// BusLister builds the ResourceLister the bus informer re-lists with, for a host whose API server can return
	// identities alone. When nil, the informer lists full objects over the kind's own client.
	BusLister func(resource.Kind, resource.Client, operator.ClientListerOptions) (operator.ResourceLister, error)
}
