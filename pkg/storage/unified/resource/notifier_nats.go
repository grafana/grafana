package resource

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// Subscription matches infra/nats.Subscription.
type Subscription interface {
	// WaitReady must succeed before relying on delivery for a snapshot-to-live
	// handoff. The context must have a deadline.
	WaitReady(ctx context.Context) error
	Unsubscribe() error
}

// EventSubscriber is the read-side counterpart of EventPublisher: it delivers
// change notifications from the external bus (NATS) to handler as raw
// (subject, data), keeping nats.go types out of this package.
type EventSubscriber interface {
	Enabled() bool
	// onReconnect reports reconnection, never the initial connection. WaitReady
	// confirms that restored subscription interest has reached the server.
	// It must not block and is unregistered when the subscription is released.
	Subscribe(ctx context.Context, subject string, handler func(subject string, data []byte), onReconnect func()) (Subscription, error)
}

// watchNotificationTypeToAction maps a wire event type back to a data action.
// UNKNOWN reports ok=false so the caller drops it rather than emit a bogus change.
func watchNotificationTypeToAction(t resourcepb.WatchNotification_Type) (kv.DataAction, bool) {
	switch t {
	case resourcepb.WatchNotification_ADDED:
		return DataActionCreated, true
	case resourcepb.WatchNotification_MODIFIED:
		return DataActionUpdated, true
	case resourcepb.WatchNotification_DELETED:
		return DataActionDeleted, true
	default:
		return "", false
	}
}

// natsNotifier emits an Event per WatchNotification received from NATS rather
// than by polling the store. Watch subscribes to the whole resource change
// stream (SubjectAllResources) and ignores the resource selectors in
// WatchOptions, so it is not a drop-in per-watch notifier. PreviousRV is carried
// on the wire, matching the store-sourced notifiers.
//
// Delivery is at-most-once (core NATS, no JetStream): a missed message is never
// redelivered, and there is no server-side polling backstop when this is the
// selected notifier (newNotifier returns this OR polling, never both), so
// recovery invalidates existing watches on reconnect so consumers re-list.
// Core NATS also delivers in arrival order, not RV order, so Watch runs
// arrivals through the same settle buffer as the channel notifier (held for
// SettleDelay, emitted sorted by RV) to keep downstream RVs monotonic.
//
// A failed subscription (e.g. the bus is not reachable yet at startup) is
// retried in the background with exponential backoff bounded by the watch's
// MinBackoff/MaxBackoff.
type natsNotifier struct {
	subscriber  EventSubscriber
	invalidator Invalidator
	dropped     *prometheus.CounterVec // by reason; nil is allowed (no accounting)
	dropLog     *throttledLog
	log         logging.Logger
}

const (
	dropReasonBufferFull     = "buffer_full"
	dropReasonUnmarshalError = "unmarshal_error"
	dropReasonUnknownType    = "unknown_type"
)

// dropLogInterval throttles the per-reason drop warning. The handler runs on the
// bus dispatch goroutine, which delivers a subscription's messages one at a
// time, so a line per dropped message during a storm slows delivery enough to
// cause further drops. The dropped counter stays exact.
const dropLogInterval = 10 * time.Second

var dropReasons = []string{dropReasonBufferFull, dropReasonUnmarshalError, dropReasonUnknownType}

func newNatsNotifier(subscriber EventSubscriber, invalidator Invalidator, dropped *prometheus.CounterVec, logger logging.Logger) *natsNotifier {
	if dropped != nil {
		for _, r := range dropReasons {
			dropped.WithLabelValues(r)
		}
	}
	return &natsNotifier{
		subscriber:  subscriber,
		invalidator: invalidator,
		dropped:     dropped,
		dropLog:     newThrottledLog(dropLogInterval),
		log:         logger,
	}
}

// throttledLog reports whether a warning should be emitted for a key, and how
// many were suppressed since the previous one so a throttled line still conveys
// volume. Keys are throttled independently: a storm on one reason must not hide
// the first occurrence of another.
type throttledLog struct {
	interval time.Duration

	mu    sync.Mutex
	state map[string]*throttleState
}

type throttleState struct {
	last       time.Time
	suppressed int64
}

func newThrottledLog(interval time.Duration) *throttledLog {
	return &throttledLog{interval: interval, state: make(map[string]*throttleState)}
}

func (t *throttledLog) next(key string) (suppressed int64, ok bool) {
	t.mu.Lock()
	defer t.mu.Unlock()

	s := t.state[key]
	if s == nil {
		s = &throttleState{}
		t.state[key] = s
	}

	now := time.Now()
	if !s.last.IsZero() && now.Sub(s.last) < t.interval {
		s.suppressed++
		return 0, false
	}
	suppressed, s.suppressed, s.last = s.suppressed, 0, now
	return suppressed, true
}

