// Package dashboardviews shares the logic for excluding dashboards from
// vector embeddings when they have zero views in the last 30 days. Both
// the backfiller and the reconciler use it; the rules are intentionally
// narrow and best-effort — anything ambiguous falls back to "embed it
// anyway."
package dashboardviews

import "context"

// Group / Resource identify the dashboard builder. The view filter is a
// no-op for any other builder so the helper accepts a generic builder
// identity rather than coupling to dashboard.Extractor directly.
const (
	Group    = "dashboard.grafana.app"
	Resource = "dashboards"
)

// viewsLast30DaysKey matches the wire shape exposed by
// pkg/extensions/usageinsights.statsToMap.
const viewsLast30DaysKey = "views_last_30_days"

// Provider returns per-dashboard usage stats keyed by stat name. The
// filter only inspects views_last_30_days; any error, missing key, or
// empty map is treated as "unknown" and the dashboard is embedded.
// *pkg/extensions/usageinsights.Service satisfies this structurally.
type Provider interface {
	GetDashboardStats(ctx context.Context, namespace, dashboardUid string) (map[string]int64, error)
}

// Builder is the subset of embed.Builder used to gate the filter to
// dashboard events. Declared locally so this package has no embed
// import — keeps the dependency tree pointing the right direction.
type Builder interface {
	Group() string
	Resource() string
}

// ShouldSkip reports whether a dashboard write should be excluded from
// embedding because it has zero views in the last 30 days. Best-effort:
// nil provider, non-dashboard builder, empty name, or a missing
// views_last_30_days key all return (false, nil). err is non-nil only
// when the provider call itself failed so callers can log it.
func ShouldSkip(ctx context.Context, p Provider, builder Builder, namespace, name string) (skip bool, err error) {
	if p == nil {
		return false, nil
	}
	if builder.Group() != Group || builder.Resource() != Resource {
		return false, nil
	}
	if name == "" {
		return false, nil
	}
	stats, err := p.GetDashboardStats(ctx, namespace, name)
	if err != nil {
		return false, err
	}
	views, ok := stats[viewsLast30DaysKey]
	if !ok || views >= 1 {
		return false, nil
	}
	return true, nil
}
