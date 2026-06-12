package stats

import "context"

// LegacyDailyRow mirrors one row of the enterprise dashboard_usage_by_day
// table (per-day buckets). The real backfill resolves the table name via
// helper.Table(...) and paginates by dashboard_uid; for the POC we accept
// already-read rows so there is no enterprise SQL dependency.
type LegacyDailyRow struct {
	Namespace    string
	DashboardUID string
	Day          string // YYYY-MM-DD
	Views        int64
	Queries      int64
	Errors       int64
}

// LegacyTotals mirrors the dashboard_usage_sums aggregates that pre-date our
// retained daily window; it seeds the overflow bucket so _total reconciles.
type LegacyTotals struct {
	Namespace    string
	DashboardUID string
	Views        int64
	Queries      int64
	Errors       int64
}

// Backfill seeds historical daily buckets and an overflow bucket from legacy
// usage tables. It is idempotent (overwrites immutable historical buckets),
// so re-runs are safe. It deliberately leaves today's bucket to go-forward
// RecordEvent ingestion to avoid double counting.
//
// Overflow is seeded as legacy_total - sum(retained daily buckets) per metric,
// so that _total = overflow + sum(daily) matches the legacy total.
func (s *Store) Backfill(ctx context.Context, today string, daily []LegacyDailyRow, totals []LegacyTotals) error {
	// metric->summed retained daily, per object, to derive overflow.
	retained := map[objectRef]map[string]int64{}

	for _, row := range daily {
		if row.Day == today {
			continue // leave today to go-forward
		}
		o := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: row.Namespace, Name: row.DashboardUID}
		vals := map[string]int64{"view": row.Views, "query": row.Queries, "error": row.Errors}
		for metric, v := range vals {
			if v == 0 {
				continue
			}
			if err := s.SetDaily(ctx, o, row.Day, metric, v); err != nil {
				return err
			}
			if retained[o] == nil {
				retained[o] = map[string]int64{}
			}
			retained[o][metric] += v
		}
	}

	for _, t := range totals {
		o := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: t.Namespace, Name: t.DashboardUID}
		vals := map[string]int64{"view": t.Views, "query": t.Queries, "error": t.Errors}
		for metric, total := range vals {
			overflow := total - retained[o][metric]
			if overflow < 0 {
				overflow = 0
			}
			if overflow == 0 {
				continue
			}
			if err := s.SetDaily(ctx, o, overflowBucket, metric, overflow); err != nil {
				return err
			}
		}
	}
	return nil
}
