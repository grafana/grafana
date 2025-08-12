package metrics

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana_secrets_manager"
	subsystem = "service"
)

// SecureValueServiceMetrics is a struct that contains all the metrics for SecureValue.
type SecureValueServiceMetrics struct {
	SecureValueCreateDuration *prometheus.HistogramVec
	SecureValueUpdateDuration *prometheus.HistogramVec
	SecureValueReadDuration   *prometheus.HistogramVec
	SecureValueListDuration   *prometheus.HistogramVec
	SecureValueDeleteDuration *prometheus.HistogramVec
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
		SecureValueReadDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_read_duration_seconds",
			Help:      "Duration of Secure Value read operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"success"}),
		SecureValueUpdateDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_update_duration_seconds",
			Help:      "Duration of Secure Value update operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"success"}),
		SecureValueListDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_list_duration_seconds",
			Help:      "Duration of Secure Value list operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"success"}),
		SecureValueDeleteDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_delete_duration_seconds",
			Help:      "Duration of Secure Value delete operations",
			Buckets:   prometheus.DefBuckets,
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
				m.SecureValueReadDuration,
				m.SecureValueUpdateDuration,
				m.SecureValueListDuration,
				m.SecureValueDeleteDuration,
			)
		}
		metricsInstance = m
	})
	return metricsInstance
}

func NewTestMetrics() *SecureValueServiceMetrics {
	return newSecureValueServiceMetrics()
}
