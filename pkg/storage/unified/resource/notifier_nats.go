package resource

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// Subscription handle; Unsubscribe stops delivery. Matches infra/nats.Subscription.
type Subscription interface {
	Unsubscribe() error
}

// EventSubscriber is the read-side counterpart of EventPublisher: it delivers
// change notifications from the external bus (NATS) to handler as raw
// (subject, data), keeping nats.go types out of this package.
type EventSubscriber interface {
	Enabled() bool
	Subscribe(ctx context.Context, subject string, handler func(subject string, data []byte)) (Subscription, error)
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
// recovery relies on consumers relisting (reflector resync, provisioning
// relist). Core NATS also delivers in arrival order, not RV order, so Watch runs
// arrivals through the same settle buffer as the channel notifier (held for
// SettleDelay, emitted sorted by RV) to keep downstream RVs monotonic.
//
// A failed subscription (e.g. the bus is not reachable yet at startup) is
// retried in the background with exponential backoff bounded by the watch's
// MinBackoff/MaxBackoff.
type natsNotifier struct {
	subscriber EventSubscriber
	dropped    *prometheus.CounterVec // by reason; nil is allowed (no accounting)
	log        log.Logger
}

const (
	dropReasonBufferFull     = "buffer_full"
	dropReasonUnmarshalError = "unmarshal_error"
	dropReasonUnknownType    = "unknown_type"
)

var dropReasons = []string{dropReasonBufferFull, dropReasonUnmarshalError, dropReasonUnknownType}

func newNatsNotifier(subscriber EventSubscriber, dropped *prometheus.CounterVec, logger log.Logger) *natsNotifier {
	if dropped != nil {
		for _, r := range dropReasons {
			dropped.WithLabelValues(r)
		}
	}
	return &natsNotifier{
		subscriber: subscriber,
		dropped:    dropped,
		log:        logger,
	}
}

func (n *natsNotifier) drop(reason string) {
	if n.dropped != nil {
		n.dropped.WithLabelValues(reason).Inc()
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
			n.drop(dropReasonBufferFull)
			n.log.Warn("dropped watch notification, channel full", "subject", subject)
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
					return
				}
			}
		}()
	}

	return out
}

// trySubscribe subscribes to the whole change stream once. On success it
// unsubscribes on ctx cancel and returns true; on failure it logs and returns
// false so the caller can retry.
func (n *natsNotifier) trySubscribe(ctx context.Context, handler func(subject string, data []byte)) bool {
	sub, err := n.subscriber.Subscribe(ctx, resourcewatch.SubjectAllResources, handler)
	if err != nil {
		n.log.Error("failed to subscribe to nats, will retry", "error", err)
		return false
	}
	n.log.Info("subscribed to nats watch stream")
	context.AfterFunc(ctx, func() {
		if err := sub.Unsubscribe(); err != nil {
			n.log.Warn("failed to unsubscribe from nats", "error", err)
		}
	})
	return true
}

// decode turns a raw notification into an Event, returning ok=false (and
// accounting the drop) for undecodable payloads or unknown types.
func (n *natsNotifier) decode(subject string, data []byte) (Event, bool) {
	var notification resourcepb.WatchNotification
	if err := proto.Unmarshal(data, &notification); err != nil {
		n.drop(dropReasonUnmarshalError)
		n.log.Warn("failed to unmarshal watch notification", "subject", subject, "error", err)
		return Event{}, false
	}
	action, ok := watchNotificationTypeToAction(notification.Type)
	if !ok {
		n.drop(dropReasonUnknownType)
		n.log.Warn("dropped watch notification with unknown type", "subject", subject)
		return Event{}, false
	}
	return Event{
		Namespace:       notification.Namespace,
		Group:           notification.Group,
		Resource:        notification.Resource,
		Name:            notification.Name,
		ResourceVersion: notification.ResourceVersion,
		Action:          action,
		Folder:          notification.Folder,
		PreviousRV:      notification.PreviousResourceVersion,
	}, true
}

// TODO: currently the events are published to NATS in watch_publisher.go,
// but we need refactor to publish them here in the notifier,
// once we have a single notifier implementation (natsNotifier) and remove the pollingNotifier.
func (n *natsNotifier) Publish(_ Event) {}
