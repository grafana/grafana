// Package informer swaps the watch transport of the generated provisioning
// informers while keeping their LIST-seeded cache.
//
// The generated SharedInformerFactory builds each informer's ListWatch from the
// typed clientset: ListFunc calls client...List and WatchFunc calls
// client...Watch. WrapClient decorates that clientset so every typed Watch is
// served by a custom WatchFunc, while List and all other calls are delegated to
// the real client. Passing the wrapped client to the stock factory therefore
// reroutes the informers' delta source without touching how their caches are
// seeded, listers, or event-handler wiring.
//
// The per-resource wrappers live in one file each (repository.go, job.go,
// connection.go, historicjob.go), mirroring the generated typed clientset.
package informer

import (
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	typedv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

// WrapClient returns a clientset whose typed Watch calls are served by fn while
// List and every other call delegate to real. A nil fn returns real unchanged.
func WrapClient(real versioned.Interface, fn WatchFunc) versioned.Interface {
	if fn == nil {
		return real
	}
	return &clientset{Interface: real, fn: fn}
}

type clientset struct {
	versioned.Interface
	fn WatchFunc
}

func (c *clientset) ProvisioningV0alpha1() typedv0alpha1.ProvisioningV0alpha1Interface {
	return &provisioningV0alpha1{ProvisioningV0alpha1Interface: c.Interface.ProvisioningV0alpha1(), fn: c.fn}
}

// provisioningV0alpha1 decorates the group client. Each resource getter (in its
// own file) returns a typed wrapper that overrides Watch with fn.
type provisioningV0alpha1 struct {
	typedv0alpha1.ProvisioningV0alpha1Interface
	fn WatchFunc
}
