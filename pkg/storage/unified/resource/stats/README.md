# Unified Storage Usage Stats (POC)

Phase 1 of the unified-storage usage stats design: ingest resource events,
store per-object stats in KV, recompute rolling windows daily, and expose
aggregates to the search index. See `unified-storage-stats-design.md` at the
repo root for the full design.

This is an in-process POC (single-tenant shape). It runs on any KV-backed
storage backend: the `file` (badger) backend or the SQL backend in sqlkv mode
(`enable_sqlkv_backend=true`), where the stats sections persist to the
`resource_stats_daily` / `resource_stats_aggregates` tables. It deliberately
skips cloud rollout plumbing, the SQL-table `namespace` column / backup
changes, enterprise endpoint retirement, multi-replica lease tuning, and
orphan GC.

## Pieces

| File                  | Responsibility |
|-----------------------|----------------|
| `declaration.go`      | Hard-coded `StatsDeclaration` (metrics + windows) for `dashboard.grafana.app/dashboards`. |
| `keys.go`             | KV key format: `{group}/{resource}/{namespace}/{name}/{day}/{metric}` (daily) and `.../{field}` (aggregates). |
| `store.go`            | Daily buckets (source of truth, incl. overflow bucket) + derived aggregates cache over `KV`. |
| `ingest.go`           | In-memory accumulator + `RecordEvent` (tracked-resource + metric validation, dropped-events metric) + grab-flush-release lease flush. |
| `recalc.go`           | Daily reconcile: fold expiring buckets into overflow, recompute windows/totals. |
| `dashboard_stats.go`  | Search read path (`KVDashboardStats`) satisfying search `builders.DashboardStats`, behind a feature flag. |

## Data model

- `stats/daily` is the source of truth: the trailing 30 day buckets + one
  `overflow` bucket for everything older. `_total = overflow + sum(daily)`, so
  it is fully reconcilable.
- `stats/aggregates` is a derived cache (`*_last_1_days`, `*_last_7_days`,
  `*_last_30_days`, `*_total`) recomputed on `Recalc`; best-effort bumped on
  flush. It may be stale; staleness self-heals on recalc.
- Windows are rolling and inclusive of the current partial day, so
  `last_1 ≡ today`. Day boundaries are UTC, sourced from `KV.UnixTimestamp`.

## Wiring the search read path

Gated by the `[unified_storage] usage_stats_enabled` config
(`cfg.EnableUnifiedStorageUsageStats`). When it is set and the storage backend
is KV-backed, `search.MaybeUseUnifiedStorageStats` swaps the search document
builders' dashboard stats source to this package's `KVDashboardStats` (reading
unified storage KV); otherwise the legacy source is used (enterprise sprinkles /
OSS no-op). This only affects the unified storage server's document builders, so
in the separated cloud topology the flag lives entirely on the unified storage
side. The cutover is reversible by toggling the config.

## Not yet wired (follow-ups)

- Search read path: `KVDashboardStats` exists but `search/builders` still uses
  the OSS no-op; the cutover (behind a feature flag) is not connected.
- `RecordEvent` authz (`verb=get`) check.
- A real `namespace` column on the stats tables (needed for the hosted-grafana
  backup `WHERE namespace=` filter); the POC tables are plain `(key_path, value)`.
- Backfill from legacy `dashboard_usage_*` (reader + seeding); removed from the
  POC for now.
- Phase 2 incremental refresh via a `stats/log` section.
