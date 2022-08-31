package sqlstore

import (
	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus"
)

type sqlStoreMetrics struct {
	db sqlstats.StatsGetter

	// gauges
	maxOpenConnections *prometheus.Desc
	openConnections    *prometheus.Desc
	inUse              *prometheus.Desc
	idle               *prometheus.Desc

	// counters
	waitCount         *prometheus.Desc
	waitDuration      *prometheus.Desc
	maxIdleClosed     *prometheus.Desc
	maxIdleTimeClosed *prometheus.Desc
	maxLifetimeClosed *prometheus.Desc
}

func newSQLStoreMetrics(db sqlstats.StatsGetter) *sqlStoreMetrics {
	ns := "grafana"
	sub := "database"

	return &sqlStoreMetrics{
		db: db,
		maxOpenConnections: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_max_open"),
			"Maximum number of open connections to the database",
			nil, nil,
		),
		openConnections: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_open"),
			"The number of established connections both in use and idle",
			nil, nil,
		),
		inUse: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_in_use"),
			"The number of connections currently in use",
			nil, nil,
		),
		idle: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_idle"),
			"The number of idle connections",
			nil, nil,
		),

		waitCount: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_wait_count_total"),
			"The total number of connections waited for",
			nil, nil,
		),
		waitDuration: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_wait_duration_seconds"),
			"The total time blocked waiting for a new connection",
			nil, nil,
		),
		maxIdleClosed: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_max_idle_closed_total"),
			"The total number of connections closed due to SetMaxIdleConns",
			nil, nil,
		),
		maxIdleTimeClosed: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_max_idle_closed_seconds"),
			"The total number of connections closed due to SetConnMaxIdleTime",
			nil, nil,
		),
		maxLifetimeClosed: prometheus.NewDesc(
			prometheus.BuildFQName(ns, sub, "conn_max_lifetime_closed_total"),
			"The total number of connections closed due to SetConnMaxLifetime",
			nil, nil,
		),
	}
}

// Collect implements Prometheus.Collector.
func (m *sqlStoreMetrics) Collect(ch chan<- prometheus.Metric) {
	stats := m.db.Stats()

	ch <- prometheus.MustNewConstMetric(
		m.maxOpenConnections,
		prometheus.GaugeValue,
		float64(stats.MaxOpenConnections),
	)
	ch <- prometheus.MustNewConstMetric(
		m.openConnections,
		prometheus.GaugeValue,
		float64(stats.OpenConnections),
	)
	ch <- prometheus.MustNewConstMetric(
		m.inUse,
		prometheus.GaugeValue,
		float64(stats.InUse),
	)
	ch <- prometheus.MustNewConstMetric(
		m.idle,
		prometheus.GaugeValue,
		float64(stats.Idle),
	)

	ch <- prometheus.MustNewConstMetric(
		m.waitCount,
		prometheus.CounterValue,
		float64(stats.WaitCount),
	)
	ch <- prometheus.MustNewConstMetric(
		m.waitDuration,
		prometheus.CounterValue,
		stats.WaitDuration.Seconds(),
	)
	ch <- prometheus.MustNewConstMetric(
		m.maxIdleClosed,
		prometheus.CounterValue,
		float64(stats.MaxIdleClosed),
	)
	ch <- prometheus.MustNewConstMetric(
		m.maxIdleTimeClosed,
		prometheus.CounterValue,
		float64(stats.MaxIdleTimeClosed),
	)
	ch <- prometheus.MustNewConstMetric(
		m.maxLifetimeClosed,
		prometheus.CounterValue,
		float64(stats.MaxLifetimeClosed),
	)
}

// Describe implements Prometheus.Collector.
func (m *sqlStoreMetrics) Describe(ch chan<- *prometheus.Desc) {
	ch <- m.maxOpenConnections
	ch <- m.openConnections
	ch <- m.inUse
	ch <- m.idle

	ch <- m.waitCount
	ch <- m.waitDuration
	ch <- m.maxIdleClosed
	ch <- m.maxIdleTimeClosed
	ch <- m.maxLifetimeClosed
}
