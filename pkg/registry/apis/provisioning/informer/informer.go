package informer

import (
	"k8s.io/client-go/tools/cache"
)

// DeltaSource is the subset of cache.SharedIndexInformer the controllers use to
// receive events: register a handler (whose registration reports HasSynced) and
// run until stopped. Both an apiserver-backed SharedIndexInformer and the
// NATS-backed informer.Informer satisfy it, so the wiring can pick a source
// without the controller knowing which it is.
type DeltaSource interface {
	AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error)
	Run(stopCh <-chan struct{})
}

// queueGroup is the NATS queue group every provisioning informer joins, so each
// notification is round-robined to a single replica rather than broadcast to all.
const queueGroup = "provisioning-informer"

// The per-resource constructors (one per type file) are thin: each binds LIST to
// its resource's typed client and hands its ResourceInfo to the shared
// newDeltaSourceInformer (see generic.go), which derives the GVR and builds the
// minimal live-event object from that ResourceInfo's concrete type — so the
// controller's event handler keys off the right type without a hand-written
// object builder or []runtime.Object copy loop per kind. namespace scopes the
// NATS subscription and the LIST; pass "" to watch every namespace. Each type
// file also has a New<Type>DeltaSource selector that picks a NATS-backed informer
// when nats.Enabled(subscriber), else an apiserver-backed one.
