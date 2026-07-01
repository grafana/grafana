package informer

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
// directly instead of re-fetching (see NewHistoricJobInformer).
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
	return &Informer{
		subscriber: subscriber,
		gvr:        gvr,
		namespace:  namespace,
		resync:     resync,
		queueGroup: queueGroup,
		newObject:  newObject,
		list:       list,
		log:        log.New("provisioning.informer.nats"),
		store:      store,
		syncedCh:   make(chan struct{}),
		reconnect:  make(chan struct{}, 1),
	}
}

// AddEventHandler registers a handler to receive add/update/delete deltas,
// mirroring cache.SharedIndexInformer.AddEventHandler: it returns a registration
// whose HasSynced reports the informer's initial-list state, so callers wait on
// it with cache.WaitForCacheSync exactly as they would an apiserver informer's.
// Register all handlers before Start; there is no cache to replay, so a handler
// added after Start only sees events from the next notification or re-list.
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
	return syncedChecker{informer: r.informer}
}

type syncedChecker struct{ informer *Informer }

func (c syncedChecker) Name() string          { return "nats-informer:" + c.informer.gvr.String() }
func (c syncedChecker) Done() <-chan struct{} { return c.informer.syncedCh }

// Run delivers events to the registered handlers until stopCh is closed,
// mirroring cache.SharedIndexInformer.Run: it blocks, so start it with
// `go informer.Run(stopCh)`. It subscribes to the resource's NATS subject
// (unless live notifications are disabled), performs the initial list (marking
// HasSynced), then serves live notifications and a periodic re-list. Register
// handlers before calling Run.
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

	if n.newObject != nil {
		subject := resourcewatch.Subject(n.gvr, n.namespace)
		// Re-list on reconnect: a round-robin subscription can miss events
		// published while the connection was down, so reconcile from a fresh list.
		opts := []nats.SubscribeOption{nats.WithOnReconnect(n.signalReconnect)}
		if n.queueGroup != "" {
			opts = append(opts, nats.WithQueueGroup(n.queueGroup))
		}
		sub, err := n.subscriber.Subscribe(ctx, subject, n.onNotification(), opts...)
		if err != nil {
			n.log.Error("nats informer: subscribe failed", "subject", subject, "error", err)
			return
		}
		defer func() {
			if err := sub.Unsubscribe(); err != nil {
				n.log.Debug("nats informer: unsubscribe", "error", err)
			}
		}()
		n.log.Debug("opened nats informer", "subject", subject, "gvr", n.gvr.String())
	}

	// Seed the initial reconcile from the API before serving live events, then
	// report HasSynced so the controller can start once its handler has processed
	// the full set — the same contract as an informer's LIST-seeded cache.
	n.relist(ctx, true)
	n.synced.Store(true)
	close(n.syncedCh)

	ticker := time.NewTicker(n.resync)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n.relist(ctx, false)
		case <-n.reconnect:
			n.log.Debug("nats reconnected; re-listing", "gvr", n.gvr.String())
			n.relist(ctx, false)
		}
	}
}

// signalReconnect nudges the run loop to re-list after a NATS reconnect. It is
// the WithOnReconnect callback, so it must not block: the send is non-blocking
// and a pending signal coalesces additional reconnects into the next re-list.
func (n *Informer) signalReconnect() {
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
//   - objects present now are delivered as adds (initial list) or updates (resync),
//     which replays state to handlers and heals events NATS routed to other replicas;
//   - objects that were in the previous snapshot but are gone now are delivered as
//     deletes, carrying the last-known object — this is how a hard delete (which no
//     live notification reliably reaches under round-robin delivery) is caught.
func (n *Informer) relist(ctx context.Context, initial bool) {
	objs, err := n.list(ctx)
	if err != nil {
		n.log.Warn("nats informer: list failed", "gvr", n.gvr.String(), "error", err)
		return
	}

	// Swap the snapshot for the fresh set; removed is the objects that vanished
	// since the previous re-list, with their last-known state.
	removed := n.store.Replace(objs)

	for _, obj := range objs {
		o := obj
		if initial {
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(o, true) })
		} else {
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnUpdate(o, o) })
		}
	}

	// Emit a delete for every vanished object. Skipped on the initial list, which
	// has nothing to diff against (the store started empty).
	if initial {
		return
	}
	for _, obj := range removed {
		o := obj
		n.dispatch(func(h cache.ResourceEventHandler) { h.OnDelete(o) })
	}
}

func (n *Informer) dispatch(fn func(cache.ResourceEventHandler)) {
	n.mu.Lock()
	handlers := n.handlers
	n.mu.Unlock()
	for _, h := range handlers {
		fn(h)
	}
}
