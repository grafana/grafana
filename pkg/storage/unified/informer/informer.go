package informer

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// Metrics is an optional hook the informer calls to record event-delivery
// signals. It is deliberately transport-shaped rather than Prometheus-shaped so
// the storage layer carries no provisioning-specific metric names: the caller
// supplies an implementation that bakes in its own source label and turns a
// resource version into a latency. All methods must be safe to call from the
// informer's goroutines; a nil Metrics disables recording.
//
//   - ObserveLiveEvent   — a live notification arrived off the bus.
//   - ObserveRelistEvent — the periodic re-list reconciled an add/delete the live
//     stream did not deliver (initial reports the first list, whose "latency"
//     is object age, not delivery delay).
//   - ObserveReconnect   — the bus reconnected, a window in which live events may
//     have been missed (and are recovered on the following re-list).
//   - ObserveDrop        — a live notification was received but could not be
//     dispatched (reason: unmarshal_error, unknown_type).
//   - ObserveRelist      — a re-list completed successfully (trigger: initial,
//     resync, reconnect, periodic); marks the last-success time for staleness.
//   - ObserveRelistError — a re-list failed, so missed events are not yet healed.
type Metrics interface {
	ObserveLiveEvent(resource, verb string, rv int64)
	ObserveRelistEvent(resource, verb string, rv int64, initial bool)
	ObserveReconnect(resource string)
	ObserveDrop(resource, reason string)
	ObserveRelist(resource, trigger string)
	ObserveRelistError(resource string)
}

// Re-list triggers, used as the trigger label on relist metrics.
const (
	TriggerInitial   = "initial"
	TriggerResync    = "resync"
	TriggerReconnect = "reconnect"
	TriggerPeriodic  = "periodic"
)

// Drop reasons, used as the reason label on dropped-notification metrics.
const (
	DropUnmarshalError = "unmarshal_error"
	DropUnknownType    = "unknown_type"
)

