package informer

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
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
// directly instead of re-fetching.
type ObjectFunc func(namespace, name string) runtime.Object

// ListFunc returns every object of one resource kind, read straight from the
// API. The informer calls it once on start — to drive the initial reconcile and
// report HasSynced — and again on every resync interval to re-deliver the full
// set. The periodic re-list is what makes the informer correct despite
// round-robin delivery: an event routed to another replica, or a hard delete
// that is never announced, is reconciled on the next list.
type ListFunc func(ctx context.Context) ([]runtime.Object, error)

// GetFunc reads a single object of one resource kind from the API. When set (via
// WithGet), the informer "warms" a live notification: it fetches the object,
// validates it against the notification's identity/freshness, writes it into the
// Store, and only then dispatches — so a handler reconciling against the Store
// reads a present, current object rather than racing an as-yet-invisible write.
// A nil GetFunc keeps the signal-only behavior (dispatch a stub, no fetch).
type GetFunc func(ctx context.Context, namespace, name string) (runtime.Object, error)

// Option configures an Informer at construction. See WithGet.
type Option func(*Informer)

// WithGet enables fetch-before-dispatch warming: the informer reads and
// validates each live-notified object into the Store before dispatching. Pass it
// together with a Store that the controller's read seam also reads, so the
// Store is the authoritative source for the reconcile.
func WithGet(get GetFunc) Option {
	return func(n *Informer) { n.get = get }
}

// defaultResync is the fallback re-list cadence when a caller passes a
// non-positive interval.
const defaultResync = 5 * time.Minute

// defaultSubscribeRetry is how often Run retries opening the live subscription
// while it is unavailable — most commonly at startup, when the embedded NATS
// server is still starting and has no client URL yet.
const defaultSubscribeRetry = 5 * time.Second

// defaultWarmBackoff is the bounded, increasing delay between fetch retries when
// a live-notified object is not visible yet (a read-after-write race). The reads
// are direct API GETs, so the window is short; an object still missing after the
// full schedule (~2.6s) is left for the next re-list rather than retried harder.
var defaultWarmBackoff = []time.Duration{
	100 * time.Millisecond,
	500 * time.Millisecond,
	2 * time.Second,
}

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

	// reconnect signals the run loop to re-list after a NATS reconnect, since a
	// round-robin subscription can miss events published while it was down.
	// Buffered depth 1 and a non-blocking send coalesce bursts into one re-list.
	reconnect chan struct{}

	mu       sync.Mutex
	handlers []cache.ResourceEventHandler
	synced   atomic.Bool
	syncedCh chan struct{} // closed once the initial list completes

	// get, when non-nil, enables fetch-before-dispatch warming (see WithGet).
	get GetFunc
	// warmBackoff is the retry schedule for a not-yet-visible warm fetch;
	// a field so tests can shrink it. Defaults to defaultWarmBackoff.
	warmBackoff []time.Duration
	// warmMu guards the warming coalescing state below.
	warmMu sync.Mutex
	// warmLatest holds the most recent pending notification per key; a running
	// warm goroutine re-reads it so a newer event supersedes an in-flight fetch.
	warmLatest map[string]*resourcepb.WatchNotification
	// warmActive marks keys with a warm goroutine running, so at most one runs
	// per key (coalescing a burst of events for the same object into one fetch).
	warmActive map[string]bool
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
func NewInformer(subscriber nats.Subscriber, gvr schema.GroupVersionResource, namespace string, resync time.Duration, queueGroup string, store Store, newObject ObjectFunc, list ListFunc, opts ...Option) *Informer {
	if resync <= 0 {
		resync = defaultResync
	}
	// An unshared informer needs no external store; default one so Run never nil-panics.
	if store == nil {
		store = NewStore()
	}
	n := &Informer{
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
		syncedCh:      make(chan struct{}),
		reconnect:     make(chan struct{}, 1),
		warmBackoff:   defaultWarmBackoff,
		warmLatest:    map[string]*resourcepb.WatchNotification{},
		warmActive:    map[string]bool{},
	}
	for _, opt := range opts {
		opt(n)
	}
	return n
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
			s, err := n.subscriber.Subscribe(ctx, subject, n.onNotification(ctx), opts...)
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

	resync := time.NewTicker(n.resync)
	defer resync.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-resync.C:
			// Error already logged in relist; the next tick retries.
			_ = n.relist(ctx, false)
		case <-n.reconnect:
			n.log.Debug("nats reconnected; re-listing", "gvr", n.gvr.String())
			_ = n.relist(ctx, false)
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

// onNotification returns the NATS message handler. Malformed envelopes and
// unknown verbs are logged and skipped so one bad notification cannot stop
// delivery of the rest.
//
// Without a GetFunc it dispatches a minimal stub built from the notification's
// identity — the signal-only mode, where the controller re-fetches in its
// reconcile. With a GetFunc it warms instead: the object is fetched, validated,
// and written to the Store off the delivery goroutine (see warm), so a handler
// reconciling against the Store sees a present, current object.
func (n *Informer) onNotification(ctx context.Context) nats.MessageHandler {
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

		n.log.Debug("nats notification received", "subject", subject, "type", evt.Type, "namespace", evt.Namespace, "name", evt.Name, "rv", evt.ResourceVersion, "generation", evt.Generation)

		if n.get == nil {
			n.dispatchStub(&evt)
			return
		}

		// Warming: coalesce by key and fetch off this delivery goroutine so a slow
		// read never blocks delivery of the other notifications. At most one warm
		// goroutine runs per key; a burst for the same object collapses onto the
		// latest event.
		key := storeKey(evt.Namespace, evt.Name)
		n.warmMu.Lock()
		n.warmLatest[key] = &evt
		if n.warmActive[key] {
			n.warmMu.Unlock()
			return
		}
		n.warmActive[key] = true
		n.warmMu.Unlock()
		go n.warm(ctx, key)
	}
}

