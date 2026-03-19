---
type: bugfix-spec
title: "Dashboard version history: fix pagination and v1/v2 merging in listDashboardHistory"
status: done
beads_id: grafana-d5l
created: 2026-03-19
---

# Dashboard version history: fix pagination and v1/v2 merging in listDashboardHistory

## Current Behavior

Dashboard version history is truncated for large dashboards (~3MB+ per version) in Grafana Cloud. Users see only 1-3 versions instead of the full history when viewing the version history settings page.

The backend unified storage server enforces a `MaxPageSizeBytes` limit of 2MB on history API responses (`pkg/storage/unified/resource/server.go:344`). When a single dashboard version exceeds ~2MB, only 1 entry fits per response page. The response includes a `metadata.continue` token for the next page, but the frontend `listDashboardHistory` method in both `K8sDashboardAPI` (v1.ts:233-240) and `K8sDashboardV2API` (v2.ts:183-190) makes a single request and returns the truncated result without following pagination.

Additionally, `UnifiedDashboardAPI.listDashboardHistory` (UnifiedDashboardAPI.ts:65-81) has three bugs in its v1/v2 merge logic:

1. **Bug A — Pure v2 dashboards show empty history**: The check `filteredV1Items.length === v1Response.items.length` (line 69) passes trivially when both values are 0 (no v1 items exist), causing the method to return an empty v1 response and skip the v2 fetch entirely. This means dashboards stored exclusively in v2 format display no version history.

2. **Bug B — Merge combines two truncated pages**: Neither the v1 nor v2 fetch within `UnifiedDashboardAPI.listDashboardHistory` performs pagination, so the merge combines two independently truncated result sets, producing an incomplete history.

3. **Bug C — v1 pagination state is lost on merge**: The spread `{ ...v2Response, items: merged }` (line 76-80) preserves only the v2 `metadata.continue` token. The v1 pagination state is discarded, which causes duplicate or missing entries if the caller attempts to paginate the merged result.

A related bug exists in `UnifiedDashboardAPI.listDeletedDashboards` (lines 105-123), which uses the identical v1/v2 merge pattern with the same three flaws.

## Expected Behavior

After the fix:

1. `K8sDashboardAPI.listDashboardHistory` and `K8sDashboardV2API.listDashboardHistory` MUST auto-paginate through all available pages (following `metadata.continue` tokens) and return the complete set of history entries, regardless of backend page size limits. The pagination loop MUST follow the same pattern used by `getDashboardHistoryVersions` (v1.ts:242-264, v2.ts:192-214).

2. `UnifiedDashboardAPI.listDashboardHistory` MUST return a complete history for pure v2 dashboards (where no v1 entries exist).

3. `UnifiedDashboardAPI.listDashboardHistory` MUST return a complete, deduplicated history when both v1 and v2 versions exist for a dashboard.

4. `UnifiedDashboardAPI.listDeletedDashboards` MUST be fixed with the same v1/v2 merge corrections applied to `listDashboardHistory`.

5. The `VersionsSettings` component (which already handles pagination via `continueToken`) MUST continue to function correctly. Since `listDashboardHistory` will now return all entries in one call, the component's pagination handling MUST NOT break (it will simply receive all items with no `metadata.continue` token on the first call).

## Unchanged Behavior

- The `DashboardAPI` interface (`types.ts`) and `ListDashboardHistoryOptions` type MUST NOT change their signatures.
- `getDashboardHistoryVersions` in both `K8sDashboardAPI` and `K8sDashboardV2API` MUST continue to function as-is (it already paginates correctly).
- `restoreDashboardVersion` in all API classes MUST continue to function as-is.
- `VersionsSettings` component pagination UI (the "Show more versions" button) MUST continue to work. If all versions are returned in one call, the button MUST simply not appear (existing behavior when `metadata.continue` is empty).
- The backend `MaxPageSizeBytes` limit MUST NOT be modified — this is a server-side constraint, not a bug.
- `saveDashboard`, `deleteDashboard`, `getDashboardDTO`, `restoreDashboard` methods across all API classes MUST NOT be modified.
- The `VERSIONS_FETCH_LIMIT` constant (10) MUST remain the per-page limit passed to the backend; the auto-pagination loop uses it as the page size for each individual request.

