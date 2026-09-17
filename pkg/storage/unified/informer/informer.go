package informer

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/grafana/dskit/backoff"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// ObjectFunc builds a minimal typed object carrying just the identity from a
// notification (namespace + name). The controllers treat a change notification
// as a signal — they re-fetch the object from the API in their reconcile — so
// the informer does not read the object itself; it hands the handler the
// smallest object that carries the queue key. It must be the resource's concrete
// type, because the handlers key off the type (e.g. *Repository).
//
// A nil ObjectFunc means the resource is driven only by the periodic re-list of
// full objects, not by live notifications — for handlers that read the object
// directly instead of re-fetching.
type ObjectFunc func(namespace, name string) runtime.Object

// ListFunc returns every object of one resource kind, read straight from the
// API, along with the resource version the LIST snapshot was taken at. The
// informer calls it once on start — to drive the initial reconcile and report
// HasSynced — and again on every resync interval to re-deliver the full set. The
// periodic re-list is what makes the informer correct despite round-robin
// delivery: an event routed to another replica, or a hard delete that is never
// announced, is reconciled on the next list.
//
// The list resource version dates the snapshot relative to live write-throughs
// that raced it (the subscription is open while the LIST runs), letting Replace
// tell a live write that outran the snapshot from an object the snapshot dropped;
// 0 disables that reconciliation. See Store.Replace.
type ListFunc func(ctx context.Context) (objs []runtime.Object, listRV int64, err error)

// Verb values passed to the Metrics event observations.
const (
	VerbAdd    = "add"
	VerbUpdate = "update"
	VerbDelete = "delete"
)

// Metrics receives one observation per event the informer delivers to its
// handlers (per event, not per handler): ObserveLiveEvent for a live
// notification, ObserveRelistEvent for a delivery from the periodic re-list.
// rv is the resource version whose embedded timestamp dates the change, so an
// implementation can derive delivery latency; it is 0 when the event carries
// no meaningful issue time: relist re-deliveries of retained objects,
// relist-detected deletes (the last-known RV predates the delete), and the
// initial list.
//
// ObserveReconnect is called each time the live subscription is
// (re)established after a gap — live events published during the gap were
// dropped, and the informer forces a re-list to recover them.
//
// ObserveLiveSubscription reports whether the informer holds an open live
// subscription (true) or is running re-list-only (false): before the
// subscription first opens, throughout degraded-start mode, and once the
// informer stops. It cannot see mid-run connection outages — the subscription
// exposes no disconnect callback and the client resumes it transparently —
// so a connection-level status metric is what reports those.
//
// Implementations must not block: observations are made on the delivery path.
type Metrics interface {
	ObserveLiveEvent(verb string, rv int64)
	ObserveRelistEvent(verb string, rv int64)
	ObserveReconnect()
	ObserveLiveSubscription(open bool)
}

// defaultResync is the fallback re-list cadence when a caller passes a
// non-positive interval.
const defaultResync = 5 * time.Minute

// defaultSubscribeRetry is how often Run retries opening the live subscription
// while it is unavailable — most commonly at startup, when the embedded NATS
// server is still starting and has no client URL yet.
const defaultSubscribeRetry = 5 * time.Second