// dispatchStub delivers a minimal identity-only object for a notification: OnAdd
// for a create, OnUpdate for everything else (a MODIFIED, or a DELETED whose
// object may still exist mid-finalization). Used in signal-only mode, and for
// the delete wake-up in warming mode (the object has already been removed from
// the Store, so the reconcile reads it gone).
func (n *Informer) dispatchStub(evt *resourcepb.WatchNotification) {
	obj := n.newObject(evt.Namespace, evt.Name)
	n.dispatchByType(evt.Type, obj)
}

// dispatchByType delivers obj as an add (for a create) or an update (otherwise).
func (n *Informer) dispatchByType(t resourcepb.WatchNotification_Type, obj runtime.Object) {
	if t == resourcepb.WatchNotification_ADDED {
		n.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(obj, false) })
		return
	}
	n.dispatch(func(h cache.ResourceEventHandler) { h.OnUpdate(obj, obj) })
}

// warm processes pending notifications for one key until none remain, then
// releases the key. It always acts on the latest pending event, so a newer
// notification that arrives while a fetch is in flight supersedes the older one.
func (n *Informer) warm(ctx context.Context, key string) {
	for {
		n.warmMu.Lock()
		evt := n.warmLatest[key]
		n.warmMu.Unlock()
		if evt == nil {
			return
		}

		n.warmOne(ctx, key, evt)

		n.warmMu.Lock()
		// If no newer event arrived while we worked, we are done with this key.
		if n.warmLatest[key] == evt {
			delete(n.warmLatest, key)
			delete(n.warmActive, key)
			n.warmMu.Unlock()
			return
		}
		n.warmMu.Unlock()
	}
}

// warmOne handles a single notification: on a delete it removes the object from
// the Store and wakes the handlers; on an upsert it fetches and validates the
// object (retrying briefly through the read-after-write window), writes it to the
// Store, then dispatches. It returns without dispatching when the object cannot
// be confirmed (never appears, or is a stale event for a superseded object
// lifetime) — the periodic re-list is the backstop for anything left behind.
func (n *Informer) warmOne(ctx context.Context, key string, evt *resourcepb.WatchNotification) {
	if evt.Type == resourcepb.WatchNotification_DELETED {
		// The object is gone (a soft delete arrives as MODIFIED with a
		// deletionTimestamp, so it takes the upsert path and stays readable for
		// finalizers). Drop it from the authoritative Store and wake the handlers;
		// the reconcile reads the Store, finds it absent, and no-ops.
		n.store.Delete(ctx, evt.Namespace, evt.Name)
		n.dispatchStub(evt)
		return
	}

	for attempt := 0; ; attempt++ {
		obj, err := n.get(ctx, evt.Namespace, evt.Name)
		switch {
		case apierrors.IsNotFound(err):
			// Read-after-write race: the write is not visible on this replica yet.
		case err != nil:
			n.log.Warn("nats informer: warm fetch failed", "gvr", n.gvr.String(), "key", key, "error", err)
		default:
			if done := n.acceptWarmObject(ctx, evt, obj); done {
				return
			}
			// Present but older than the event's generation: keep retrying for the
			// version the event announced.
		}

		if attempt >= len(n.warmBackoff) {
			n.log.Debug("nats informer: object not observed after warm retries; leaving for the next re-list", "gvr", n.gvr.String(), "key", key)
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(n.warmBackoff[attempt]):
		}
		// A newer event for this key means this one is stale; let warm re-drive it.
		n.warmMu.Lock()
		superseded := n.warmLatest[key] != evt
		n.warmMu.Unlock()
		if superseded {
			return
		}
	}
}

// acceptWarmObject validates a fetched object against the notification and, if it
// is the right object at (or past) the announced generation, writes it to the
// Store and dispatches. It reports done=true when no further retry is warranted:
// either the object was accepted, or the event is stale for a different object
// lifetime (UID mismatch). A false result means "present but not fresh enough,
// retry".
func (n *Informer) acceptWarmObject(ctx context.Context, evt *resourcepb.WatchNotification, obj runtime.Object) (done bool) {
	acc, err := meta.Accessor(obj)
	if err != nil {
		// Cannot validate freshness; accept it rather than spin.
		n.store.Update(ctx, obj)
		n.dispatchByType(evt.Type, obj)
		return true
	}
	if evt.Uid != "" && string(acc.GetUID()) != evt.Uid {
		// Same namespace/name, different object lifetime (a delete+recreate). This
		// event is for an object that no longer exists; its replacement is warmed by
		// its own notification. Ignore the stale event.
		n.log.Debug("nats informer: ignoring stale notification (uid mismatch)", "gvr", n.gvr.String(), "namespace", evt.Namespace, "name", evt.Name, "event_uid", evt.Uid, "object_uid", string(acc.GetUID()))
		return true
	}
	if acc.GetGeneration() < evt.Generation {
		return false // stale read of an update; retry for the newer generation
	}
	n.store.Update(ctx, obj)
	n.dispatchByType(evt.Type, obj)
	return true
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
	objs, err := n.list(ctx)
	if err != nil {
		n.log.Warn("nats informer: list failed", "gvr", n.gvr.String(), "error", err)
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
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(o, initial) })
		} else {
			n.dispatch(func(h cache.ResourceEventHandler) { h.OnUpdate(o, o) })
		}
	}

	for _, obj := range removed {
		o := obj
		n.dispatch(func(h cache.ResourceEventHandler) { h.OnDelete(o) })
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
