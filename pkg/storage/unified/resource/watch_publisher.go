package resource

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
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
func actionToWatchNotificationType(action DataAction) resourcepb.WatchNotification_Type {
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

// defaultMaxWatchNotificationBytes is NATS's default max_payload, used when the
// publisher cannot report the server's applied one.
const defaultMaxWatchNotificationBytes = 1024 * 1024

// maxPayloadReporter is implemented by publishers that know the max_payload the
// bus applies. Above it the publish fails and the notification is lost.
type maxPayloadReporter interface {
	MaxPayload() int64
}

// WatchNotificationPublisher announces committed writes on NATS for both the KV
// and legacy SQL backends. Nil is a no-op.
type WatchNotificationPublisher struct {
	publisher EventPublisher
	log       logging.Logger
	metrics   *watchNotificationMetrics
}

func NewWatchNotificationPublisher(p EventPublisher, reg prometheus.Registerer, log logging.Logger) *WatchNotificationPublisher {
	if p == nil {
		return nil
	}
	return &WatchNotificationPublisher{publisher: p, log: log, metrics: newWatchNotificationMetrics(reg)}
}

func (w *WatchNotificationPublisher) maxWatchNotificationBytes() int {
	if r, ok := w.publisher.(maxPayloadReporter); ok {
		if n := r.MaxPayload(); n > 0 {
			return int(n)
		}
	}
	return defaultMaxWatchNotificationBytes
}

// Publish sends n without the object body. Errors are
// only logged.
func (w *WatchNotificationPublisher) Publish(ctx context.Context, n *resourcepb.WatchNotification) {
	if w == nil || !w.publisher.Enabled() {
		return
	}

	subject := resourcewatch.Subject(schema.GroupVersionResource{
		Group:    n.Group,
		Resource: n.Resource,
	}, n.Namespace)

	payload, err := proto.Marshal(n)
	if err == nil && n.Metadata != nil && len(payload) > w.maxWatchNotificationBytes() {
		// Identity alone is enough for consumers to fall back to a GET.
		w.metrics.recordMetadataDropped(n)
		w.log.Warn("watch notification too large, publishing without metadata", "subject", subject, "name", n.Name, "bytes", len(payload))
		n.Metadata = nil
		payload, err = proto.Marshal(n)
	}
	if err != nil {
		w.metrics.recordPublishFailures(n)
		w.log.Warn("failed to marshal watch notification", "subject", subject, "name", n.Name, "error", err)
		return
	}

	if err := w.publisher.Publish(ctx, subject, payload); err != nil {
		w.metrics.recordPublishFailures(n)
		w.log.Warn("failed to publish watch notification", "subject", subject, "name", n.Name, "error", err)
		return
	}
	w.metrics.recordPublished(n)
}

func (k *kvStorageBackend) publishWatchNotification(ctx context.Context, event Event) {
	k.watchPublisher.Publish(ctx, &resourcepb.WatchNotification{
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
		Metadata:                event.Metadata,
	})
}

type watchNotificationMetrics struct {
	Published       *prometheus.CounterVec
	PublishFailures *prometheus.CounterVec
	MetadataDropped *prometheus.CounterVec
}

func newWatchNotificationMetrics(reg prometheus.Registerer) *watchNotificationMetrics {
	return &watchNotificationMetrics{
		Published: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_watch_notifications_published_total",
			Help: "Watch notifications successfully published to NATS, by group, resource, and action. The denominator for consumer delivery completeness: compare against the consumers' live-received totals to measure events missed in flight.",
		}, []string{"group", "resource", "action"}),
		PublishFailures: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_watch_notifications_publish_failures_total",
			Help: "Watch notifications that failed to marshal or publish to NATS, by group, resource, and action. Each one is an event live consumers never receive; they recover it on their next re-list.",
		}, []string{"group", "resource", "action"}),
		MetadataDropped: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_watch_notification_metadata_dropped_total",
			Help: "Watch notifications published without their metadata because it pushed the message over the size limit, by group, resource, and action.",
		}, []string{"group", "resource", "action"}),
	}
}

func watchNotificationActionLabel(n *resourcepb.WatchNotification) string {
	action, _ := watchNotificationTypeToAction(n.Type)
	return string(action)
}

func (m *watchNotificationMetrics) recordPublished(n *resourcepb.WatchNotification) {
	m.Published.WithLabelValues(n.Group, n.Resource, watchNotificationActionLabel(n)).Inc()
}

func (m *watchNotificationMetrics) recordPublishFailures(n *resourcepb.WatchNotification) {
	m.PublishFailures.WithLabelValues(n.Group, n.Resource, watchNotificationActionLabel(n)).Inc()
}

func (m *watchNotificationMetrics) recordMetadataDropped(n *resourcepb.WatchNotification) {
	m.MetadataDropped.WithLabelValues(n.Group, n.Resource, watchNotificationActionLabel(n)).Inc()
}