// objectRV reads the resource version off an object's metadata as the int64 the
// latency helpers expect, returning 0 (which callers treat as "unknown, skip
// latency") when it is absent or unparseable.
func objectRV(obj runtime.Object) int64 {
	m, err := meta.Accessor(obj)
	if err != nil {
		return 0
	}
	rv, err := strconv.ParseInt(m.GetResourceVersion(), 10, 64)
	if err != nil {
		return 0
	}
	return rv
}

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
// API. The informer calls it once on start — to drive the initial reconcile and
// report HasSynced — and again on every resync interval to re-deliver the full
// set. The periodic re-list is what makes the informer correct despite
// round-robin delivery: an event routed to another replica, or a hard delete
// that is never announced, is reconciled on the next list.
type ListFunc func(ctx context.Context) ([]runtime.Object, error)

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

	// metrics records event-delivery signals; nil disables recording.
	metrics Metrics

	store Store

	// retryInterval is how often Run retries opening the live subscription while it
	// fails; defaults to defaultSubscribeRetry.
	retryInterval time.Duration

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
//
// metrics records event-delivery signals for dashboards; pass nil to disable.
func NewInformer(subscriber nats.Subscriber, gvr schema.GroupVersionResource, namespace string, resync time.Duration, queueGroup string, store Store, newObject ObjectFunc, list ListFunc, metrics Metrics) *Informer {
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
		metrics:       metrics,
		store:         store,
		retryInterval: defaultSubscribeRetry,
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
// reports HasSynced — while it still cannot watch the resource. Register handlers
// before calling Run.
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
	// URL — keep retrying and do NOT list or report HasSynced: re-listing a
	// resource we cannot watch would start the controller against a snapshot with
	// no live updates until the next resync. A nil newObject or a disabled
	// subscriber means the informer is re-list-only, so there is no subscription
	// to wait for.
	if n.newObject != nil && nats.Enabled(n.subscriber) {
		subject := resourcewatch.Subject(n.gvr, n.namespace)
		// Re-list on reconnect: a round-robin subscription can miss events
		// published while the connection was down, so reconcile from a fresh list.
		opts := []nats.SubscribeOption{nats.WithOnReconnect(n.signalReconnect)}
		if n.queueGroup != "" {
			opts = append(opts, nats.WithQueueGroup(n.queueGroup))
		}
		for {
			s, err := n.subscriber.Subscribe(ctx, subject, n.onNotification(), opts...)
			if err == nil {
				sub = s
				n.log.Debug("opened nats informer", "subject", subject, "gvr", n.gvr.String())
				break
			}
			n.log.Warn("nats informer: subscribe failed, will retry", "subject", subject, "error", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(n.retryInterval):
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
		if err := n.relist(ctx, TriggerInitial); err == nil {
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

	resync := time.NewTicker(n.resync)
	defer resync.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-resync.C:
			// Error already logged in relist; the next tick retries.
			_ = n.relist(ctx, TriggerResync)
		case <-n.reconnect:
			n.log.Debug("nats reconnected; re-listing", "gvr", n.gvr.String())
			_ = n.relist(ctx, TriggerReconnect)
		}
	}
}

// signalReconnect nudges the run loop to re-list after a NATS reconnect. It is
// the WithOnReconnect callback, so it must not block: the send is non-blocking
// and a pending signal coalesces additional reconnects into the next re-list.
func (n *Informer) signalReconnect() {
	if n.metrics != nil {
		n.metrics.ObserveReconnect(n.gvr.Resource)
	}
	select {
	case n.reconnect <- struct{}{}:
	default:
	}
}

// notificationVerb maps a wire notification type onto the metric verb label.
func notificationVerb(t resourcepb.WatchNotification_Type) string {
	switch t {
	case resourcepb.WatchNotification_ADDED:
		return "add"
	case resourcepb.WatchNotification_MODIFIED:
		return "update"
	case resourcepb.WatchNotification_DELETED:
		return "delete"
	default:
		return "unknown"
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
			if n.metrics != nil {
				n.metrics.ObserveDrop(n.gvr.Resource, DropUnmarshalError)
			}
			return
		}

		switch evt.Type {
		case resourcepb.WatchNotification_ADDED, resourcepb.WatchNotification_MODIFIED, resourcepb.WatchNotification_DELETED:
		default:
			n.log.Warn("dropping nats notification with unknown type", "subject", subject, "type", evt.Type)
			if n.metrics != nil {
				n.metrics.ObserveDrop(n.gvr.Resource, DropUnknownType)
			}
			return
		}

		n.log.Debug("nats notification received", "subject", subject, "type", evt.Type, "namespace", evt.Namespace, "name", evt.Name, "rv", evt.ResourceVersion)

		if n.metrics != nil {
			n.metrics.ObserveLiveEvent(n.gvr.Resource, notificationVerb(evt.Type), evt.ResourceVersion)
		}

		obj := n.newObject(evt.Namespace, evt.Name)
		// ADDED becomes OnAdd; everything else (MODIFIED, or a DELETED whose object
		// may still exist mid-finalization) becomes OnUpdate. The handlers key off
		// namespace/name and re-fetch in their reconcile, so old == new is fine and
		// a delete just enqueues a key whose GET will 404 and be handled there.
		if evt.Type == resourcepb.WatchNotification_ADDED {
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(obj, false) })
			return
		}
		n.dispatch(func(h cache.ResourceEventHandler) { h.OnUpdate(obj, obj) })
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
// isInInitialList=true) and there is nothing to delete. trigger labels what
// caused the re-list (initial, resync, reconnect) on the relist metrics.
func (n *Informer) relist(ctx context.Context, trigger string) error {
	initial := trigger == TriggerInitial
	objs, err := n.list(ctx)
	if err != nil {
		n.log.Warn("nats informer: list failed", "gvr", n.gvr.String(), "error", err)
		if n.metrics != nil {
			n.metrics.ObserveRelistError(n.gvr.Resource)
		}
		return err
	}

	// Swap the snapshot for the fresh set; added/removed are the keys that appeared
	// and vanished since the previous re-list.
	added, removed := n.store.Replace(objs)
	n.log.Debug("nats informer re-listed", "gvr", n.gvr.String(), "initial", initial,
		"count", len(objs), "added", len(added), "removed", len(removed))
	addedKeys := make(map[string]struct{}, len(added))
	for _, obj := range added {
		if key, err := cache.MetaNamespaceKeyFunc(obj); err == nil {
			addedKeys[key] = struct{}{}
		}
	}

	for _, obj := range objs {
		o := obj
		key, _ := cache.MetaNamespaceKeyFunc(o)
		if _, isNew := addedKeys[key]; isNew {
			// An add the re-list surfaced that the live stream did not deliver
			// (routed elsewhere under round-robin, or a hard-missed event); the
			// unchanged updates are periodic re-delivery, not events, so only the
			// reconciled add/delete set is recorded.
			if n.metrics != nil {
				n.metrics.ObserveRelistEvent(n.gvr.Resource, "add", objectRV(o), initial)
			}
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(o, initial) })
		} else {
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnUpdate(o, o) })
		}
	}

	for _, obj := range removed {
		o := obj
		if n.metrics != nil {
			n.metrics.ObserveRelistEvent(n.gvr.Resource, "delete", objectRV(o), initial)
		}
		n.dispatch(func(h cache.ResourceEventHandler) { h.OnDelete(o) })
	}
	if n.metrics != nil {
		n.metrics.ObserveRelist(n.gvr.Resource, trigger)
	}
	return nil
}

func (n *Informer) dispatch(fn func(cache.ResourceEventHandler)) {
	n.mu.Lock()
	handlers := n.handlers
	n.mu.Unlock()
	for _, h := range handlers {
		fn(h)
	}
}