// drop accounts a dropped notification and logs at most one line per reason per
// dropLogInterval.
func (n *natsNotifier) drop(reason, msg string, logCtx ...any) {
	if n.dropped != nil {
		n.dropped.WithLabelValues(reason).Inc()
	}
	if suppressed, ok := n.dropLog.next(reason); ok {
		n.log.Warn(msg, append(logCtx, "suppressed_since_last_log", suppressed)...)
	}
}

func (n *natsNotifier) Watch(ctx context.Context, opts WatchOptions) <-chan Event {
	opts = opts.normalize()
	n.log.Info("creating new nats notifier", "buffer_size", opts.BufferSize)

	// The callback writes raw; settleEvents owns and closes out on ctx cancel.
	// It runs for the whole watch, so retrying a failed subscription does not
	// tear down the consumer's channel. raw is never closed, so a late callback
	// can't send on a closed channel.
	raw := make(chan Event, opts.BufferSize)
	out := make(chan Event, opts.BufferSize)
	go settleEvents(ctx, raw, out, opts)

	handler := func(subject string, data []byte) {
		evt, ok := n.decode(subject, data)
		if !ok {
			return
		}
		select {
		case raw <- evt:
		default:
			n.drop(dropReasonBufferFull, "dropped watch notification, channel full", "subject", subject)
		}
	}

	// Subscribe synchronously so a healthy bus wires delivery before returning;
	// if the bus is unreachable (e.g. embedded server not started yet), retry in
	// the background instead of closing out and losing the watch until restart.
	// Once subscribed, the nats client auto-resumes across reconnects.
	if !n.trySubscribe(ctx, handler) {
		go func() {
			bo := backoff.New(ctx, backoff.Config{
				MinBackoff: opts.MinBackoff,
				MaxBackoff: opts.MaxBackoff,
				MaxRetries: 0, // infinite retries; ctx cancel stops the loop
			})
			for bo.Ongoing() {
				bo.Wait()
				if n.trySubscribe(ctx, handler) {
					if ctx.Err() != nil {
						return
					}
					// Watches may have opened while capture was unavailable. The first
					// successful connection does not necessarily emit a reconnect callback.
					n.invalidate()
					opts.captured(nil)
					return
				}
			}
		}()
	} else {
		opts.captured(nil)
	}

	return out
}

// trySubscribe subscribes to the whole change stream once. On success it
// unsubscribes on ctx cancel and returns true; on failure it logs and returns
// false so the caller can retry.
func (n *natsNotifier) trySubscribe(ctx context.Context, handler func(subject string, data []byte)) bool {
	reconnected := make(chan struct{}, 1)
	sub, err := n.subscriber.Subscribe(ctx, resourcewatch.SubjectAllResources, handler, func() {
		select {
		case reconnected <- struct{}{}:
		default:
		}
	})
	if err != nil {
		n.log.Error("failed to subscribe to nats, will retry", "error", err)
		return false
	}
	// The bus can accept SUB locally while disconnected. Wait for its
	// round-trip acknowledgment before declaring live capture ready.
	readyCtx, cancel := context.WithTimeout(ctx, defaultMaxBackoff)
	err = sub.WaitReady(readyCtx)
	cancel()
	if err != nil {
		_ = sub.Unsubscribe()
		n.log.Error("nats watch capture not ready, will retry", "error", err)
		return false
	}
	// NATS invokes reconnect callbacks before its final subscription flush is
	// acknowledged. Keep the old generation until restored capture is ready so
	// watches started during restoration also expire. This runs independently of
	// event delivery; repeated reconnect signals can safely coalesce.
	go reportReconnects(ctx, []Subscription{sub}, reconnected, n.invalidate)
	n.log.Info("subscribed to nats watch stream")
	context.AfterFunc(ctx, func() {
		if err := sub.Unsubscribe(); err != nil {
			n.log.Warn("failed to unsubscribe from nats", "error", err)
		}
	})
	return true
}

// invalidate expires the watches that may have missed events, so their clients
// list again.
func (n *natsNotifier) invalidate() {
	if n.invalidator != nil {
		n.invalidator.Invalidate()
	}
}

// decode turns a raw notification into an Event, returning ok=false (and
// accounting the drop) for undecodable payloads or unknown types.
func (n *natsNotifier) decode(subject string, data []byte) (Event, bool) {
	var notification resourcepb.WatchNotification
	if err := proto.Unmarshal(data, &notification); err != nil {
		n.drop(dropReasonUnmarshalError, "failed to unmarshal watch notification", "subject", subject, "error", err)
		return Event{}, false
	}
	action, ok := watchNotificationTypeToAction(notification.Type)
	if !ok {
		n.drop(dropReasonUnknownType, "dropped watch notification with unknown type", "subject", subject)
		return Event{}, false
	}
	// Older publishers omit previous metadata; keep those live events deliverable.
	previousAction, _ := watchNotificationTypeToAction(notification.PreviousType)
	return Event{
		Namespace:       notification.Namespace,
		Group:           notification.Group,
		Resource:        notification.Resource,
		Name:            notification.Name,
		ResourceVersion: notification.ResourceVersion,
		Action:          action,
		Folder:          notification.Folder,
		PreviousRV:      notification.PreviousResourceVersion,
		PreviousAction:  previousAction,
		PreviousFolder:  notification.PreviousFolder,
	}, true
}

