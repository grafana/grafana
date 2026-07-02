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

// The resource kinds live in kinds.go, one thin constructor each, on top of the
// generic selectors in generic.go: getterlessDeltaSource for kinds whose
// controllers read no lister (jobs, historic jobs) and getterDeltaSource for
// those that reconcile against a getter (repositories, connections). Each
// constructor supplies only what the generated clientset can't express
// generically — its ResourceInfo, its typed LIST, and (for getter kinds) its
// typed GET and cache lister — and the selector derives everything else (GVR,
// live-event object, apiserver informer) from the ResourceInfo. All watch every
// namespace.
