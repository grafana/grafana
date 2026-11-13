# Shard 3 performance audit

## Scope and evidence

Audit date: 2026-11-12.

The input is `shard3-summary.json.b64`, a base64-encoded JSON profile of the Happy DOM/Sucrase test run.
The profile covers all 366 selected suites, with four workers, a cold Jest cache, CPU sampling, and heap sampling.

| Revision                                | Value                                                                 |
| --------------------------------------- | --------------------------------------------------------------------- |
| Profile commit                          | `6a1c3b82a25bc7a17581dbf2a53ad4547f289fd8`, with a dirty working tree |
| Initial source review                   | `e534161c51608dea094db0b1009fa7b35a3f8358`                            |
| Implementation base after upstream sync | `6a1c3b82a25bc7a17581dbf2a53ad4547f289fd8`                            |

The run took **367.282 seconds**. Of 366 suites, 364 passed and two failed.
The failures came from `DashboardMigratorSingleVersion.test.ts` and `DashboardMigratorToBackend.devDashboards.test.ts`.
Their recorded bodies were small, so they do not explain the main hotspots. This is not a clean performance baseline.

### Cumulative phase times

| Phase                          | Time across all suites |
| ------------------------------ | ---------------------: |
| Module evaluation before tests |               427.09 s |
| Transformation before tests    |                95.47 s |
| Other pre-test work            |                 5.42 s |
| All pre-test work              |           **527.98 s** |
| Test bodies                    |           **245.80 s** |
| Hooks                          |                15.24 s |
| Framework work                 |                 9.77 s |
| Teardown                       |                 3.69 s |
| Profiler phase                 |               595.94 s |

These totals combine work across workers. They are not shard wall times or projected savings.
Profiler instrumentation overlaps other metrics. Subtracting its reported time does not give an uninstrumented runtime.

The summary does not contain raw module edges or module self-costs. Source inspection establishes the import chains, but not their exact marginal costs.
This profile alone cannot establish whether shard 3 is slower than other shards.

Local evidence files:

- `local/shard3-profile-analysis/summary.json`: decoded profile.
- `local/shard3-profile-analysis/expanded.json`: expanded profile tables.
- `local/shard3-profile-analysis/feature-flag-leaf-candidates.json`: 27 flag-only import candidates.
- `local/shard3-profile-analysis/regex-fixture-benchmark.json`: standalone fixture benchmark.

The profiler format and timing semantics are documented in `scripts/test-harness/profiling/shard-profiler/README.md`.

## Approved implementation

This batch covers items 1–5. It preserves tested behavior, existing assertion intent, and fresh mutable state between tests.
It does not change production code, dependencies, the test environment, or the compiler.
Timestamp paste remains a future refactor at the user's request.

### 1. Use a deterministic large regex fixture

Location: `public/app/core/services/echo/backends/grafana-javascript-agent/GrafanaJavascriptAgentBackend.test.ts`.

The `TRACKING_URLS` performance test generates 10 million random characters with an array and then joins the array.
The body takes 4.262 s. CPU samples attribute 3.192 s to character generation.
Generation happens before the timed regex section.

The replacement repeats a fixed alphanumeric alphabet and keeps the exact input length.
The test retains the real regex scan and the 500 ms assertion.

A standalone Node 26.13.0 comparison produced these results:

| Operation          | Random array | Deterministic alphabet |
| ------------------ | -----------: | ---------------------: |
| Fixture generation |   3377.59 ms |                1.44 ms |
| Regex scan         |     10.53 ms |                5.50 ms |

Both inputs had 10 million characters and matched none of the patterns.
This measurement is not a Jest or shard speedup measurement.

### 2. Import feature flags from the existing leaf entry

The audit found 27 suites that import only flag utilities from `@grafana/test-utils/unstable`.
The existing `@grafana/test-utils/feature-flags` entry exposes the same implementations directly.

The broad barrel also exports MSW handlers and fixtures. The feature-flags module imports only the OpenFeature SDK.
The change applies to `setTestFlags`, `testWithFlags`, and `getTestFeatureFlagClient`.

