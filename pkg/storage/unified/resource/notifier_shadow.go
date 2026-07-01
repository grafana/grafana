package resource

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/dskit/instrument"
	"github.com/grafana/grafana/pkg/infra/log"
)

// natsShadowMetrics records what the NATS notifier delivers so it can be
// compared, in dashboards, against the primary notifier's watch metrics
// (e.g. storage_server_broadcaster_events_received_total and
// storage_server_watch_latency_seconds). Divergence in counts signals dropped
// notifications; the latency histogram shows the delivery-time advantage NATS
// would give over polling.
type natsShadowMetrics struct {
	eventsReceived *prometheus.CounterVec
	latency        *prometheus.HistogramVec
}

func newNatsShadowMetrics(reg prometheus.Registerer) *natsShadowMetrics {
	return &natsShadowMetrics{
		eventsReceived: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_nats_notifier_shadow_events_received_total",
			Help: "Change notifications received via the shadow NATS notifier, by group, resource, and action.",
		}, []string{"group", "resource", "action"}),
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

// natsShadow runs a natsNotifier alongside the backend's primary notifier for
// testing. It consumes the NATS change stream and records metrics only; it
// never feeds WatchWriteEvents, so enabling it cannot change what watch clients
// observe. This is the safe way to validate NATS delivery (coverage + latency)
// against the polling notifier on a live backend before wiring NATS into the
// watch path for real.
type natsShadow struct {
	notifier  *natsNotifier
	watchOpts WatchOptions
	metrics   *natsShadowMetrics
	log       log.Logger
}

func newNatsShadow(subscriber EventSubscriber, watchOpts WatchOptions, reg prometheus.Registerer, logger log.Logger) *natsShadow {
	return &natsShadow{
		notifier:  newNatsNotifier(subscriber, logger),
		watchOpts: watchOpts,
		metrics:   newNatsShadowMetrics(reg),
		log:       logger,
	}
}

// start consumes the NATS notifier until ctx is cancelled. It runs in its own
// goroutine and returns immediately.
func (s *natsShadow) start(ctx context.Context) {
	go func() {
		events := s.notifier.Watch(ctx, s.watchOpts)
		for evt := range events {
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
	}()
}
