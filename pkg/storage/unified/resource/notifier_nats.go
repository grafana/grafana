package resource

import (
	"context"

	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// Subscription is a handle to an active external-bus subscription; Unsubscribe
// stops delivery. Its method set matches infra/nats.Subscription.
type Subscription interface {
	Unsubscribe() error
}

// EventSubscriber consumes resource change notifications from an external
// message bus (NATS). It is the read-side counterpart of EventPublisher: the
// publisher announces committed writes, the subscriber receives them on another
// process. The handler is invoked once per delivered message with the raw
// (subject, data) so callers never touch nats.go types.
type EventSubscriber interface {
	Enabled() bool
	Subscribe(ctx context.Context, subject string, handler func(subject string, data []byte)) (Subscription, error)
}

// watchNotificationTypeToAction reverses actionToWatchNotificationType: it maps
// a wire event type back onto the stored data action so a received notification
// can be turned into an Event. UNKNOWN has no corresponding action and reports
// ok=false so the caller drops it rather than emit a bogus change.
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

// natsNotifier is a notifier backed by the external NATS bus. Its Watch
// subscribes to every resource's change subject and emits an Event per received
// WatchNotification; unlike the polling notifier it learns about writes the
// instant they are announced rather than by querying the event store.
//
// Two properties follow from the wire format and must be understood before
// relying on it as anything more than a low-latency hint:
//   - Events carry PreviousRV == 0, because WatchNotification has no previous
//     resource version. Consumers that depend on PreviousRV (batch-event
//     skipping, previous-object lookups) therefore behave differently than with
//     the store-sourced notifiers.
//   - Delivery is at-most-once (core NATS, no JetStream): a missed message is
//     never redelivered, so this cannot be the sole source of truth. The
//     polling notifier remains the correctness backstop.
type natsNotifier struct {
	subscriber EventSubscriber
	log        log.Logger
}

func newNatsNotifier(subscriber EventSubscriber, logger log.Logger) *natsNotifier {
	return &natsNotifier{subscriber: subscriber, log: logger}
}

func (n *natsNotifier) Watch(ctx context.Context, opts WatchOptions) <-chan Event {
	opts = opts.normalize()
	n.log.Info("creating new nats notifier", "buffer_size", opts.BufferSize)

	// raw is written by the NATS delivery goroutine; out is owned and closed by
	// the pump goroutine. Splitting them means the delivery callback never sends
	// on a closed channel: raw is never closed, so a late callback after ctx
	// cancellation is harmless.
	raw := make(chan Event, opts.BufferSize)
	out := make(chan Event, opts.BufferSize)

	handler := func(subject string, data []byte) {
		var notification resourcepb.WatchNotification
		if err := proto.Unmarshal(data, &notification); err != nil {
			n.log.Warn("failed to unmarshal watch notification", "subject", subject, "error", err)
			return
		}
		action, ok := watchNotificationTypeToAction(notification.Type)
		if !ok {
			n.log.Warn("dropped watch notification with unknown type", "subject", subject)
			return
		}
		evt := Event{
			Namespace:       notification.Namespace,
			Group:           notification.Group,
			Resource:        notification.Resource,
			Name:            notification.Name,
			ResourceVersion: notification.ResourceVersion,
			Action:          action,
			Folder:          notification.Folder,
			// PreviousRV is unknown: WatchNotification does not carry it.
		}
		select {
		case raw <- evt:
		default:
			n.log.Warn("dropped watch notification, channel full", "subject", subject)
		}
	}

	sub, err := n.subscriber.Subscribe(ctx, resourcewatch.SubjectAll, handler)
	if err != nil {
		n.log.Error("failed to subscribe to nats", "error", err)
		close(out)
		return out
	}

	context.AfterFunc(ctx, func() {
		if err := sub.Unsubscribe(); err != nil {
			n.log.Warn("failed to unsubscribe from nats", "error", err)
		}
	})

	go func() {
		defer close(out)
		for {
			select {
			case <-ctx.Done():
				return
			case evt := <-raw:
				select {
				case out <- evt:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return out
}

// Publish is a no-op: like the polling notifier, natsNotifier learns about
// writes from the bus, not from in-process callers.
func (n *natsNotifier) Publish(_ Event) {}
