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
	// BusKeyLister builds the key lister a kind's re-list reads identities through, for a host whose API server can
	// serve them without object bodies. When nil, the informer re-lists full objects.
	BusKeyLister func(resource.Kind) (operator.ResourceKeyLister, error)
}