// TODO: currently the events are published to NATS in watch_publisher.go,
// but we need refactor to publish them here in the notifier,
// once we have a single notifier implementation (natsNotifier) and remove the pollingNotifier.
func (n *natsNotifier) Publish(_ Event) {}

// ErrWrittenKeysUnsupported is returned by WatchWrittenKeys from a backend, or a
// configuration, that cannot report written keys.
var ErrWrittenKeysUnsupported = errors.New("watching written keys needs the KV backend with the NATS subscriber ([nats] enabled, with notifier or notifier_shadow)")

// writtenKeysBufferSize is how many keys can wait for the consumer before more
// are dropped.
const writtenKeysBufferSize = 10000

// WatchWrittenKeys subscribes to NATS directly, one subscription per type, so
// other types' notifications are never received.
func (k *kvStorageBackend) WatchWrittenKeys(ctx context.Context, types []schema.GroupResource, onReconnect func()) (<-chan *resourcepb.ResourceKey, error) {
	if k.eventSubscriber == nil || !k.eventSubscriber.Enabled() {
		return nil, ErrWrittenKeysUnsupported
	}

	keys := make(chan *resourcepb.ResourceKey, writtenKeysBufferSize)
	dropLog := newThrottledLog(dropLogInterval)
	handler := func(subject string, data []byte) {
		var notification resourcepb.WatchNotification
		if err := proto.Unmarshal(data, &notification); err != nil {
			if _, ok := dropLog.next("unmarshal"); ok {
				k.log.Warn("failed to unmarshal a watch notification for written keys", "subject", subject, "error", err)
			}
			return
		}
		key := &resourcepb.ResourceKey{
			Namespace: notification.Namespace,
			Group:     notification.Group,
			Resource:  notification.Resource,
			Name:      notification.Name,
		}
		select {
		case keys <- key:
		default:
			if suppressed, ok := dropLog.next("full"); ok {
				k.log.Warn("dropped written keys, the consumer is not keeping up", "subject", subject, "alsoDropped", suppressed)
			}
		}
	}

	// Every subscription reports a reconnect. They are combined into one signal,
	// so reconnects close together usually give one report rather than one per
	// type.
	reconnected := make(chan struct{}, 1)
	signal := func() {
		select {
		case reconnected <- struct{}{}:
		default:
		}
	}

	subs := make([]Subscription, 0, len(types))
	unsubscribe := func() {
		for _, sub := range subs {
			_ = sub.Unsubscribe()
		}
	}
	for _, gr := range types {
		subject := resourcewatch.Subject(schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource}, "")
		sub, err := k.eventSubscriber.Subscribe(ctx, subject, handler, signal)
		if err != nil {
			unsubscribe()
			return nil, err
		}
		subs = append(subs, sub)
	}
	// The bus can accept a subscription locally while disconnected, so wait for
	// the server to confirm before reporting that keys will be delivered.
	readyCtx, cancel := context.WithTimeout(ctx, defaultMaxBackoff)
	defer cancel()
	for _, sub := range subs {
		if err := sub.WaitReady(readyCtx); err != nil {
			unsubscribe()
			return nil, err
		}
	}
	context.AfterFunc(ctx, unsubscribe)
	go reportReconnects(ctx, subs, reconnected, onReconnect)
	return keys, nil
}

// reportReconnects calls onReconnect once all subscriptions are confirmed
// restored after a reconnect. Called earlier, a write made before the server
// restored a subscription would be missed by both the bus and whatever
// onReconnect starts.
func reportReconnects(ctx context.Context, subs []Subscription, reconnected <-chan struct{}, onReconnect func()) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-reconnected:
		}
		bo := backoff.New(ctx, backoff.Config{MinBackoff: defaultMinBackoff, MaxBackoff: defaultMaxBackoff})
		for bo.Ongoing() {
			if allReady(ctx, subs) {
				onReconnect()
				break
			}
			// A failed acknowledgment does not guarantee another reconnect
			// callback, so keep trying until it succeeds.
			bo.Wait()
		}
	}
}

func allReady(ctx context.Context, subs []Subscription) bool {
	readyCtx, cancel := context.WithTimeout(ctx, defaultMaxBackoff)
	defer cancel()
	for _, sub := range subs {
		if sub.WaitReady(readyCtx) != nil {
			return false
		}
	}
	return ctx.Err() == nil
}
