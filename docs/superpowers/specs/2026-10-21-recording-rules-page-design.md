# Recording Rules Page — Design Spec

**Date:** 2026-10-21
**Issue:** grafana/alerting-squad#2281
**Branch:** `cb/gma-list-recording-rules-page`
**Depends on:** grafana/grafana#135568 (Alert rules page by Konrad)

## Goal

Add a minimal Recording rules list page at `/alerting/rules/recording` behind the `alerting.gmaOnlyListView` feature flag. The page lists GMA recording rules from `searchRecordingRules`, mirrors the Alert rules page structure, and reuses all existing shared components without modification.

## Scope

**In scope:**

- List view with title, status icon, and folder path per row
- Status icon: `Recording` health → Recording; `Error` → Failed; `NoData` → Insufficient data; `paused` → Paused; absent or `Unknown` → Status unavailable
- Result count: "1 recording rule" / "4 recording rules"
- Loading skeleton, empty state, inline error with Retry, Load more with Retry

**Out of scope (later PRs):**

- Recorded metric and target datasource in row
- Search, filters, Folders mode, sidebar
- Actions (Edit, Pause, Delete, etc.)
- Recently deleted, redirects, saved searches

## Approach

Direct mirror of `alert-rules/` with minimal diffs. No new abstractions. The shared pieces (`RuleStatusIcon`, `ResultCount`, `mocks/handlers`) already support `kind: 'recording'` and require no changes.

## File Structure

All new files live in `gma-rule-list/recording-rules/`.

### `recordingRuleSearchHit.ts`

Defines `RecordingRuleSearchHit` — same shape as `AlertRuleSearchHit` minus `state`. Health type is `RecordingRuleRecordingRuleHealth` (`'Unknown' | 'Recording' | 'Paused' | 'Error' | 'NoData'`). Maps from `ListRecordingRuleSearchRulesV0Alpha1SearchResultHit`.

### `recordingRuleSearchQuery.ts`

Builds the POST body for `searchRecordingRules`. Fields: `['title', 'folder', 'paused', 'health']` — no `state` (recording rules have no alert state). Sort by title asc, limit 40.

### `recordingRuleSearch.ts`

Infinite query wrapping `searchRecordingRules` via `generatedAPI.injectEndpoints`. Provides `RecordingRule` tag so later mutations invalidate the list. Exposes `useRecordingRuleSearch()` returning the same `PagedResult<RecordingRuleSearchHit> & { total?: ResultTotal }` shape as the alert rules hook.

### `RecordingRuleRow.tsx`

Presentation-only row. Passes `kind="recording"` and `health`/`paused` to `RuleStatusIcon` — no `state` prop. Title links to the rule view via `grafanaRulesNav.viewLink(uid)` (same URL pattern as alert rules). Shows `FolderPath` when available.

### `RecordingRuleListEntry.tsx`

Runs `useFolderPath(hit.folderUid)` then renders `RecordingRuleRow`. Identical pattern to `AlertRuleListEntry`.

### `RecordingRulesListView.tsx`

Same loading/error/empty/list structure as `AlertRulesListView`. Uses `kind="recording"` on `ResultCount`. Empty state message: "No recording rules found".

### `RecordingRulesPage.tsx`

Wraps `RecordingRulesListView` in `AlertingPageWrapper` with `navId="recording-rules"`. Tracks `'recording'` page view via `useTrackRuleListPageView`. Exported via `withPageErrorBoundary`.

### `routes.tsx` (modified)

Adds `/alerting/rules/recording` route inside the existing `shouldUseGmaOnlyListView()` block, same `AccessControlAction.AlertingRuleRead` permission, chunk name `GmaRecordingRulesPage`.

## Tests

| File                               | Coverage                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recordingRuleSearchHit.test.ts`   | Field mapping from API hit; unknown health falls through correctly                                                                                                |
| `recordingRuleSearchQuery.test.ts` | Correct fields (no `state`); continuation token passthrough                                                                                                       |
| `RecordingRulesListView.test.tsx`  | MSW integration: rows, count, loading, empty, inline error + Retry, Load more, Load more Retry, token restart on 400/410/422, double-click guard, page view event |
| `RecordingRulesPage.test.tsx`      | Route guard: flag off → absent; flag on + no permission → absent; flag on + permission → present                                                                  |