## Steps to Reproduce

### Bug 1: Truncated history (no auto-pagination)

1. Deploy Grafana with unified storage enabled (`kubernetesDashboards` feature toggle on).
2. Create a dashboard with a large JSON payload (~3MB+ per version) — for example, a dashboard with many panels containing large static data queries.
3. Save the dashboard 5+ times to create multiple versions.
4. Navigate to Dashboard Settings > Versions.
5. **Observed**: Only 1 version is displayed (the backend returned 1 item per 2MB page and a `continue` token, but the frontend did not follow it).
6. **Expected**: All 5+ versions are displayed.

### Bug 2A: Pure v2 dashboards show empty history

1. Deploy Grafana with `kubernetesDashboards` and `dashboardNewLayouts` feature toggles on, creating a unified API context.
2. Create and save a dashboard that is stored in v2 format only (no v1 conversion exists).
3. Save it multiple times to create version history.
4. Navigate to Dashboard Settings > Versions.
5. **Observed**: No versions are displayed — the v1 response returns 0 items, `0 === 0` evaluates to `true`, and the empty v1 response is returned without fetching v2.
6. **Expected**: All v2 versions are displayed.

### Bug 2C: Lost pagination state on merge

1. Deploy Grafana with `kubernetesDashboards` on but `dashboardNewLayouts` off (unified API, mixed v1/v2).
2. Have a dashboard with history entries in both v1 and v2 formats (e.g., dashboard was migrated from v1 to v2 at some point).
3. Navigate to Dashboard Settings > Versions and trigger pagination (click "Show more versions").
4. **Observed**: Duplicate entries appear because the merged response only carries the v2 `continue` token; the v1 pagination position is lost.
5. **Expected**: No duplicate entries; all versions from both formats are displayed correctly.

## Root Cause Analysis

**Bug 1 (Truncation)**: `K8sDashboardAPI.listDashboardHistory` (v1.ts:233-240) and `K8sDashboardV2API.listDashboardHistory` (v2.ts:183-190) each make a single `this.client.list()` call and return the result directly. When the backend's 2MB page size limit causes the response to be paginated (indicated by a non-empty `metadata.continue` token), the frontend ignores the token and returns only the first page. The correct pattern — a `do-while` loop that accumulates results until `continueToken` is undefined — already exists in `getDashboardHistoryVersions` in both files.

**Bug 2A (Empty v2 history)**: In `UnifiedDashboardAPI.listDashboardHistory` (line 69), the condition `filteredV1Items.length === v1Response.items.length` is intended to detect whether any v1 items failed v2 conversion (i.e., whether v2 entries exist). However, when a dashboard is pure v2, the v1 response contains 0 items, the filtered list also has 0 items, and `0 === 0` is `true`. The method returns the empty v1 response without ever querying v2.

**Bug 2B (Truncated merge)**: Even after fixing Bug 2A, neither the v1 nor v2 fetch within `UnifiedDashboardAPI.listDashboardHistory` paginates. Since both `this.v1Client.listDashboardHistory` and `this.v2Client.listDashboardHistory` return only one page, the merge combines two truncated result sets.

**Bug 2C (Lost v1 token)**: The merge result `{ ...v2Response, items: merged }` (line 76-80) spreads only the v2 response metadata. The v1 `metadata.continue` token is discarded. If the caller later paginates using the returned token, it resumes only the v2 stream, causing the v1 stream to restart from the beginning and produce duplicates.

Bugs 2B and 2C become moot once Bug 1 is fixed (both v1 and v2 clients will auto-paginate and exhaust all pages), but the merge logic still needs Bug 2A fixed so that pure v2 dashboards are handled. After auto-pagination is added to the underlying clients, the `UnifiedDashboardAPI` merge logic simplifies: both clients return complete result sets, so no pagination token merging is needed.

The same pattern of bugs exists in `UnifiedDashboardAPI.listDeletedDashboards` (lines 105-123).

## Acceptance Criteria

### Auto-pagination in K8sDashboardAPI and K8sDashboardV2API