// Informer drives a controller's informer event handlers from NATS instead of an
// apiserver-backed SharedInformer. It keeps no live per-object cache: on each
// NATS notification it hands the handler a minimal object built from the
// notification (the controllers use it only as a signal and re-fetch from the
// API), and it periodically re-lists the full set from the API. Controllers
// wired to an Informer must therefore read the object they reconcile straight
// from the API (there is no cache to serve a fresh read).
//
// It retains a snapshot of the last re-list, exposed via Store, for
// staleness-tolerant reads such as a count — reads that accept being as stale as
// the resync interval and would otherwise cost an API LIST each time. Diffing
// each re-list against that snapshot is also how it catches hard deletes (which
// no live notification reliably reaches under round-robin delivery): a vanished
// object is delivered as a delete carrying its last-known state.
//
// This is the counterpart to the apiserver watch for provisioning: the very same
// cache.ResourceEventHandler a controller registers on a SharedInformer is
// registered here instead, so the controllers' enqueue/reconcile logic is
// unchanged — only the delta source moves from the informer to NATS.
type Informer struct {
	subscriber nats.Subscriber
	gvr        schema.GroupVersionResource
	namespace  string
	resync     time.Duration
	queueGroup string
	newObject  ObjectFunc
	list       ListFunc
	log        log.Logger

	store Store

	// retryInterval is how often Run retries opening the live subscription while it
	// fails; defaults to defaultSubscribeRetry.
	retryInterval time.Duration

	// degradedStart lets Run fall back to re-list-only operation when the live
	// subscription cannot be opened, instead of holding the initial list (and
	// HasSynced) until it succeeds. See AllowDegradedStart.
	degradedStart bool

	// jitterFactor randomizes each resync interval by up to this fraction to avoid
	// a thundering herd; defaults to defaultResyncJitterFactor.
	jitterFactor float64

	// metrics observes delivered events and reconnects; nil disables observation.
	// See SetMetrics.
	metrics Metrics

	// reconnect signals the run loop to re-list after a NATS reconnect, since a
	// round-robin subscription can miss events published while it was down.
	// Buffered depth 1 and a non-blocking send coalesce bursts into one re-list.
	reconnect chan struct{}

	mu       sync.Mutex
	handlers []cache.ResourceEventHandler
	synced   atomic.Bool
	syncedCh chan struct{} // closed once the initial list completes
}

// NewInformer builds an Informer for one resource kind. namespace scopes the NATS
// subscription (empty watches every namespace); list reads that kind from the
// API. resync is how often the full set is re-listed; a non-positive value falls
// back to defaultResync.
//
// queueGroup is the NATS queue group the subscription joins: the broker
// round-robins each notification to a single replica in the group instead of
// broadcasting to all, so a replica sees only a subset of the live events (which
// is why the periodic re-list, not the live stream, is what keeps every replica
// reconciled). An empty queueGroup subscribes without one, so every replica
// receives every notification.
//
// newObject builds the minimal object delivered on a live notification; a nil
// newObject disables live notifications, leaving only the periodic re-list.
//
// store is the snapshot the informer refreshes on each re-list. Pass the same
// Store to a reader (e.g. a getter serving a quota count) to share it; the
// informer never reads it, so an unshared informer can be given its own.
func NewInformer(subscriber nats.Subscriber, gvr schema.GroupVersionResource, namespace string, resync time.Duration, queueGroup string, store Store, newObject ObjectFunc, list ListFunc) *Informer {
	if resync <= 0 {
		resync = defaultResync
	}
	// An unshared informer needs no external store; default one so Run never nil-panics.
	if store == nil {
		store = NewStore()
	}
	return &Informer{
		subscriber:    subscriber,
		gvr:           gvr,
		namespace:     namespace,
		resync:        resync,
		queueGroup:    queueGroup,
		newObject:     newObject,
		list:          list,
		log:           log.New("provisioning.informer.nats"),
		store:         store,
		retryInterval: defaultSubscribeRetry,
		jitterFactor:  defaultResyncJitterFactor,
		syncedCh:      make(chan struct{}),
		reconnect:     make(chan struct{}, 1),
	}
}

// AddEventHandler registers a handler to receive add/update/delete deltas,
// mirroring cache.SharedIndexInformer.AddEventHandler: it returns a registration
// whose HasSynced reports the informer's initial-list state, so callers wait on
// it with cache.WaitForCacheSync exactly as they would an apiserver informer's.
// Register all handlers before Run; there is no cache to replay, so a handler
// added after Run only sees events from the next notification or re-list.
func (n *Informer) AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	if handler == nil {
		return nil, fmt.Errorf("nats informer: nil handler for %s", n.gvr.String())
	}
	n.mu.Lock()
	n.handlers = append(n.handlers, handler)
	n.mu.Unlock()
	return registration{informer: n}, nil
}

