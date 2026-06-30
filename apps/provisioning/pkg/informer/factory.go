package informer

import (
	"time"

	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

// NewInformerFactory builds the standard provisioning SharedInformerFactory,
// backed by the apiserver LIST+WATCH. It is exactly
// informers.NewSharedInformerFactory and exists so callers can pick between the
// apiserver and NATS variants from a single package.
func NewInformerFactory(client versioned.Interface, resync time.Duration) informers.SharedInformerFactory {
	return informers.NewSharedInformerFactory(client, resync)
}

// NewNATSInformerFactory builds a provisioning SharedInformerFactory whose
// informers keep their LIST-seeded cache (and their listers and event-handler
// wiring) but take their watch deltas from a NATS-based watch instead of the
// apiserver watch. The NATS watch transport is not implemented yet, so the
// informers' Watch currently fails with ErrNotImplemented while LIST still
// seeds the cache.
func NewNATSInformerFactory(client versioned.Interface, resync time.Duration) informers.SharedInformerFactory {
	return informers.NewSharedInformerFactory(WrapClient(client, NotImplemented), resync)
}