The affected suites total 70.266 s of pre-test work. This is not a savings estimate because other imports can require the same modules.
For example, `panelCommands.test.ts` records 8.031 s before tests, 0.379 s in bodies, and 4,180 unique modules.

### 3. Replace implicit automocks with explicit factories

The existing mocks remain in place. Explicit factories avoid real module evaluation solely for Jest's export discovery.

| Location                                                                      | Factory exports                                      | Profile evidence                                                          |
| ----------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `public/app/features/alerting/unified/components/rules/GrafanaRules.test.tsx` | `useHasRuler`, `useHasRulerV2`                       | 4.332 s pre-tests, 5,705 unique modules, 8,493 evaluations                |
| `public/app/features/plugins/admin/mocks/mockHelpers.ts`                      | `isGrafanaAdmin`, `isOrgAdmin`, `isDataSourceEditor` | PluginDetails: 3.637 s pre-tests, 5,160 unique modules, 6,626 evaluations |

Each export remains a `jest.fn()`. Existing return-value setup and permission scenarios remain unchanged.
The permissions helper is shared, so validation includes its other test consumers.

These pre-test totals are not estimates of removable work.

### 4. Isolate dashboard search modules only for the 404 case

Location: `public/app/features/commandPalette/actions/dashboardActions.test.ts`.

Six endpoint-availability cases reload modules in `beforeEach` with `jest.isolateModules`.
Only the 404 case sets the page-lifetime disable latch that needs fresh module state.
The five retry cases can use the existing import of `getSearchResultActions`.

The 404 case retains isolated loading, real search clients, and shared service references.
All cases retain fresh stores, console-spy cleanup, request-count assertions, and recovery assertions.
A shared isolated instance is not safe because the 404 case can disable later requests.

The suite records 4,352 unique modules and 11,548 evaluations.
The five retry hooks total 0.972 s. This total bounds the local opportunity, not the shard speedup.

### 5. Combine equivalent initial-state page assertions

Location: `public/app/features/browse-dashboards/BrowseDashboardsPage.test.tsx`.

Eight root-page cases and eight child-folder cases each mount the same page without state-changing actions.
One initial-state case per context reduces those mounts from 16 to two.
The original 16 bodies total 7.607 s. The whole suite records 18.12 s in bodies.

The combined cases retain the distinct assertions for:

- Page title, search input, creation controls, and recently deleted navigation.
- Folder actions and title editing.
- Folder tabs and their selected state.
- Filters and the absence of selection actions.
- Star-toggle ordering before the recently deleted link.

Positive loaded-state assertions precede absence checks.
Permission variants, selection, navigation, ownership, feature flags, and URL cases stay separate.
Each independent test retains its own mounted page.

## Deferred work

### Timestamp paste

Location: `public/app/core/components/TimePicker/TimePickerWithHistory.test.tsx`.

Four tests enter 18 timestamps of 19 characters each, for 342 character-entry steps.
Their bodies total 4.675 s. The five-range history case takes 2.452 s.

These tests cover storage, deduplication, ordering, time zones, and format rather than incremental typing.
A future refactor can use per-test `userEvent.setup()` and paste complete timestamps.
It must retain Apply clicks, duplicate submissions, reopening, and all history insertions.
Preseeded storage cannot replace the operations under test.

Explore query-history tests have a similar, lower-confidence opportunity.
Their bodies also include page loading, persistence checks, and a real debounce.
Any change must preserve the unmount/reopen persistence case and avoid unrelated shared-helper consumers.

### Separate logs-model helpers from rendering utilities

`public/app/features/logs/logsModel.ts` imports four helpers from `logs/utils.ts`:
`createLogRowsMap`, `getLogLevel`, `getLogLevelFromKey`, and `sortInAscendingOrder`.

That utility module imports `LogsTable.tsx` and inspector download utilities.
Those dependencies load rendering components and trace-format transformations.
A non-rendering helper module can remove this dependency path.
The pure `getLogsExtractFields` function can also move out of `LogsTable.tsx`.