// HasSynced reports whether the initial full list has completed at least once.
func (n *Informer) HasSynced() bool { return n.synced.Load() }

// AllowDegradedStart lets Run operate in re-list-only degraded mode while the
// live subscription cannot be opened — most commonly at startup, when the
// embedded NATS server has no client URL yet — instead of holding the initial
// list (and HasSynced) until it succeeds. Run keeps retrying the subscription
// in the background and forces a re-list once it opens, reconciling whatever
// was published in between. Consumers whose progress must not stall with NATS
// (e.g. the job queue, whose only feed is this informer) opt in; the default
// gating suits controllers that prefer not to start against a snapshot with no
// live updates. Call before Run.
func (n *Informer) AllowDegradedStart() { n.degradedStart = true }

// SetMetrics registers the observer for delivered events and reconnects; a nil
// observer (the default) disables observation. Call before Run.
func (n *Informer) SetMetrics(m Metrics) { n.metrics = m }

// registration implements cache.ResourceEventHandlerRegistration by deferring to
// the informer's sync state, so a NATS informer registration is interchangeable
// with an apiserver one at the wiring seam.
type registration struct{ informer *Informer }

var _ cache.ResourceEventHandlerRegistration = registration{}

func (r registration) HasSynced() bool { return r.informer.HasSynced() }

func (r registration) HasSyncedChecker() cache.DoneChecker {
	return syncedChecker(r)
}

type syncedChecker struct{ informer *Informer }

func (c syncedChecker) Name() string          { return "nats-informer:" + c.informer.gvr.String() }
func (c syncedChecker) Done() <-chan struct{} { return c.informer.syncedCh }

