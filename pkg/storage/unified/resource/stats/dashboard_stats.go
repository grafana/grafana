package stats

import "context"

// KVDashboardStats reads dashboard usage aggregates from unified-storage KV
// instead of the enterprise sprinkles server. It satisfies the search
// builders.DashboardStats interface (GetStats/GetDashboardStats) and is the
// Phase 1 search read path, selected by the [unified_storage]
// usage_stats_enabled config.
type KVDashboardStats struct {
	store *Store
}

func NewKVDashboardStats(store *Store) *KVDashboardStats {
	return &KVDashboardStats{store: store}
}

const (
	dashboardsGroup    = "dashboard.grafana.app"
	dashboardsResource = "dashboards"
)

// GetStats returns dashboardUID -> field -> value for all dashboards in a
// namespace (field e.g. "view_last_7_days", "view_total").
func (s *KVDashboardStats) GetStats(ctx context.Context, namespace string) (map[string]map[string]int64, error) {
	return s.store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, namespace)
}

// GetDashboardStats returns field -> value for a single dashboard.
func (s *KVDashboardStats) GetDashboardStats(ctx context.Context, namespace, dashboardUID string) (map[string]int64, error) {
	all, err := s.GetStats(ctx, namespace)
	if err != nil {
		return nil, err
	}
	return all[dashboardUID], nil
}
