package stats

import "context"

// KVDashboardStats reads dashboard usage aggregates from unified-storage KV
// instead of the enterprise sprinkles server. It satisfies the search
// builders.DashboardStats interface (GetStats/GetDashboardStats) and is the
// Phase 1 search read path, wired behind a feature flag.
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

// noopDashboardStats returns empty results, matching the legacy OSS behaviour
// when the unified-storage stats feature flag is off.
type noopDashboardStats struct{}

func (noopDashboardStats) GetStats(context.Context, string) (map[string]map[string]int64, error) {
	return nil, nil
}

func (noopDashboardStats) GetDashboardStats(context.Context, string, string) (map[string]int64, error) {
	return nil, nil
}

// dashboardStats is the subset of search builders.DashboardStats this package
// can provide. Declared locally to avoid importing the search package.
type dashboardStats interface {
	GetStats(ctx context.Context, namespace string) (map[string]map[string]int64, error)
	GetDashboardStats(ctx context.Context, namespace, dashboardUID string) (map[string]int64, error)
}

// ProvideDashboardStats selects the unified-storage read path when enabled
// (reversible cutover behind a feature flag), otherwise the legacy no-op.
func ProvideDashboardStats(store *Store, enabled bool) dashboardStats {
	if enabled && store != nil {
		return NewKVDashboardStats(store)
	}
	return noopDashboardStats{}
}

var (
	_ dashboardStats = (*KVDashboardStats)(nil)
	_ dashboardStats = noopDashboardStats{}
)
