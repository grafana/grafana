package metrics

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana_secrets_manager"
	subsystem = "storage"
)

// StorageMetrics is a struct that contains all the metrics for all operations of secrets storage.
type StorageMetrics struct {
	KeeperMetadataCreateDuration          *prometheus.HistogramVec
	KeeperMetadataCreateCount             *prometheus.CounterVec
	KeeperMetadataUpdateDuration          *prometheus.HistogramVec
	KeeperMetadataUpdateCount             *prometheus.CounterVec
	KeeperMetadataDeleteDuration          prometheus.Histogram
	KeeperMetadataDeleteCount             prometheus.Counter
	KeeperMetadataGetDuration             *prometheus.HistogramVec
	KeeperMetadataGetCount                *prometheus.CounterVec
	KeeperMetadataListDuration            prometheus.Histogram
	KeeperMetadataListCount               prometheus.Counter
	KeeperMetadataGetKeeperConfigDuration prometheus.Histogram

	SecureValueMetadataCreateDuration prometheus.Histogram
	SecureValueMetadataCreateCount    prometheus.Counter
	SecureValueMetadataUpdateDuration prometheus.Histogram
	SecureValueMetadataUpdateCount    prometheus.Counter
	SecureValueMetadataDeleteDuration prometheus.Histogram
	SecureValueMetadataDeleteCount    prometheus.Counter
	SecureValueMetadataGetDuration    prometheus.Histogram
	SecureValueMetadataGetCount       prometheus.Counter
	SecureValueMetadataListDuration   prometheus.Histogram
	SecureValueMetadataListCount      prometheus.Counter
	SecureValueSetExternalIDDuration  prometheus.Histogram
	SecureValueSetStatusDuration      prometheus.Histogram
	SecureValueMatchingOwnerDuration  prometheus.Histogram

	DecryptDuration     *prometheus.HistogramVec
	DecryptRequestCount *prometheus.CounterVec
}

func newStorageMetrics() *StorageMetrics {
	return &StorageMetrics{
		// Keeper metrics
		KeeperMetadataCreateDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_create_duration_seconds",
			Help:      "Duration of keeper metadata create operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
		KeeperMetadataCreateCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_create_count",
			Help:      "Count of keeper metadata create operations",
		}, []string{"keeper_type"}),
		KeeperMetadataUpdateDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_update_duration_seconds",
			Help:      "Duration of keeper metadata update operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
		KeeperMetadataUpdateCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_update_count",
			Help:      "Count of keeper metadata update operations",
		}, []string{"keeper_type"}),
		KeeperMetadataDeleteDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_delete_duration_seconds",
			Help:      "Duration of keeper metadata delete operations",
			Buckets:   prometheus.DefBuckets,
		}),
		KeeperMetadataDeleteCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_delete_count",
			Help:      "Count of keeper metadata delete operations",
		}),
		KeeperMetadataGetDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_get_duration_seconds",
			Help:      "Duration of keeper metadata get operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
		KeeperMetadataGetCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_get_count",
			Help:      "Count of keeper metadata get operations",
		}, []string{"keeper_type"}),
		KeeperMetadataListDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_list_duration_seconds",
			Help:      "Duration of keeper metadata list operations",
			Buckets:   prometheus.DefBuckets,
		}),
		KeeperMetadataListCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_list_count",
			Help:      "Count of keeper metadata list operations",
		}),
		KeeperMetadataGetKeeperConfigDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_get_keeper_config_duration_seconds",
			Help:      "Duration of keeper metadata get keeper config operations",
			Buckets:   prometheus.DefBuckets,
		}),

		// Secure value metrics
		SecureValueMetadataCreateDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_create_duration_seconds",
			Help:      "Duration of secure value metadata create operations",
			Buckets:   prometheus.DefBuckets,
		}),
		SecureValueMetadataCreateCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_create_count",
			Help:      "Count of secure value metadata create operations",
		}),
		SecureValueMetadataUpdateDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_update_duration_seconds",
			Help:      "Duration of secure value metadata update operations",
			Buckets:   prometheus.DefBuckets,
		}),
		SecureValueMetadataUpdateCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_update_count",
			Help:      "Count of secure value metadata update operations",
		}),
		SecureValueMetadataDeleteDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_delete_duration_seconds",
			Help:      "Duration of secure value metadata delete operations",
			Buckets:   prometheus.DefBuckets,
		}),
		SecureValueMetadataDeleteCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_delete_count",
			Help:      "Count of secure value metadata delete operations",
		}),
		SecureValueMetadataGetDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_get_duration_seconds",
			Help:      "Duration of secure value metadata get operations",
			Buckets:   prometheus.DefBuckets,
		}),
		SecureValueMetadataGetCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_get_count",
			Help:      "Count of secure value metadata get operations",
		}),
		SecureValueMetadataListDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_list_duration_seconds",
			Help:      "Duration of secure value metadata list operations",
			Buckets:   prometheus.DefBuckets,
		}),
		SecureValueMetadataListCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_list_count",
			Help:      "Count of secure value metadata list operations",
		}),
		SecureValueSetExternalIDDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_set_external_id_duration_seconds",
			Help:      "Duration of secure value set external id operations",
			Buckets:   prometheus.DefBuckets,
		}),
		SecureValueSetStatusDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_set_status_duration_seconds",
			Help:      "Duration of secure value set status operations",
			Buckets:   prometheus.DefBuckets,
		}),
		SecureValueMatchingOwnerDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_matching_owner_duration_seconds",
			Help:      "Duration of secure value matching owner operations",
			Buckets:   prometheus.DefBuckets,
		}),

		// Decrypt metrics
		DecryptDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "decrypt_duration_seconds",
			Help:      "Duration of decrypt operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"successful"}),
		DecryptRequestCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "decrypt_request_count",
			Help:      "Count of decrypt operations",
		}, []string{"successful"}),
	}
}

var (
	initOnce        sync.Once
	metricsInstance *StorageMetrics
)

// NewStorageMetrics returns a singleton instance of the SecretsMetrics struct containing registered metrics
func NewStorageMetrics(reg prometheus.Registerer) *StorageMetrics {
	initOnce.Do(func() {
		m := newStorageMetrics()

		if reg != nil {
			reg.MustRegister(
				m.KeeperMetadataCreateDuration,
				m.KeeperMetadataCreateCount,
				m.KeeperMetadataUpdateDuration,
				m.KeeperMetadataUpdateCount,
				m.KeeperMetadataDeleteDuration,
				m.KeeperMetadataDeleteCount,
				m.KeeperMetadataGetDuration,
				m.KeeperMetadataGetCount,
				m.KeeperMetadataListDuration,
				m.KeeperMetadataListCount,
				m.KeeperMetadataGetKeeperConfigDuration,
				m.SecureValueMetadataCreateDuration,
				m.SecureValueMetadataCreateCount,
				m.SecureValueMetadataUpdateDuration,
				m.SecureValueMetadataUpdateCount,
				m.SecureValueMetadataDeleteDuration,
				m.SecureValueMetadataDeleteCount,
				m.SecureValueMetadataGetDuration,
				m.SecureValueMetadataGetCount,
				m.SecureValueMetadataListDuration,
				m.SecureValueMetadataListCount,
				m.SecureValueSetExternalIDDuration,
				m.SecureValueSetStatusDuration,
				m.DecryptDuration,
				m.DecryptRequestCount,
			)
		}

		metricsInstance = m
	})

	return metricsInstance
}

func NewTestMetrics() *StorageMetrics {
	return newStorageMetrics()
}
