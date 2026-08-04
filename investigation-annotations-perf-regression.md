# Investigation: Annotations API Performance Regression (v11.6.x → v12.3.x)

## Summary

The GET `/api/annotations` endpoint (with `dashboardUID`, `from`, `to`, `limit=100`, `matchAny=false`) is ~450x slower on v12.3.2 vs v11.6.3 for LinkedIn's self-hosted instance (1.3M permission rows, MySQL). The root cause is a combination of:

1. **FORCE INDEX (IDX_dashboard_title)** — unconditionally applied on MySQL in v12.3.2, forcing a full title-index scan instead of a UID-index lookup
2. **Always-on K8s search path** — removes direct SQL store access with caller-provided filters
3. **Action set broadening** — the permission SQL checks 4 actions instead of 1

## Code Path: GET /api/annotations

```
pkg/api/annotations.go:GetAnnotations()
  → pkg/services/annotations/annotationsimpl/annotations.go:RepositoryImpl.Find()
    → pkg/services/annotations/accesscontrol/accesscontrol.go:AuthService.Authorize()
      → AuthService.dashboardsWithVisibleAnnotations()
        → DashboardService.SearchDashboards()
          → DashboardServiceImpl.FindDashboards()
            → searchDashboardsThroughK8sRaw()          [v12.3.2: always]
              → k8sHandler.Search() → searchWrapper.Search() → DashboardSearchClient.Search()
                → dashboardStore.FindDashboards()      [SQL query with permission filter]
    → xormRepositoryImpl.Get()                          [annotation SQL query]
```

## Root Cause 1: FORCE INDEX (IDX_dashboard_title) on MySQL

**File**: `pkg/services/sqlstore/searchstore/builder.go`

