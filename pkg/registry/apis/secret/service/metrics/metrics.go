package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"sync"
)

const (
	namespace = "grafana_secrets_manager"
	subsystem = "service"
)

// SecureValueServiceMetrics is a struct that contains all the metrics for SecureValue.
type SecureValueServiceMetrics struct {
	SecureValueCreateDuration *prometheus.HistogramVec
	SecureValueCreateCount    *prometheus.CounterVec
	SecureValueUpdateDuration *prometheus.HistogramVec
	SecureValueUpdateCount    *prometheus.CounterVec
	SecureValueReadDuration   *prometheus.HistogramVec
	SecureValueReadCount      *prometheus.CounterVec
	SecureValueListDuration   *prometheus.HistogramVec
	SecureValueListCount      *prometheus.CounterVec
	SecureValueDeleteDuration *prometheus.HistogramVec
	SecureValueDeleteCount    *prometheus.CounterVec
}

func newSecureValueServiceMetrics() *SecureValueServiceMetrics {
	return &SecureValueServiceMetrics{
		SecureValueCreateDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_create_duration_seconds",
			Help:      "Duration of Secure Value create operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"success"}),
		SecureValueCreateCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_create_count",
			Help:      "Count of Secure Value create operations",
		}, []string{"success"}),
		SecureValueReadDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_read_duration_seconds",
			Help:      "Duration of Secure Value read operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"success"}),
		SecureValueReadCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_read_count",
			Help:      "Count of Secure Value read operations",
		}, []string{"success"}),
		SecureValueUpdateDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_update_duration_seconds",
			Help:      "Duration of Secure Value update operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"success"}),
		SecureValueUpdateCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_update_count",
			Help:      "Count of Secure Value update operations",
		}, []string{"success"}),
		SecureValueListDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_list_duration_seconds",
			Help:      "Duration of Secure Value list operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"success"}),
		SecureValueListCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_list_count",
			Help:      "Count of Secure Value list operations",
		}, []string{"success"}),
		SecureValueDeleteDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_delete_duration_seconds",
			Help:      "Duration of Secure Value delete operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"success"}),
		SecureValueDeleteCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_delete_count",
			Help:      "Count of Secure Value delete operations",
		}, []string{"success"}),
	}
}

var (
	initOnce        sync.Once
	metricsInstance *SecureValueServiceMetrics
)

func NewSecureValueServiceMetrics(reg prometheus.Registerer) *SecureValueServiceMetrics {
	initOnce.Do(func() {
		m := newSecureValueServiceMetrics()

		if reg != nil {
			reg.MustRegister(
				m.SecureValueCreateDuration,
				m.SecureValueCreateCount,
				m.SecureValueReadDuration,
				m.SecureValueReadCount,
				m.SecureValueUpdateDuration,
				m.SecureValueUpdateCount,
				m.SecureValueListDuration,
				m.SecureValueListCount,
				m.SecureValueDeleteDuration,
				m.SecureValueDeleteCount,
			)
		}
		metricsInstance = m
	})
	return metricsInstance
}

func NewTestMetrics() *SecureValueServiceMetrics {
	return newSecureValueServiceMetrics()
}
