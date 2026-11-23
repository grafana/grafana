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
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
)

// What each mechanism provides, least capable first: the order they are offered in.
var (
	// ReList has no live channel: it re-lists every object on a schedule.
	ReList = operator.WatchOptions{
		Resync: &operator.WatchResyncOptions{},
	}
	// NotifyOnly delivers identities live, round-robined over the replicas, with no resync.
	NotifyOnly = operator.WatchOptions{
		Live: &operator.WatchLiveOptions{Detail: operator.WatchDetailIdentity, Distribution: operator.WatchDistributionShared},
	}
	// NotifyWithReList is NotifyOnly plus a keys-only re-list delivered to every replica.
	NotifyWithReList = operator.WatchOptions{
		Live:   NotifyOnly.Live,
		Resync: &operator.WatchResyncOptions{Detail: operator.WatchDetailIdentity},
	}
)

// KeyedNeeds is what a work-queue controller needs when it enqueues keys and reads
// each object fresh: identities are enough, each key is worked once so live
// deliveries may be shared, and the resync recovers whatever the live channel
// missed.
var KeyedNeeds = operator.WatchOptions{
	Live:   &operator.WatchLiveOptions{Detail: operator.WatchDetailIdentity, Distribution: operator.WatchDistributionShared},
	Resync: &operator.WatchResyncOptions{Detail: operator.WatchDetailIdentity},
}

var errNotImplemented = errors.New("not implemented")

// ProvideSupplier returns the decider over the watch mechanisms this deployment
// has, for every informer to be built with: the provisioning and folder
// controllers through NewDeltaSource, and SDK apps and operators as their
// InformerSupplier. The re-list is offered whenever NATS is configured, since it
// needs no subscription; the NATS mechanisms when the subscriber is enabled
// (subscriber may be nil). Those fail to build until they have SDK
// implementations, so a kind they are selected for has no informer.
func ProvideSupplier(cfg *setting.Cfg, subscriber nats.Subscriber) operator.InformerSupplier {
	live := nats.Enabled(subscriber)
	return operator.NewSelectingInformerSupplier(simple.DefaultInformerSupplier,
		offer(cfg.NATS.Enabled, ReList, newReListInformer),
		offer(live, NotifyOnly, unimplemented("NATS notify-only")),
		offer(live, NotifyWithReList, unimplemented("NATS notify with re-list")),
	)
}

// offer lists a mechanism when the deployment has it; a nil mechanism is skipped.
func offer(available bool, provides operator.WatchOptions, supplier operator.InformerSupplier) operator.InformerMechanism {
	if !available {
		return nil
	}
	return operator.NewInformerMechanism(provides, supplier)
}

func unimplemented(mechanism string) operator.InformerSupplier {
	return func(kind resource.Kind, _ resource.ClientGenerator, _ operator.InformerOptions) (operator.Informer, error) {
		return nil, fmt.Errorf("%s informer for %s: %w", mechanism, kind.GroupVersionKind(), errNotImplemented)
	}
}
