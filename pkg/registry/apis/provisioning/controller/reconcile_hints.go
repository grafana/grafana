package controller

import (
	"errors"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// maxVisibilityAttempts bounds how many times a reconcile is retried when its
// read has not observed an upserted object yet — a read-after-write race on the
// decoupled NATS read seam, where the notification can outrun the API write
// becoming visible. After this many tries the key is dropped and left for the
// next resync.
const maxVisibilityAttempts = 3

// defaultVisibilityBackoff is the increasing delay between not-yet-visible
// retries, indexed by prior-attempt count. Reconcile reads are direct API GETs,
// so the visibility window is short: a create is usually readable within a few
// hundred milliseconds, and an object still missing after the full schedule
// (~2.6s) is almost certainly genuinely absent rather than lagging. Controllers
// copy this into a field so tests can shrink it.
var defaultVisibilityBackoff = []time.Duration{
	100 * time.Millisecond,
	500 * time.Millisecond,
	2 * time.Second,
}

// errObjectNotYetVisible signals that a reconcile read returned NotFound for an
// object that an upsert notification says should exist — i.e. a read-after-write
// race, not a deletion. A controller requeues the key with bounded backoff
// instead of dropping it. A NotFound for a delete notification is handled
// separately, as an expected no-op.
var errObjectNotYetVisible = errors.New("object not yet visible")

// reconcileHint carries the identity and freshness metadata a NATS notification
// advertises, so a controller can classify its reconcile read:
//   - operation tells whether a NotFound is an expected delete (no-op) or an
//     upsert whose write is not visible yet (worth a brief retry);
//   - uid tells a delete/recreate of the same namespace/name apart, so a stale
//     event for a previous object lifetime can be ignored;
//   - generation tells whether the fetched object already reflects the spec
//     change that triggered the event.
//
// Older producers omit uid/generation; a zero value means "unknown" and the
// corresponding check is skipped, so the behavior degrades to a plain
// brief-retry-on-NotFound rather than misfiring.
type reconcileHint struct {
	uid        string
	generation int64
	operation  string
}

// hintFromObject extracts the reconcile hint from the object handed to an event
// handler. For a live NATS notification this is the stub the informer annotated
// with the change's identity/intent; for a re-list or the apiserver-backed
// informer it is the real object, which carries a real uid/generation and no
// operation annotation — treated as an upsert.
func hintFromObject(obj metav1.Object) reconcileHint {
	operation := obj.GetAnnotations()[usinformer.NotificationOperationAnnotation]
	if operation == "" {
		operation = usinformer.NotificationOperationUpsert
	}
	return reconcileHint{
		uid:        string(obj.GetUID()),
		generation: obj.GetGeneration(),
		operation:  operation,
	}
}

// visibilityRetryDelay returns the jittered backoff before the next
// not-yet-visible retry for the given prior-attempt count, or ok=false once the
// bounded number of retries is exhausted. Jitter spreads a burst of concurrent
// races so their retries do not realign on every wake-up.
func visibilityRetryDelay(backoff []time.Duration, attempts int) (time.Duration, bool) {
	if attempts < 0 || attempts >= len(backoff) {
		return 0, false
	}
	return wait.Jitter(backoff[attempts], 0.5), true
}