`logsModel.test.ts` records 4.546 s before tests, 0.111 s in bodies, and 2,942 unique modules.
The model independently imports UI colors, so this change does not remove all UI dependencies.
Flag-gated level inference, nanosecond ordering, and row identity must remain unchanged.

### Separate dashboard layout helpers

These production modules import `getTestIdForLayout` from `dashboard-scene/utils/test-utils.ts`:

- `public/app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager.tsx`
- `public/app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutRenderer.tsx`

That test-helper module imports dashboard loading, layout classes, repeaters, and conversion code.
`panelCommands.test.ts` also imports the module for `activateFullSceneTree`.

A future change can move `getTestIdForLayout` to a production helper and `activateFullSceneTree` to a narrow test helper.
Changing only the test import leaves the production dependency path intact.
Activation order, variable-first setup, width, deactivation, and selectors must remain unchanged.

### Lower-priority or unsuitable shortcuts

- `GrafanaRules` constructs three stores per test. Passing the actual store to the render helper can remove one redundant store.
- `getAllSuggestions.test.ts` spends 94.8% of its hook time on cold plugin imports and transformation, not repeated fixture construction.
- `NotificationPoliciesPage` records 32.135 s in bodies. Its integration variants cover distinct fetch paths, URL handling, and write routing.
- TableNG's large JSON case includes lazy module loading. A smaller regression fixture or mocked inspector can weaken its large-input coverage.
- FlameGraph and query-coauthoring suites have no established small, high-confidence change from this audit.

## Validation record

Items 1–5 are implemented. Timestamp paste and the broader helper extractions remain deferred.
The patch changes 30 test files and one shared test helper. It makes no production-code changes.

### Targeted results

| Group                                                               | Suites | Passed tests |
| ------------------------------------------------------------------- | -----: | -----------: |
| Regex fixture, BrowseDashboards, dashboard search, and GrafanaRules |      4 |           65 |
| Other feature-flag import consumers                                 |     26 |          432 |
| Shared permissions mock consumers                                   |     12 |          248 |
| **Total**                                                           | **42** |      **745** |

All targeted suites passed, with no failed, skipped, or todo tests.
The baseline runs also passed: eight regex tests, 33 BrowseDashboards tests, and 36 dashboard-search tests.

The BrowseDashboards suite now contains 19 tests instead of 33.
A source comparison found all 39 distinct assertion expressions in both versions.
Only repeated initial-state renders and duplicate assertions were removed.
The timestamp-entry file remains unchanged.

### Local timing observations

| Work                                  |                   Before |                     After |
| ------------------------------------- | -----------------------: | ------------------------: |
| Regex performance-test body           |                 3,856 ms |                     11 ms |
| BrowseDashboards initial-state bodies | 8,850 ms across 16 tests | 1,997 ms across two tests |
| All BrowseDashboards bodies           |                19,513 ms |                 13,602 ms |

These are single local samples. Cache warmth and run order differ, so they are not controlled benchmark results.
No full-shard speedup is measured. Module-import savings still need a controlled profile comparison.

### Validation environment and limits

After a machine crash, each suite ran in a separate, serial Jest process with `--runInBand` and a 1 GB JavaScript heap limit.
The largest reported JavaScript heap was 544 MB. This metric is not total process memory.
Jest caches used `/tmp`, outside the nearly full repository filesystem.

The runs used Node 26.13.0, Happy DOM, Sucrase, and CI console-error checks.
Existing local preloads applied the repository's Happy DOM and Sucrase patches without changing installed dependencies.
The existing local configuration supplied a resolution-only Mermaid stub for mocked imports.
The stub throws if a test tries to use the real module.

Jest reported an existing duplicate manual-mock warning for two files named `fixtures`.
No test failed because of that warning.
Prettier and `git diff --check` passed for this patch.
Full typecheck and ESLint were not available in the local dependency installation.
No full shards, installs, dependency changes, commits, or pushes were performed for this batch.

Local result files and the serial runner are in `local/shard3-optimization/`.
The group summaries are `core-0-end-summary.json`, `flags-0-13-summary.json`, `flags-13-26-summary.json`, and `consumers-0-end-summary.json`.
