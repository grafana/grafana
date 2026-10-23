package resource

import (
	"context"
	"slices"
	"time"

	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

// watchMetadataSpec lists what a resource's notifications carry beyond identity:
// the allowlisted label and annotation keys and finalizers, plus generation and
// the creation and deletion timestamps. Only allowlisted values are sent, to keep
// the payload small.
type watchMetadataSpec struct {
	Labels      []string
	Annotations []string
	Finalizers  []string
}

// watchNotificationSpecs holds the resources whose notifications carry metadata.
// Resources not listed here send none; add an entry when a consumer needs it.
var watchNotificationSpecs = map[schema.GroupResource]watchMetadataSpec{
	{Group: "setting.grafana.app", Resource: "settings"}: {
		Labels:      []string{"encrypted", "secureValueName"},
		Annotations: []string{"setting.grafana.app/pending-secret-cleanup"},
		Finalizers:  []string{"setting.grafana.app/secret-cleanup"},
	},
}

// watchMetadata is the object metadata a notification carries so consumers can
// filter without a GET. It is not part of the persisted Event.
type watchMetadata struct {
	Labels            map[string]string // allowlisted keys only
	PreviousLabels    map[string]string // allowlisted keys only
	Generation        int64
	CreationTimestamp int64 // unix millis, 0 when unset
	DeletionTimestamp int64 // unix millis, 0 when unset
	Finalizers        []string
	Annotations       map[string]string // allowlisted keys only
}

// newWatchMetadata returns the metadata for a write of the given resource, or nil
// when the resource has no entry in watchNotificationSpecs. previous may be nil.
func newWatchMetadata(gr schema.GroupResource, obj, previous utils.GrafanaMetaAccessor) *watchMetadata {
	spec, ok := watchNotificationSpecs[gr]
	if !ok || obj == nil {
		return nil
	}
	m := &watchMetadata{
		Labels:            filterKeys(obj.GetLabels(), spec.Labels),
		Generation:        obj.GetGeneration(),
		Finalizers:        filterFinalizers(obj.GetFinalizers(), spec.Finalizers),
		Annotations:       filterKeys(obj.GetAnnotations(), spec.Annotations),
		CreationTimestamp: timeToMillis(obj.GetCreationTimestamp().Time),
	}
	if dt := obj.GetDeletionTimestamp(); dt != nil {
		m.DeletionTimestamp = timeToMillis(dt.Time)
	}
	if previous != nil {
		m.PreviousLabels = filterKeys(previous.GetLabels(), spec.Labels)
	}
	return m
}

// filterKeys keeps only the allowed keys, or nil when none are set.
func filterKeys(m map[string]string, allowed []string) map[string]string {
	var out map[string]string
	for _, key := range allowed {
		if v, ok := m[key]; ok {
			if out == nil {
				out = make(map[string]string)
			}
			out[key] = v
		}
	}
	return out
}

// filterFinalizers keeps only the allowed finalizers, or nil when none are set.
func filterFinalizers(finalizers, allowed []string) []string {
	var out []string
	for _, f := range finalizers {
		if slices.Contains(allowed, f) {
			out = append(out, f)
		}
	}
	return out
}

func timeToMillis(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.UnixMilli()
}

// publishWatchNotification announces a committed write on the NATS resource
// subject as a metadata-only WatchNotification (identity, labels and a few
// ObjectMeta fields). Consumers re-fetch the object at
// their own API version, so no object body is sent. Errors are logged and
// swallowed: the write is already durable in the event store.
func (k *kvStorageBackend) publishWatchNotification(ctx context.Context, event Event, meta *watchMetadata) {
	if k.eventPublisher == nil || !k.eventPublisher.Enabled() {
		return
	}

	subject := resourcewatch.Subject(schema.GroupVersionResource{
		Group:    event.Group,
		Resource: event.Resource,
	}, event.Namespace)

	n := &resourcepb.WatchNotification{
		Type:                    actionToWatchNotificationType(event.Action),
		Group:                   event.Group,
		Resource:                event.Resource,
		Namespace:               event.Namespace,
		Name:                    event.Name,
		ResourceVersion:         event.ResourceVersion,
		Folder:                  event.Folder,
		PreviousResourceVersion: event.PreviousRV,
		PreviousType:            actionToWatchNotificationType(event.PreviousAction),
		PreviousFolder:          event.PreviousFolder,
	}
	if meta != nil {
		n.Labels = meta.Labels
		n.PreviousLabels = meta.PreviousLabels
		n.Generation = meta.Generation
		n.CreationTimestampMillis = meta.CreationTimestamp
		n.DeletionTimestampMillis = meta.DeletionTimestamp
		n.Finalizers = meta.Finalizers
		n.Annotations = meta.Annotations
	}
	payload, err := proto.Marshal(n)
	if err != nil {
		k.metrics.recordWatchNotificationPublishFailure(event)
		k.log.Warn("failed to marshal watch notification", "subject", subject, "error", err)
		return
	}

	if err := k.eventPublisher.Publish(ctx, subject, payload); err != nil {
		k.metrics.recordWatchNotificationPublishFailure(event)
		k.log.Warn("failed to publish watch notification", "subject", subject, "error", err)
		return
	}
	k.metrics.recordWatchNotificationPublished(event)
}
