package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type Ticker struct {
	LastTickTime    prometheus.Gauge
	NextTickTime    prometheus.Gauge
	IntervalSeconds prometheus.Gauge
}

func NewTickerMetrics(reg prometheus.Registerer) *Ticker {
	return &Ticker{
		LastTickTime: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "ticker_last_consumed_tick_timestamp_seconds",
			Help:      "Timestamp of the last consumed tick in seconds.",
		}),
		NextTickTime: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "ticker_next_tick_timestamp_seconds",
			Help:      "Timestamp of the next tick in seconds before it is consumed.",
		}),
		IntervalSeconds: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "ticker_interval_seconds",
			Help:      "Interval at which the ticker is meant to tick.",
		}),
	}
}
