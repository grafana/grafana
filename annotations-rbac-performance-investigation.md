# Annotations RBAC Performance Regression: v11.6.x → v12.3.x

## Executive Summary

The GET `/api/annotations` endpoint's dramatic slowdown (P50 ~60ms → ~27s) between Grafana v11.6.x and v12.3.x is caused by a **fundamental change in how RBAC permission checks are performed during dashboard visibility evaluation** in the annotations authorization path.

In v11.6.x, dashboard permissions were checked via **SQL-level subqueries** embedded in the dashboard search query, allowing MySQL to efficiently use indexes on the `permission` table. In v12.3.x, the SQL-based dashboard search was replaced by a **K8s/bleve search** path with **application-level BatchCheck** authorization, which loads **all user permissions for the action into Go memory** before checking each document. For orgs with 1.3M+ permission rows, this means a single SQL query must scan and return hundreds of thousands of rows, taking ~25+ seconds per uncached evaluation.

## Root Cause

### The Breaking Change: K8s Search Replaces SQL Dashboard Search

**Commit:** `1f025fe1a38` — "K8s: Remove kubernetesClientDashboardsFolders feature flag" (PR [#108626](https://github.com/grafana/grafana/pull/108626))
**First Release:** v12.2.0

This commit removed the `kubernetesClientDashboardsFolders` feature flag, making the K8s/bleve-based dashboard search the **only** path. In v11.6.x, this flag was `FeatureStageExperimental` (disabled by default), so the SQL-based search path was used.

### The Authorization Code Path

**File:** `pkg/services/annotations/annotationsimpl/annotations.go` — `RepositoryImpl.Find()`

```
GET /api/annotations?dashboardUID=...
  → RepositoryImpl.Find()
    → authZ.Authorize(query)
      → dashboardsWithVisibleAnnotations(query)
        → dashSvc.SearchDashboards(query)
          → FindDashboards(query)
```

This `FindDashboards` is where the two versions diverge:

#### v11.6.x Path (SQL-based, fast)

```
FindDashboards()
  → dashboardStore.FindDashboards()  [SQL search store]
    → SQL query with embedded permission subqueries
```

**File:** `pkg/services/sqlstore/permissions/dashboard.go` — `buildClauses()`

The permission check was an **SQL subquery** within the dashboard search:

```sql
dashboard.uid IN (
  SELECT identifier FROM permission
  WHERE kind = 'dashboards' AND attribute = 'uid'
    AND role_id IN (SELECT id FROM role ...)
    AND action IN ('dashboards:read', ...)
)
```

MySQL could efficiently evaluate this using indexes — for a specific `dashboardUID`, it's essentially a point lookup against the permission table.

#### v12.3.x Path (K8s/bleve search + BatchCheck, slow)

```
FindDashboards()
  → searchDashboardsThroughK8sRaw()  [K8s search]
    → k8sclient.Search()  [gRPC]
      → searchServer.Search()
        → bleveIndex.Search()
          → batchAuthzSearcher  [RBAC filter per document]
            → FilterAuthorized()
              → BatchCheck()  [authz gRPC]
                → getUserPermissions()
                  → SQL: SELECT FROM permission WHERE action IN (7 actions)
```

**Critical files:**
- `pkg/storage/unified/search/bleve.go:3530-3760` — `batchAuthzSearcher` implementation
- `pkg/services/authz/rbac/service.go:722-764` — `getUserPermissions()`
- `pkg/services/authz/rbac/store/permission_query.sql` — the SQL template

The `getUserPermissions` executes this SQL:

```sql
SELECT p.kind, p.attribute, p.identifier, p.scope
FROM permission AS p
INNER JOIN (
  SELECT role_id FROM builtin_role WHERE ...
  UNION ALL SELECT role_id FROM user_role WHERE ...
  UNION ALL SELECT role_id FROM team_role WHERE ...
) AS roles ON p.role_id = roles.role_id
WHERE p.action IN (
  'dashboards:read', 'dashboards:view', 'folders:view',
  'dashboards:edit', 'folders:edit', 'dashboards:admin', 'folders:admin'
)
```

With 1.3M permission rows and 7 action values, this query scans a massive portion of the table and returns all matching permissions into Go memory, regardless of which specific dashboard is being checked.

### Why Concurrent Load Makes It Worse

**Cache TTL:** The permission cache (`permCache`) has a default TTL of **30 seconds** (configurable via `[authorization] cache_ttl`).

**Singleflight:** `getUserPermissions` uses singleflight, so concurrent identical requests share one DB query. But ALL concurrent requests **wait** for that single query to complete.

Under the stress test (20 parallel requests):
1. First request triggers the expensive permission query (~27s for 1.3M rows)
2. All 19 other concurrent requests join the singleflight, waiting
3. After ~27s, ALL 20 requests complete nearly simultaneously → P50 ≈ P99 ≈ 27s
4. Result is cached for 30 seconds
5. After cache expires, the next request triggers another ~27s query

With continuous load, the system oscillates between ~27s query execution and brief cache-hit windows, resulting in consistently high P50 latency.

## Detailed Code Diff Between Versions

### Key File: `pkg/services/annotations/accesscontrol/accesscontrol.go`

#### v11.6.3 — `dashboardsWithVisibleAnnotations()`
```go
func (authz *AuthService) dashboardsWithVisibleAnnotations(...) {
    recursiveQueriesSupported, err := authz.db.RecursiveQueriesAreSupported()
    filters := []any{
        // SQL-level permission filter — generates subqueries on the permission table
        permissions.NewAccessControlDashboardPermissionFilter(
            query.SignedInUser, dashboardaccess.PERMISSION_VIEW,
            filterType, authz.features, recursiveQueriesSupported, authz.db.GetDialect(),
        ),
        searchstore.OrgFilter{OrgId: query.OrgID},
    }
    dashs, err := authz.dashSvc.SearchDashboards(ctx, &dashboards.FindPersistedDashboardsQuery{
        Filters:  filters,  // ← These SQL filters were used by the SQL search store
        ...
    })
}
```

#### v12.3.2 — `dashboardsWithVisibleAnnotations()` (same file, same function)
```go
func (authz *AuthService) dashboardsWithVisibleAnnotations(...) {
    // SAME CODE as v11.6 — still passes Filters with NewAccessControlDashboardPermissionFilter
    // BUT: FindDashboards() now always goes through K8s search, which IGNORES Filters
    filters := []any{
        permissions.NewAccessControlDashboardPermissionFilter(...),
        searchstore.OrgFilter{OrgId: query.OrgID},
    }
    dashs, err := authz.dashSvc.SearchDashboards(ctx, &dashboards.FindPersistedDashboardsQuery{
        Filters:  filters,  // ← DEAD CODE: K8s search ignores these entirely
        ...
    })
}
```

### Key File: `pkg/services/dashboards/service/dashboard_service.go`

#### v11.6.3 — `FindDashboards()`
```go
func (dr *DashboardServiceImpl) FindDashboards(...) {
    // Feature flag check determines which path
    if dr.features.IsEnabled(ctx, featuremgmt.FlagKubernetesClientDashboardsFolders) {
        return dr.searchDashboardsThroughK8sRaw(ctx, query)  // K8s path (ignores Filters)
    }
    return dr.dashboardStore.FindDashboards(ctx, query)  // SQL path (uses Filters)
}
```

#### v12.3.2 — `FindDashboards()`
```go
func (dr *DashboardServiceImpl) FindDashboards(...) {
    // Feature flag REMOVED — always K8s path
    response, err := dr.searchDashboardsThroughK8sRaw(ctx, query)  // ONLY path
    // query.Filters is never read
}
```

## Timeline of Changes

| Version | Commit | Change | Impact |
|---------|--------|--------|--------|
| v11.6.x | — | `KubernetesClientDashboardsFolders` is experimental (off) | SQL search with embedded permission subqueries |
| v12.2.0 | `1f025fe1a38` | Feature flag removed; K8s search is the only path | **Filters field becomes dead code**; RBAC via BatchCheck |
| v12.3.x | — | Same as v12.2.0 | Same regression |
| v13.1.0 | `64d6656f4c6` | Dead Filters code explicitly removed | Cleanup only, no behavioral change |

## PR #110911 Clarification

PR [#110911](https://github.com/grafana/grafana/pull/110911) ("Page limit config for dashboards with visible annotations") is **not** about "optimized group scopes by action". It added the `search_dashboards_page_limit` config option to control the page size used when querying dashboards for annotation authorization. While relevant to annotation performance (reducing pagination overhead), it does **not** address the core RBAC performance issue described here.

## Assessment

The annotations endpoint slowdown is **directly caused** by:

1. **Architectural change:** SQL-level permission filtering (efficient indexed subqueries) was replaced by application-level BatchCheck (loads all permissions into memory).

2. **Scale sensitivity:** The BatchCheck approach loads ALL permissions for 7 different actions for the user's roles. With 1.3M permission rows, this is a ~25-27s query.

3. **Cache dynamics:** The 30-second default cache TTL means the expensive query re-executes frequently under sustained load. Singleflight prevents duplicate queries but causes all concurrent requests to wait for the single slow query.

4. **MySQL CPU contention:** The expensive permission query saturates MySQL CPU, slowing all concurrent queries including the annotation fetch itself.

## Potential Mitigations

1. **Increase cache TTL:** Setting `[authorization] cache_ttl = 5m` (or higher) would reduce the frequency of expensive permission queries. Trade-off: permission changes take longer to take effect.

2. **Optimize the permission SQL query:** Add better indexes on the `permission` table for the `(action, role_id)` combination. Consider partitioning or materialized views for large permission tables.

3. **Reduce action set expansion:** The 7-action IN clause (`dashboards:read` + 6 action sets) scans far more rows than necessary. For annotation-scoped checks where only view permission matters, limiting to fewer actions would help.

4. **Short-circuit for specific dashboard UID:** When `dashboardUID` is specified, avoid the full K8s search + BatchCheck. Instead, do a targeted permission check for that single dashboard, similar to the old SQL subquery approach.

5. **Restore SQL-level permission filtering:** For the annotations path specifically, consider bypassing the K8s search and using direct SQL permission checks when evaluating dashboard visibility.
