package resource

import (
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resource/stats"
)

// NewStatsIngesterForBackend builds a usage-stats ingester (unified-storage
// stats POC) when the given backend is KV-backed (file / unified-kv-grpc).
// Returns nil for non-KV backends, which disables the RecordEvent RPC.
func NewStatsIngesterForBackend(backend StorageBackend, reg prometheus.Registerer) *stats.Ingester {
	kvBackend, ok := backend.(KVBackend)
	if !ok {
		return nil
	}
	kvStore := kvBackend.KV()
	if kvStore == nil {
		return nil
	}
	leaseMgr := kvBackend.LeaseManager()
	if leaseMgr == nil {
		// Leases disabled on the backend: run our own manager (no metrics to
		// avoid colliding with backend lease metrics on the same registry).
		leaseMgr = lease.NewManager(kvStore, "stats-"+uuid.NewString(), nil)
	}
	return stats.NewIngester(stats.NewStore(kvStore), stats.DefaultDeclarations(), leaseMgr, reg)
}
