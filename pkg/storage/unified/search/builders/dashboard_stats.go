package builders

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// OssDashboardStats is the OSS DashboardStats provider. When the
// storage.resourceKV toggle is on and a KV store is available it delegates to
// KVDashboardStats; otherwise it is a no-op that leaves the fields absent.
//
// Enterprise replaces this type entirely via Wire (usageinsights.KVStats), so
// KV logic here never interferes with Enterprise's own stats implementation.
type OssDashboardStats struct {
	kv *KVDashboardStats
}

// ProvideDashboardStats constructs the OSS stats provider. Pass a non-nil
// *kv.ResourceKVStore (built by sql.ProvideResourceKVStoreForSearch) to enable
// KV-backed stats; pass nil to keep the no-op behaviour (toggle off or no store).
func ProvideDashboardStats(kvStore *kv.ResourceKVStore) *OssDashboardStats {
	return &OssDashboardStats{kv: NewKVDashboardStats(kvStore)}
}

func (s *OssDashboardStats) GetStats(ctx context.Context, namespace string) (map[string]map[string]int64, error) {
	if s.kv == nil {
		return nil, nil
	}
	return s.kv.GetStats(ctx, namespace)
}

func (s *OssDashboardStats) GetDashboardStats(ctx context.Context, namespace, dashboardName string) (map[string]int64, error) {
	if s.kv == nil {
		return nil, nil
	}
	return s.kv.GetDashboardStats(ctx, namespace, dashboardName)
}

// RefreshesFromKV reports whether this DashboardStats is backed by the KV
// store and therefore benefits from search.go's periodic per-namespace
// builder refresh: only a KV-backed provider's data can go
// stale in the builder cache between full index rebuilds.
//
// sql.withSearch checks for this optional capability before enabling the
// refresh loop. Enterprise's usageinsights.KVStats opts in when it is in KV
// mode; in legacy mode (legacy sprinkles, HTTP or on-prem SQL) it does not,
// so the loop stays off there even though a KVStore may be present for
// unrelated reasons.
func (s *OssDashboardStats) RefreshesFromKV() bool {
	return s.kv != nil
}