// Run delivers events to the registered handlers until stopCh is closed,
// mirroring cache.SharedIndexInformer.Run: it blocks, so start it with
// `go informer.Run(stopCh)`. It first opens the resource's NATS subscription
// (retrying until it succeeds, unless live notifications are disabled), then
// performs the initial list (marking HasSynced), then serves live notifications
// and a periodic re-list. Subscribing before listing means it never lists — nor
// reports HasSynced — while it still cannot watch the resource, unless
// AllowDegradedStart opted into re-list-only operation for that window.
// Register handlers before calling Run.
func (n *Informer) Run(stopCh <-chan struct{}) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		select {
		case <-stopCh:
			cancel()
		case <-ctx.Done():
		}
	}()

	var sub nats.Subscription
	defer func() {
		if sub != nil {
			if err := sub.Unsubscribe(); err != nil {
				n.log.Debug("nats informer: unsubscribe", "error", err)
			}
		}
	}()

	// Open the live subscription before the initial list, so a change published
	// while we are listing is delivered (core NATS has no replay) rather than
	// dropped in a list-to-subscribe gap. If the subscription cannot be created
	// yet — most commonly at startup, before the embedded NATS server has a client
	// URL — the default is to keep retrying and NOT list or report HasSynced:
	// re-listing a resource we cannot watch would start the controller against a
	// snapshot with no live updates until the next resync. With
	// AllowDegradedStart the informer proceeds in re-list-only mode instead and
	// retrySubscribe opens the subscription in the background. A nil newObject or
	// a disabled subscriber means the informer is re-list-only, so there is no
	// subscription to wait for.
	if n.newObject != nil && nats.Enabled(n.subscriber) {
		// The gauge covers only what this informer can see: no subscription yet
		// (or degraded mode) vs an open one. A mid-run connection outage is
		// invisible here — the subscription has no disconnect callback and the
		// client resumes it transparently — and is reported by the subscriber's
		// connection-status metric instead.
		n.observeLiveSubscription(false)
		defer n.observeLiveSubscription(false)
		subject := resourcewatch.Subject(n.gvr, n.namespace)
		// Re-list on reconnect: a round-robin subscription can miss events
		// published while the connection was down, so reconcile from a fresh list.
		opts := []nats.SubscribeOption{nats.WithOnReconnect(n.signalReconnect)}
		if n.queueGroup != "" {
			opts = append(opts, nats.WithQueueGroup(n.queueGroup))
		}
		s, err := n.subscriber.Subscribe(ctx, subject, n.onNotification(), opts...)
		switch {
		case err == nil:
			sub = s
			n.observeLiveSubscription(true)
			n.log.Debug("opened nats informer", "subject", subject, "gvr", n.gvr.String())
		case n.degradedStart:
			n.log.Warn("nats informer: subscribe failed; starting in re-list-only degraded mode",
				"subject", subject, "gvr", n.gvr.String(), "error", err)
			go n.retrySubscribe(ctx, subject, opts)
		default:
			for {
				n.log.Warn("nats informer: subscribe failed, will retry", "subject", subject, "error", err)
				select {
				case <-ctx.Done():
					return
				case <-time.After(n.retryInterval):
				}
				s, err = n.subscriber.Subscribe(ctx, subject, n.onNotification(), opts...)
				if err == nil {
					sub = s
					n.observeLiveSubscription(true)
					n.log.Debug("opened nats informer", "subject", subject, "gvr", n.gvr.String())
					break
				}
			}
		}
	}

	// Seed the initial reconcile and report HasSynced, retrying until the first
	// list succeeds. HasSynced releases WaitForCacheSync, so marking it synced
	// after a failed list would start the controllers against an empty snapshot —
	// existing objects would go unreconciled and quota counts read as zero until
	// the next successful resync. A transient API error must therefore hold
	// HasSynced false and retry, mirroring a reflector's initial ListAndWatch.
	for {
		if err := n.relist(ctx, true); err == nil {
			break
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(n.retryInterval):
		}
	}
	n.synced.Store(true)
	close(n.syncedCh)

	// Jitter each interval independently so informers that started together do not
	// re-list in lockstep and stampede the API server. A fresh timer per pass
	// (rather than a fixed ticker) lets the delay vary every time.
	resync := time.NewTimer(wait.Jitter(n.resync, n.jitterFactor))
	defer resync.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-resync.C:
			// Re-arm before relisting so a slow LIST or handler dispatch is not
			// added to the interval; this keeps the cadence start-to-start (as the
			// ticker was) rather than relist-duration + resync. Reset is safe here
			// because the timer has already fired and C has been drained.
			resync.Reset(wait.Jitter(n.resync, n.jitterFactor))
			// Error already logged in relist; the next tick retries.
			_ = n.relist(ctx, false)
		case <-n.reconnect:
			n.log.Debug("nats reconnected; re-listing", "gvr", n.gvr.String())
			_ = n.relist(ctx, false)
		}
	}
}

// retrySubscribe keeps trying to open the live subscription while the informer
// runs in re-list-only degraded mode (see AllowDegradedStart). Once it opens,
// a reconnect signal forces a re-list to reconcile whatever was published while
// there was no subscription, and the goroutine holds the subscription until
// shutdown so its lifecycle needs no shared state with Run.
func (n *Informer) retrySubscribe(ctx context.Context, subject string, opts []nats.SubscribeOption) {
	// min == max pins the cadence to exactly retryInterval (no jitter, no
	// growth), matching the foreground subscribe retry in Run; MaxRetries 0
	// retries until ctx ends.
	boff := backoff.New(ctx, backoff.Config{
		MinBackoff: n.retryInterval,
		MaxBackoff: n.retryInterval,
	})
	for boff.Ongoing() {
		// Run just attempted the subscription, so wait before the first retry.
		boff.Wait()
		if !boff.Ongoing() {
			return
		}
		s, err := n.subscriber.Subscribe(ctx, subject, n.onNotification(), opts...)
		if err != nil {
			n.log.Warn("nats informer: subscribe failed, will retry", "subject", subject, "error", err)
			continue
		}
		n.observeLiveSubscription(true)
		n.log.Info("nats informer: subscription opened; leaving re-list-only degraded mode",
			"subject", subject, "gvr", n.gvr.String())
		n.signalReconnect()
		<-ctx.Done()
		if err := s.Unsubscribe(); err != nil {
			n.log.Debug("nats informer: unsubscribe", "error", err)
		}
		return
	}
}

