package informer

import (
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// DeltaSource is the subset of cache.SharedIndexInformer the controllers use to
// receive events: register a handler (whose registration reports HasSynced) and
// run until stopped. Both an apiserver-backed SharedIndexInformer and the
// NATS-backed Informer satisfy it, so the wiring can pick a source without the
// controller knowing which it is.
type DeltaSource interface {
	AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error)
	Run(stopCh <-chan struct{})
}

// Informer and Store alias the generic NATS-backed types so provisioning wiring
// has a single import for the per-resource constructors (one per file in this
// package), the informer type, and the shared snapshot store.
type Informer = usinformer.Informer

type Store = usinformer.Store

// NewStore returns an empty snapshot Store to share between an informer and a
// reader (e.g. the repository quota getter).
func NewStore() *Store { return usinformer.NewStore() }

// queueGroup is the NATS queue group every provisioning informer joins, so each
// notification is round-robined to a single replica rather than broadcast to all.
const queueGroup = "provisioning-informer"

// The per-resource constructors (one per type file) bind LIST to that resource's
// typed client and build the minimal live-event object as the resource's concrete
// type, so the controller's event handler keys off the right type. namespace
// scopes the NATS subscription and the LIST; pass "" to watch every namespace.
// Each type file also has a New<Type>DeltaSource selector that picks a
// NATS-backed informer when NATS is enabled, else an apiserver-backed one.

// natsEnabled reports whether the subscriber is present and NATS is on, i.e.
// whether the NATS-backed informer should be used over the apiserver one.
func natsEnabled(subscriber nats.Subscriber) bool {
	return subscriber != nil && subscriber.Enabled()
}
