package resource

import (
	"context"

	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// EventPublisher announces resource changes on an external message bus (NATS).
// Its method set matches infra/nats.Publisher so the wired publisher satisfies
// it without an adapter. It is optional: publishing is skipped when the
// publisher is nil or reports Enabled() == false.
//
// Publishing is a best-effort side-effect of a committed write, never a
// precondition for it: the event store is the durable source of truth, so a
// dropped notification is recovered by consumers replaying from the store. A
// failed Publish therefore never fails the write.
type EventPublisher interface {
	Enabled() bool
	Publish(ctx context.Context, subject string, data []byte) error
}

// actionToWatchNotificationType maps the stored data action onto the wire event
// type, mirroring how server.go derives WatchEvent.Type. An unknown action maps
// to UNKNOWN so it is not mistaken for a real change.
func actionToWatchNotificationType(action kv.DataAction) resourcepb.WatchNotification_Type {
	switch action {
	case DataActionCreated:
		return resourcepb.WatchNotification_ADDED
	case DataActionUpdated:
		return resourcepb.WatchNotification_MODIFIED
	case DataActionDeleted:
		return resourcepb.WatchNotification_DELETED
	default:
		return resourcepb.WatchNotification_UNKNOWN
	}
}

// publishWatchNotification announces a committed write on the NATS resource
// subject as a metadata-only WatchNotification. Consumers re-fetch the object at
// their own API version, so no object body is sent. Errors are logged and
// swallowed: the write is already durable in the event store.
func (k *kvStorageBackend) publishWatchNotification(ctx context.Context, event Event) {
	if k.eventPublisher == nil || !k.eventPublisher.Enabled() {
		return
	}

	subject := resourcewatch.Subject(schema.GroupVersionResource{
		Group:    event.Group,
		Resource: event.Resource,
	}, event.Namespace)

	payload, err := proto.Marshal(&resourcepb.WatchNotification{
		Type:                    actionToWatchNotificationType(event.Action),
		Group:                   event.Group,
		Resource:                event.Resource,
		Namespace:               event.Namespace,
		Name:                    event.Name,
		ResourceVersion:         event.ResourceVersion,
		Folder:                  event.Folder,
		PreviousResourceVersion: event.PreviousRV,
	})
	if err != nil {
		k.log.Warn("failed to marshal watch notification", "subject", subject, "error", err)
		return
	}

	if err := k.eventPublisher.Publish(ctx, subject, payload); err != nil {
		k.log.Warn("failed to publish watch notification", "subject", subject, "error", err)
	}
}