// signalReconnect nudges the run loop to re-list after a NATS reconnect. It is
// the WithOnReconnect callback, so it must not block: the send is non-blocking
// and a pending signal coalesces additional reconnects into the next re-list.
func (n *Informer) signalReconnect() {
	if n.metrics != nil {
		n.metrics.ObserveReconnect()
	}
	select {
	case n.reconnect <- struct{}{}:
	default:
	}
}

// onNotification returns the NATS message handler. It builds a minimal object
// from the notification's identity and dispatches it — the controllers re-fetch
// in their reconcile, so no object read happens here. Malformed envelopes and
// unknown verbs are logged and skipped so one bad notification cannot stop
// delivery of the rest.
func (n *Informer) onNotification() nats.MessageHandler {
	return func(subject string, data []byte) {
		var evt resourcepb.WatchNotification
		if err := proto.Unmarshal(data, &evt); err != nil {
			n.log.Warn("dropping malformed nats notification", "subject", subject, "error", err)
			return
		}

		switch evt.Type {
		case resourcepb.WatchNotification_ADDED, resourcepb.WatchNotification_MODIFIED, resourcepb.WatchNotification_DELETED:
		default:
			n.log.Warn("dropping nats notification with unknown type", "subject", subject, "type", evt.Type)
			return
		}

		n.log.Debug("nats notification received", "subject", subject, "type", evt.Type, "namespace", evt.Namespace, "name", evt.Name, "rv", evt.ResourceVersion)

		obj := n.newObject(evt.Namespace, evt.Name)
		// The handlers key off namespace/name and re-fetch the object in their
		// reconcile, so the minimal object and old == new are both fine.
		switch evt.Type {
		case resourcepb.WatchNotification_ADDED:
			// Write the add through to the snapshot, the counterpart to the Delete
			// below: without it the object is absent until the next re-list, whose
			// diff would then re-report a delivered live add as a recovery — inflating
			// the relist metrics and re-dispatching OnAdd. MODIFIED is deliberately not
			// written through: it carries only namespace/name, so a soft-delete
			// (delivered as MODIFIED with a deletionTimestamp) would overwrite the
			// stored object's real deletionTimestamp with a nil one and mislead the
			// staleness-tolerant readers of the snapshot (the repository quota count).
			//
			// Stamp the notification's resource version onto the minimal object so
			// the store records it: a re-list whose snapshot predates this add must
			// carry the object forward rather than diff it as a spurious delete.
			setResourceVersion(obj, evt.ResourceVersion)
			n.store.Update(context.Background(), obj)
			n.observeLiveEvent(VerbAdd, evt.ResourceVersion)
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(obj, false) })
		case resourcepb.WatchNotification_DELETED:
			// A DELETED notification is published only once the object is actually
			// removed from storage; a delete that merely sets a deletionTimestamp is an
			// update, delivered as MODIFIED (and that is where finalizers run). So by
			// the time DELETED arrives the object is gone and a re-fetch can only 404.
			// Deliver it as OnDelete — the standard delete signal handlers already
			// ignore or key off — rather than OnUpdate: a re-fetching controller would
			// otherwise enqueue a key whose only possible outcome is a spurious "not
			// found" reconcile error. Drop it from the snapshot too, so a
			// staleness-tolerant reader (e.g. a quota count) stops counting it without
			// waiting for the next re-list.
			n.store.DeleteAt(context.Background(), evt.Namespace, evt.Name, evt.ResourceVersion)
			n.observeLiveEvent(VerbDelete, evt.ResourceVersion)
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnDelete(obj) })
		default: // MODIFIED
			n.observeLiveEvent(VerbUpdate, evt.ResourceVersion)
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnUpdate(obj, obj) })
		}
	}
}

