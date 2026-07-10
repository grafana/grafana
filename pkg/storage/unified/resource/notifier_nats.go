package resource

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/protobuf/proto"

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

// natsNotifier emits an Event per WatchNotification received from NATS, learning
// of writes the instant they are announced rather than by polling the store.
// Watch subscribes to the entire stream (SubjectAll) and ignores the resource
// selectors in WatchOptions, so it is not a drop-in per-watch notifier.
//
// Delivery is at-most-once (core NATS, no JetStream); a missed message is never
// redelivered, so it is a low-latency signal, not a source of truth. When it is
// the selected notifier there is no server-side polling backstop (newNotifier
// returns this OR the polling notifier, never both) — recovery relies on
// consumers relisting (k8s reflector resync, provisioning informer relist).
// PreviousRV is carried on the wire, matching the store-sourced notifiers.
type natsNotifier struct {
	subscriber EventSubscriber
	dropped    *prometheus.CounterVec // by reason; nil is allowed (no accounting)
	log        log.Logger
}

func newNatsNotifier(subscriber EventSubscriber, dropped *prometheus.CounterVec, logger log.Logger) *natsNotifier {
	return &natsNotifier{subscriber: subscriber, dropped: dropped, log: logger}
}

func (n *natsNotifier) drop(reason string) {
	if n.dropped != nil {
		n.dropped.WithLabelValues(reason).Inc()
	}
}

func (n *natsNotifier) Watch(ctx context.Context, opts WatchOptions) <-chan Event {
	opts = opts.normalize()
	n.log.Info("creating new nats notifier", "buffer_size", opts.BufferSize)

	// The NATS callback writes raw; the pump owns and closes out. raw is never
	// closed, so a callback firing after ctx cancellation can't send on a closed
	// channel.
	raw := make(chan Event, opts.BufferSize)
	out := make(chan Event, opts.BufferSize)

	handler := func(subject string, data []byte) {
		var notification resourcepb.WatchNotification
		if err := proto.Unmarshal(data, &notification); err != nil {
			n.drop("unmarshal_error")
			n.log.Warn("failed to unmarshal watch notification", "subject", subject, "error", err)
			return
		}
		action, ok := watchNotificationTypeToAction(notification.Type)
		if !ok {
			n.drop("unknown_type")
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
			PreviousRV:      notification.PreviousResourceVersion,
		}
		select {
		case raw <- evt:
		default:
			n.drop("buffer_full")
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

// TODO: currently the events are published to NATS in watch_publisher.go,
// but we need refactor to publish them here in the notifier,
// once we have a single notifier implementation (natsNotifier) and remove the pollingNotifier.
func (n *natsNotifier) Publish(_ Event) {}
