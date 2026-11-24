// Package informers supplies the informers of every controller that can be fed by
// NATS, in-process and in the standalone operators, so that which watch
// mechanism serves a kind is decided in one place.
//
// Each kind declares what its handlers need as an operator.WatchOptions, and each
// mechanism advertises what it provides. The SDK's selecting supplier (the
// decider) gives the kind the first, least capable mechanism that satisfies it,
// and the API watch when none does.
package informers

import (
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/pkg/setting"
)

// ReList has no live channel: it re-lists every object on a schedule. It is the
// only mechanism offered besides the API watch until the NATS notification
// mechanisms have SDK implementations.
var ReList = operator.WatchOptions{
	Resync: &operator.WatchResyncOptions{},
}

// KeyedNeeds is what a work-queue controller needs when it enqueues keys and reads
// each object fresh: identities are enough, each key is worked once so live
// deliveries may be shared, and the resync recovers whatever the live channel
// missed.
var KeyedNeeds = operator.WatchOptions{
	Live:   &operator.WatchLiveOptions{Detail: operator.WatchDetailIdentity, Distribution: operator.WatchDistributionShared},
	Resync: &operator.WatchResyncOptions{Detail: operator.WatchDetailIdentity},
}

// ProvideSupplier returns the decider over the watch mechanisms this deployment
// has, for every informer to be built with: the provisioning and folder
// controllers through NewDeltaSource, and SDK apps and operators as their
// InformerSupplier. The re-list is offered whenever NATS is configured, since it
// needs no subscription; every kind it does not satisfy takes the API watch.
func ProvideSupplier(cfg *setting.Cfg) operator.InformerSupplier {
	return operator.NewSelectingInformerSupplier(simple.DefaultInformerSupplier,
		offer(cfg.NATS.Enabled, ReList, newReListInformer),
	)
}

// offer lists a mechanism when the deployment has it; a nil mechanism is skipped.
func offer(available bool, provides operator.WatchOptions, supplier operator.InformerSupplier) operator.InformerMechanism {
	if !available {
		return nil
	}
	return operator.NewInformerMechanism(provides, supplier)
}
