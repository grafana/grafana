package resource

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/dskit/instrument"
	"github.com/grafana/grafana/pkg/infra/log"
)

// natsShadowMetrics record what the NATS notifier delivers, for dashboard
// comparison against the primary notifier's watch metrics
// (storage_server_broadcaster_events_received_total,
// storage_server_watch_latency_seconds). Count divergence signals dropped
// notifications; latency shows the delivery-time advantage over polling.
type natsShadowMetrics struct {
	eventsReceived *prometheus.CounterVec
	dropped        *prometheus.CounterVec
	latency        *prometheus.HistogramVec
}

func newNatsShadowMetrics(reg prometheus.Registerer) *natsShadowMetrics {
	return &natsShadowMetrics{
		eventsReceived: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_nats_notifier_shadow_events_received_total",
			Help: "Change notifications received via the shadow NATS notifier, by group, resource, and action.",
		}, []string{"group", "resource", "action"}),
		dropped: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_nats_notifier_shadow_dropped_events_total",
			Help: "Notifications dropped by the shadow NATS notifier before delivery, by reason (unmarshal_error, unknown_type, buffer_full).",
		}, []string{"reason"}),
		latency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "storage_server_nats_notifier_shadow_latency_seconds",
			Help:                            "Time between a resource version being issued and its notification arriving via the shadow NATS notifier.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
	}
}

// natsShadow runs a natsNotifier beside the primary notifier for testing: it
// consumes the NATS change stream and records metrics only, never feeding the
// watch pipeline, so enabling it cannot change what watch clients observe. It
// validates NATS delivery (coverage + latency) on a live backend before NATS is
// wired into the watch path for real.
type natsShadow struct {
	notifier  *natsNotifier
	watchOpts WatchOptions
	metrics   *natsShadowMetrics
	log       log.Logger
}

func newNatsShadow(subscriber EventSubscriber, watchOpts WatchOptions, reg prometheus.Registerer, logger log.Logger) *natsShadow {
	metrics := newNatsShadowMetrics(reg)
	return &natsShadow{
		notifier:  newNatsNotifier(subscriber, metrics.dropped, logger),
		watchOpts: watchOpts,
		metrics:   metrics,
		log:       logger,
	}
}

// start consumes the notifier until ctx is cancelled. The notifier owns its own
// subscription retry, so a startup outage no longer leaves the shadow inert.
func (s *natsShadow) start(ctx context.Context) {
	go func() {
		for evt := range s.notifier.Watch(ctx, s.watchOpts) {
			s.observe(evt)
		}
	}()
}

func (s *natsShadow) observe(evt Event) {
	s.metrics.eventsReceived.WithLabelValues(evt.Group, evt.Resource, string(evt.Action)).Inc()
	latency := time.Since(resourceVersionTime(evt.ResourceVersion)).Seconds()
	if latency > 0 {
		s.metrics.latency.WithLabelValues(evt.Resource).Observe(latency)
	}
	s.log.Debug("nats shadow received event",
		"group", evt.Group,
		"resource", evt.Resource,
		"namespace", evt.Namespace,
		"name", evt.Name,
		"rv", evt.ResourceVersion,
		"action", evt.Action,
		"latency_seconds", latency,
	)
}
