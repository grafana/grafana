package encryption

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana_secrets_manager"
	subsystem = "data_key_storage"
)

// DataKeyMetrics is a struct that contains all the metrics for all operations of encryption storage.
type DataKeyMetrics struct {
	CreateDataKeyDuration     prometheus.Histogram
	GetDataKeyDuration        prometheus.Histogram
	GetCurrentDataKeyDuration prometheus.Histogram
	GetAllDataKeysDuration    prometheus.Histogram
	DisableDataKeysDuration   prometheus.Histogram
	DeleteDataKeyDuration     prometheus.Histogram
}

func newDataKeyMetrics() *DataKeyMetrics {
	return &DataKeyMetrics{
		CreateDataKeyDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "create_data_key_duration_seconds",
			Help:      "Duration of create data key operations",
			Buckets:   prometheus.DefBuckets,
		}),
		GetDataKeyDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "get_data_key_duration_seconds",
			Help:      "Duration of get data key operations",
			Buckets:   prometheus.DefBuckets,
		}),
		GetCurrentDataKeyDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "get_current_data_key_duration_seconds",
			Help:      "Duration of get current data key operations",
			Buckets:   prometheus.DefBuckets,
		}),
		GetAllDataKeysDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "get_all_data_keys_duration_seconds",
			Help:      "Duration of get all data keys operations",
			Buckets:   prometheus.DefBuckets,
		}),
		DisableDataKeysDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "disable_data_keys_duration_seconds",
			Help:      "Duration of disable data keys operations",
			Buckets:   prometheus.DefBuckets,
		}),
		DeleteDataKeyDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "delete_data_key_duration_seconds",
			Help:      "Duration of delete data key operations",
			Buckets:   prometheus.DefBuckets,
		}),
	}
}

// NewDataKeyMetrics returns an instance of the DataKeyMetrics
// struct containing registered metrics if [reg] is not nil.
func NewDataKeyMetrics(reg prometheus.Registerer) *DataKeyMetrics {
	m := newDataKeyMetrics()

	if reg != nil {
		reg.MustRegister(
			m.CreateDataKeyDuration,
			m.GetDataKeyDuration,
			m.GetCurrentDataKeyDuration,
			m.GetAllDataKeysDuration,
			m.DisableDataKeysDuration,
			m.DeleteDataKeyDuration,
		)
	}

	return m
}