// relist reads the full set from the API and reconciles it against the previous
// snapshot, mirroring how a SharedInformer's reflector re-lists into DeltaFIFO:
//   - a key seen for the first time is delivered as an add, a key seen before as an
//     update. Preserving the add/update distinction matters: an add-only handler
//     (e.g. the provisioning job controller's AddFunc) must still wake for an object
//     first observed via a re-list — during the startup subscribe gap, or because the
//     live ADDED event was round-robined to another replica;
//   - objects that were in the previous snapshot but are gone now are delivered as
//     deletes, carrying the last-known object — this is how a hard delete (which no
//     live notification reliably reaches under round-robin delivery) is caught.
//
// On the initial list the store starts empty, so every object is an add (with
// isInInitialList=true) and there is nothing to delete.
func (n *Informer) relist(ctx context.Context, initial bool) error {
	objs, listRV, err := n.list(ctx)
	if err != nil {
		n.log.Warn("nats informer: list failed", "gvr", n.gvr.String(), "error", err)
		return err
	}

	// Swap the snapshot for the fresh set, reconciled at listRV against live
	// write-throughs that raced the LIST (see Store.Replace): added/updated/removed
	// are the keys to dispatch as adds/updates/deletes, with objects a live write
	// already delivered here filtered out.
	added, updated, removed := n.store.Replace(objs, listRV)
	n.log.Debug("nats informer re-listed", "gvr", n.gvr.String(), "initial", initial,
		"count", len(objs), "added", len(added), "updated", len(updated), "removed", len(removed))

	for _, obj := range added {
		o := obj
		// A key first seen on a periodic re-list is a change the live stream did
		// not deliver here, so its RV timestamp dates the recovery latency. The
		// initial list is not a recovery — its objects may be arbitrarily old — so
		// it carries no RV for latency.
		rv := int64(0)
		if !initial {
			rv = objectResourceVersion(o)
		}
		n.observeRelistEvent(VerbAdd, rv)
		n.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(o, initial) })
	}

	for _, obj := range updated {
		o := obj
		n.observeRelistEvent(VerbUpdate, 0)
		n.dispatch(func(h cache.ResourceEventHandler) { h.OnUpdate(o, o) })
	}

	for _, obj := range removed {
		o := obj
		n.observeRelistEvent(VerbDelete, 0)
		n.dispatch(func(h cache.ResourceEventHandler) { h.OnDelete(o) })
	}
	return nil
}

func (n *Informer) observeLiveEvent(verb string, rv int64) {
	if n.metrics != nil {
		n.metrics.ObserveLiveEvent(verb, rv)
	}
}

func (n *Informer) observeRelistEvent(verb string, rv int64) {
	if n.metrics != nil {
		n.metrics.ObserveRelistEvent(verb, rv)
	}
}

func (n *Informer) observeLiveSubscription(open bool) {
	if n.metrics != nil {
		n.metrics.ObserveLiveSubscription(open)
	}
}

// setResourceVersion stamps rv onto an object's metadata, so a minimal object
// built from a live notification carries the version the store keys its
// re-list reconciliation off. A non-meta object is left as-is.
func setResourceVersion(obj runtime.Object, rv int64) {
	if acc, err := meta.Accessor(obj); err == nil {
		acc.SetResourceVersion(strconv.FormatInt(rv, 10))
	}
}

// objectResourceVersion parses an object's resource version as the int64
// unified storage issues; 0 when absent or not numeric (no latency sample).
func objectResourceVersion(obj runtime.Object) int64 {
	acc, err := meta.Accessor(obj)
	if err != nil {
		return 0
	}
	rv, err := strconv.ParseInt(acc.GetResourceVersion(), 10, 64)
	if err != nil {
		return 0
	}
	return rv
}

func (n *Informer) dispatch(fn func(cache.ResourceEventHandler)) {
	n.mu.Lock()
	handlers := n.handlers
	n.mu.Unlock()
	for _, h := range handlers {
		fn(h)
	}
}
