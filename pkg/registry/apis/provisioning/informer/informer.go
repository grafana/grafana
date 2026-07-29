package informer

import (
	"errors"

	"k8s.io/client-go/tools/cache"
)

// ErrNotObserved signals that a reconcile read did not find the object. It is
// deliberately distinct from an authoritative apierrors NotFound served by an
// informer's cache lister: it comes from the NATS read seam's fresh API read,
// which is decoupled from the notification that enqueued the key, so a miss is
// usually a read-after-write race on a just-created or just-updated object rather
// than a real deletion. Controllers retry it (bounded) instead of dropping the
// key until the next resync. The apiserver-backed getters never return it — their
// lister cache is authoritative, so their NotFound means the object is gone.
var ErrNotObserved = errors.New("object not yet observed by the read seam")

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

// The per-resource constructors (one per type file) bind LIST to that resource's
// typed client and build the minimal live-event object as the resource's concrete
// type, so the controller's event handler keys off the right type. namespace
// scopes the NATS subscription and the LIST; pass "" to watch every namespace.
// Each type file also has a New<Type>DeltaSource selector that picks a
// NATS-backed informer when nats.Enabled(subscriber), else an apiserver-backed one.