In v12.3.2 (commit `726c7ba71b7`, PR #110595):
```go
// Line ~140 in builder.go at v12.3.2
forceIndex := ""
if b.Dialect.DriverName() == migrator.MySQL {
    forceIndex = " FORCE INDEX (IDX_dashboard_title) "
}
b.sql.WriteString(fmt.Sprintf("SELECT dashboard.id FROM dashboard %s", forceIndex))
```

In v11.6.3: **This code does not exist.** MySQL's optimizer freely chooses the optimal index.

**Impact**: When the annotations endpoint checks "is this specific dashboard accessible?", the SQL should use the `dashboard.uid` unique index to find 1 row, then evaluate the permission subquery ONCE. With `FORCE INDEX (IDX_dashboard_title)`, MySQL must scan all rows via the title index and evaluate the expensive permission subquery against the 1.3M-row permission table for potentially every row.

**Introduced**: Commit `726c7ba71b7` (2025-09-05), present in v12.2.0+, v12.3.2
**Not in**: v11.6.3 (backported only to v11.6.6+)
**Fixed**: Commit `1da06fc1a99` (PR #119378, 2026-03-27), backported to v12.3.7 — makes FORCE INDEX conditional on config `[database] force_dashboard_title_index = true`

## Root Cause 2: K8s Search Path Always Active (Filters Lost in Translation)

**File**: `pkg/services/dashboards/service/dashboard_service.go`

In v11.6.3, `FindDashboards` checked a feature flag:
```go
// v11.6.3: line ~1252
if dr.features.IsEnabled(ctx, featuremgmt.FlagKubernetesClientDashboardsFolders) {
    // K8s path
    return dr.searchDashboardsThroughK8sRaw(ctx, query) // ... etc
}
return dr.dashboardStore.FindDashboards(ctx, query) // DIRECT SQL STORE
```

In v12.3.2, the feature flag check is removed — it always uses K8s:
```go
// v12.3.2: line ~1478
response, err := dr.searchDashboardsThroughK8sRaw(ctx, query) // ALWAYS K8s
```

**Impact**: The K8s path (`searchDashboardsThroughK8sRaw`) does NOT pass the caller's `query.Filters` (which include the permission filter and dashboard filter from the annotations accesscontrol code) into the gRPC request. The `Filters` field is simply ignored. The legacy searcher then creates a NEW query without those filters, and the SQL store adds its OWN permission filter.

Additionally, `TypeAnnotation` (which checks `annotations:read` action) is translated to `TypeDashboard` (which checks `dashboards:read` action) in the round-trip:

```go
// searchDashboardsThroughK8sRaw (v12.3.2, line ~2022)
case searchstore.TypeDashboard, searchstore.TypeAnnotation:
    request.Options.Key, err = resource.AsResourceKey(namespace, dashboardv0.DASHBOARD_RESOURCE)

// DashboardSearchClient.Search (legacy searcher, line ~90)
case dashboard.DASHBOARD_RESOURCE:
    queryType = searchstore.TypeDashboard  // TypeAnnotation is LOST
```

## Root Cause 3: Action Sets Always Included in Permission SQL

**File**: `pkg/services/sqlstore/permissions/dashboard.go`

In v11.6.3, action sets were conditional on a feature flag:
```go
// v11.6.3: line ~97
} else if queryType == searchstore.TypeAnnotation {
    dashboardAction = accesscontrol.ActionAnnotationsRead
    if features.IsEnabled(context.Background(), featuremgmt.FlagAccessActionSets) {
        folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
        dashboardActionSets = []string{"dashboards:view", "dashboards:edit", "dashboards:admin"}
    }
}
```

In v12.3.2, action sets are always included:
```go
// v12.3.2: line ~99 (using switch)
case searchstore.TypeAnnotation:
    dashboardAction = accesscontrol.ActionAnnotationsRead
    folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
    dashboardActionSets = []string{"dashboards:view", "dashboards:edit", "dashboards:admin"}
```

**Impact**: The permission subquery changes from:
- v11.6.3: `AND action = 'annotations:read'` (1 action)
- v12.3.2: `AND action IN ('dashboards:read', 'dashboards:view', 'dashboards:edit', 'dashboards:admin')` (4 actions, AND checking the wrong action type due to Type translation)

With LinkedIn's disabled action sets and 1.3M permission rows (mostly `dashboards:read` entries), this broadens the subquery scan significantly.

## Contributing Factor: xorm Reflection Overhead on Permission Loading

**File**: `pkg/services/accesscontrol/database/database.go`

In v12.3.2, `GetUserPermissions` uses xorm's `Find()`:
```go
// v12.3.2: line ~77
if err := sess.SQL(q, params...).Find(&result); err != nil { ... }
```

For users with thousands of permissions (action sets disabled → many individual rows), xorm's reflection-based scanning adds ~40ms per query for ~12k rows.

**Fixed in**: PR #119378 (raw row scanning with `rows.Scan`), backported to v12.3.7

## About PR #110911

PR #110911 ("Page limit config for dashboards with visible annotations") added a configurable `search_dashboards_page_limit` setting (default: 1000). This controls the page size when iterating through accessible dashboards in the annotation authorization loop. It does NOT fix the core performance regression — it optimizes a different scenario (stacks with >20k dashboards where pagination overhead is the bottleneck, not the per-query cost).

## The Annotation SQL Query Itself

The annotation SQL query (`xormRepositoryImpl.Get` in `pkg/services/annotations/annotationsimpl/xorm_store.go`) did NOT fundamentally change between versions. It uses `getAccessControlFilter` which simply applies an `IN` clause with pre-resolved dashboard UIDs/IDs:

- v11.6.3: `AND a.dashboard_id IN (1, 2, 3, ...)`
- v12.3.2: `AND a.dashboard_uid IN ('uid1', 'uid2', ...)` or `AND a.dashboard_uid = ?`

The regression is NOT in the annotation query itself but in the **authorization step** that determines WHICH dashboards the user can see.

## Fix Already Available

The performance improvements in PR #119378 (commit `1da06fc1a99`) address all three issues and were backported to **v12.3.7**. Upgrading from v12.3.2 to v12.3.7+ should resolve the regression. The key changes:
1. Made FORCE INDEX conditional on config
2. Optimized permission loading with raw row scanning
3. Added a new `(role_id, action)` index on the permission table via migration