- GIVEN a dashboard with 5 versions where each version exceeds 2MB
  WHEN `K8sDashboardAPI.listDashboardHistory(uid)` is called
  THEN the method MUST follow all `metadata.continue` tokens and return a `ResourceList` containing all 5 versions

- GIVEN a dashboard with 5 versions where each version exceeds 2MB
  WHEN `K8sDashboardV2API.listDashboardHistory(uid)` is called
  THEN the method MUST follow all `metadata.continue` tokens and return a `ResourceList` containing all 5 versions

- GIVEN a dashboard with 3 versions that all fit within one 2MB page
  WHEN `K8sDashboardAPI.listDashboardHistory(uid)` is called
  THEN the method MUST return all 3 versions in a single request (no unnecessary extra requests)

- GIVEN `listDashboardHistory` is called with `options.limit` set to 5
  WHEN the backend returns pages of 1 item each (due to size constraints)
  THEN the pagination loop MUST use the caller-specified limit as the per-request page size AND MUST continue until all pages are exhausted

### Pure v2 dashboard history (Bug 2A fix)

- GIVEN a dashboard stored exclusively in v2 format (v1 history response returns 0 items)
  WHEN `UnifiedDashboardAPI.listDashboardHistory(uid)` is called
  THEN the method MUST query the v2 client and return the v2 history entries

- GIVEN a dashboard stored exclusively in v1 format (no conversion failures in v1 response)
  WHEN `UnifiedDashboardAPI.listDashboardHistory(uid)` is called
  THEN the method MUST return the v1 history entries without querying the v2 client

### Mixed v1/v2 history merge (after auto-pagination)

- GIVEN a dashboard with history entries in both v1 and v2 formats
  WHEN `UnifiedDashboardAPI.listDashboardHistory(uid)` is called
  THEN the returned items MUST contain all valid v1 entries (excluding those that failed from v2) AND all valid v2 entries (excluding those that failed from v0/v1)

- GIVEN a dashboard with history entries in both v1 and v2 formats
  WHEN `UnifiedDashboardAPI.listDashboardHistory(uid)` is called
  THEN the returned `ResourceList` MUST NOT contain duplicate entries

### listDeletedDashboards fix

- GIVEN a pure v2 deleted dashboard (v1 trash response returns 0 items)
  WHEN `UnifiedDashboardAPI.listDeletedDashboards(options)` is called
  THEN the method MUST query the v2 client and return the v2 deleted dashboards

### VersionsSettings component compatibility

- GIVEN `listDashboardHistory` now returns all versions via auto-pagination
  WHEN the `VersionsSettings` component calls `listDashboardHistory`
  THEN the component MUST render all returned versions AND the "Show more versions" button MUST NOT appear (because `metadata.continue` is empty)

- GIVEN `listDashboardHistory` returns versions with `metadata.continue` still set (e.g., a non-auto-paginating code path)
  WHEN the user clicks "Show more versions"
  THEN the component MUST correctly append the next page of versions (existing behavior preserved)

### Test coverage

- WHEN the test suite for `K8sDashboardAPI` runs
  THEN there MUST be at least one test that verifies `listDashboardHistory` follows pagination tokens across multiple pages

- WHEN the test suite for `K8sDashboardV2API` runs
  THEN there MUST be at least one test that verifies `listDashboardHistory` follows pagination tokens across multiple pages

- WHEN the test suite for `UnifiedDashboardAPI` runs
  THEN there MUST be at least one test that verifies pure v2 dashboards return non-empty history

- WHEN the test suite for `UnifiedDashboardAPI` runs
  THEN there MUST be at least one test that verifies the v1/v2 merge produces a deduplicated result set

### Negative constraints

- The `DashboardAPI` interface in `types.ts` MUST NOT be modified.
- The `ListDashboardHistoryOptions` type MUST NOT be modified.
- The backend `MaxPageSizeBytes` (2MB) MUST NOT be modified.
- `getDashboardHistoryVersions` in `K8sDashboardAPI` and `K8sDashboardV2API` MUST NOT be modified (it already works correctly).
- The auto-pagination loop MUST NOT make unbounded concurrent requests — it MUST fetch pages sequentially (one at a time) to avoid overwhelming the backend.
