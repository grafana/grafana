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
	KeeperMetadataUpdateDuration          *prometheus.HistogramVec
	KeeperMetadataDeleteDuration          prometheus.Histogram
	KeeperMetadataGetDuration             *prometheus.HistogramVec
	KeeperMetadataListDuration            prometheus.Histogram
	KeeperMetadataGetKeeperConfigDuration prometheus.Histogram

	SecureValueMetadataCreateDuration *prometheus.HistogramVec
	SecureValueMetadataGetDuration    prometheus.Histogram
	SecureValueMetadataListDuration   prometheus.Histogram
	SecureValueSetExternalIDDuration  prometheus.Histogram
	SecureValueSetStatusDuration      prometheus.Histogram

	DecryptDuration *prometheus.HistogramVec
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
		KeeperMetadataUpdateDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_update_duration_seconds",
			Help:      "Duration of keeper metadata update operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
		KeeperMetadataDeleteDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_delete_duration_seconds",
			Help:      "Duration of keeper metadata delete operations",
			Buckets:   prometheus.DefBuckets,
		}),
		KeeperMetadataGetDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_get_duration_seconds",
			Help:      "Duration of keeper metadata get operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
		KeeperMetadataListDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_list_duration_seconds",
			Help:      "Duration of keeper metadata list operations",
			Buckets:   prometheus.DefBuckets,
		}),
		KeeperMetadataGetKeeperConfigDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "keeper_metadata_get_keeper_config_duration_seconds",
			Help:      "Duration of keeper metadata get keeper config operations",
			Buckets:   prometheus.DefBuckets,
		}),

		// Secure value metrics
		SecureValueMetadataCreateDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_create_duration_seconds",
			Help:      "Duration of secure value metadata create operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"successful"}),
		SecureValueMetadataGetDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_get_duration_seconds",
			Help:      "Duration of secure value metadata get operations",
			Buckets:   prometheus.DefBuckets,
		}),

		SecureValueMetadataListDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "secure_value_metadata_list_duration_seconds",
			Help:      "Duration of secure value metadata list operations",
			Buckets:   prometheus.DefBuckets,
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

		// Decrypt metrics
		DecryptDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "decrypt_duration_seconds",
			Help:      "Duration of decrypt operations",
			Buckets:   prometheus.DefBuckets,
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
				m.KeeperMetadataUpdateDuration,
				m.KeeperMetadataDeleteDuration,
				m.KeeperMetadataGetDuration,
				m.KeeperMetadataListDuration,
				m.KeeperMetadataGetKeeperConfigDuration,
				m.SecureValueMetadataCreateDuration,
				m.SecureValueMetadataGetDuration,
				m.SecureValueMetadataListDuration,
				m.SecureValueSetExternalIDDuration,
				m.SecureValueSetStatusDuration,
				m.DecryptDuration,
			)
		}

		metricsInstance = m
	})

	return metricsInstance
}

func NewTestMetrics() *StorageMetrics {
	return newStorageMetrics()
}
