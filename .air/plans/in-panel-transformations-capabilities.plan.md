> Full plan written to `/Users/galen/.claude/plans/ideate-on-additional-capabilities-groovy-turing.md`

# In-panel transformations: capability catalog, API gaps, and phases 7–9

## Context

Branch `gtk-grafana/dataviz/ad-hoc-transforms-poc__2-ui-hooks` has landed the plumbing for panels to own their transformation pipeline. Phases 4–6 spend it on the table panel and logstable. **No panel sets `adHocTransforms: true` yet** — which makes now the last cheap moment to change the API's shape, since there is exactly one consumer to migrate.

This document is grounded in three research passes: GitHub issue demand, actual transformation usage in every dashboard JSON in the repo, and a code audit of what can be reused. Scope excludes the logstable replacement.

The headline finding is uncomfortable: **two of the highest-evidence capabilities argue against using this API at all**, and the largest problem with the current design is not a missing feature.

## Evidence summary

Demand is a long tail — 697 issues carry `area/transformations` and the highest-reaction **open** feature request has only **16** reactions. Panel label intersections: table 30, timeseries 16, all others combined 12, **piechart 0**.

Loudest relevant asks: #25469 (119, view-time transformation params), #17245 (115, sort series in Gauge/BarGauge/Stat), #24092 (103, hide fields but keep data links), #22360 (75, alias regex), #35429/#18186/#73442 (53/38/29, sort from legend), #99450 (32), #3551 (27), #16276 (17), #29393 (16, pivot), #37948 (14).

The best single citation is **Discussion #43479**, where a viewer asks verbatim whether transformations are available to "the end user viewing the dashboard… select the table fields and order dynamically when needed." Never answered; closed Feb 2024.

**Persistence is a known trap from both directions.** Legend-click hide already writes a field override and has a standing complaint cluster (#95628 _"confusing UX for most engineers"_, #52925, #33261, #46273, #49005). The mirror cluster says local-only state is also wrong (#25615, #14787, #35296).

**Searches that came back empty, reported honestly:** no Top-N request exists; `"hide column"` maxes at 5 reactions; and all 212 `viewer in:title` issues are about _restricting_ viewers (#30552, #1826).

**Repo usage contradicts Grafana's own curation.** `organize` is the runaway #1. Real-world Azure dashboards are fixed recipes (`organize > sortBy > rowsToFields` ×~92). But **`groupBy` has zero occurrences in any dashboard in the repo**, despite being in the hard-coded top-4 at `EmptyTransformationsMessage.tsx:35-40`.

**Strategy conflict:** `EmptyTransformationsMessage.tsx:138-150` promotes a SQL Expressions card _above_ the transformation cards — Grafana's current answer to transformation complexity is "write SQL."

## Five structural findings (verified in code)

**F1 — One flag conflates "may write" with "must execute."** `isAdHocTransformsEnabled()` gates both `useAdHocTransformations().enabled` and host bypass (`adHocTransformations.ts:24-36,107`). A panel wanting only a "Sort" menu item must also take over pipeline execution, field config, and `structureRev`. Every capability below except the phase-5 field selector is write-only. Highest-leverage fix in the document.

**F2 — Append-last breaks the loudest use case.** `sortBy` sorts **rows within a frame** (`sortBy.ts:45-53`); it cannot reorder fields. #17245 is realised as `organize > sortBy > rowsToFields`, where `sortBy` must run _before_ `rowsToFields`. An appended `sortBy` does nothing. The 115-reaction issue is two fixes, not one.

**F3 — #24092's fix is field config, not a transformation.** `getVisibleFields` already filters on `custom.hideFrom.viz` (`TableNG/utils.ts:1032-1034`), with a migration from `custom.hidden`. So **phase 4's planned `organize.excludeByName` is the destructive mechanism** — `organize` composes `filterFieldsByNameTransformer` (`organize.ts:35-46`), removing the field and breaking exactly the data links #24092 asks to preserve.

**F4 — View mode is accidentally ephemeral, and entering edit mode is broken.** `startTrackingChanges()` only runs in edit mode (`DashboardScene.tsx:248,433`), so view-mode writes are silent and lost. Then `onEnterEditMode` captures `_initialState` at line 424 _after_ the write while `detectSaveModelChanges` compares to `getInitialSaveModel()` — the dashboard goes dirty on clicking Edit and **Discard won't revert it**. #95628 reproduced structurally.

**F5 — Panel writes bypass the undo stack.** `setTransformations` calls `transformer.setState()` directly, not `dashboardEditActions.edit({ perform, undo })` (`sidebar/shared.ts:172`).

**Bonus:** `onAddAdHocFilter` doesn't no-op when unsupported — `getAdHocFilterVariableFor` _creates_ a dashboard `Filters` variable, which marks the dashboard dirty. A viewer's table click already mutates persisted state today.

## Ranked capability catalog

Score = (evidence × reuse) ÷ effort. Ranked on merit regardless of panel.

| #   | Capability                                         | Ev. | Reuse | Eff.      | Verdict                                          |
| --- | -------------------------------------------------- | --- | ----- | --------- | ------------------------------------------------ |
| 1   | Presentation-only column hide (#24092)             | 4   | 5     | S         | **Build — field config, not this API**           |
| 2   | "Fix my data": suggestions apply transformations   | 3   | 5     | S         | **Build first**                                  |
| 3   | `onTransformationError` + provenance               | 3   | 5     | S         | **Build — prerequisite**                         |
| 4   | Sort from header / legend (`sortBy`), scoped       | 5   | 4     | S/M       | **Build, scoped**                                |
| 5   | Ephemeral + URL tier (infra)                       | 5   | 3     | M         | **Build — unblocks 4, 7, 8, 10**                 |
| 6   | View-time params on author-marked configs (#25469) | 5   | 3     | M/L       | **Strongest unlisted idea — flag, don't commit** |
| 7   | Generic panel-filtered pipeline surface            | 3   | 5     | M         | Build after 5, gated                             |
| 8   | Pivot / `groupingToMatrix` / `transpose`           | 2   | 4     | S _via 7_ | Free via 7; never bespoke                        |
| 9   | Drag-to-reorder → `organize.indexByName`           | 2   | 4     | M         | Defer (#8637 has 1 reaction)                     |
| 10  | Per-column filter → `filterByValue`                | 2   | 3     | M         | **Reframe or cut**                               |
| 11  | Consumer-adjustable `limit` / Top-N                | 1   | 5     | S _via 7_ | Free via 7; no bespoke build                     |
| 12  | In-panel `groupBy` picker                          | 1   | 4     | M         | **Cut**                                          |

Highlights:

- **#2 rests on three verified dead code paths**, not user demand: `VisualizationSuggestion.transformations` exists (`suggestions.ts:64-65`) and no panel sets it; `loadSuggestion` never applies it (`PanelDataErrorView.tsx:78-99`); `getPrepareTimeseriesSuggestion` uses the legacy dashboard service and is **dead in scenes** — while the working scenes lookup sits 100 lines away at `PanelDataErrorView.tsx:40-46`.
- **#4 reuses a second dead hook**: `onToggleLegendSort` is declared at `PanelContext.ts:131` and consumed at `VizLegend.tsx:38,123`, but no host implements it. Scope per F2 — **do not claim #17245 is closed.**
- **#7 is near-zero new code**: `TransformationsDrawer` needs one `allowedIds` prop; `TransformationPickerNg` already takes `xforms` as a prop; `TransformationCard` already renders `isApplicable` greying. Must **not** move to `@grafana/ui` — the registry is populated by app code and would be empty in Storybook.
- **#10 reframed**: `filterByValue`'s options shape can't express TableNG's `searchFilter`/cross-filter state. The valuable feature is giving the existing `useFilteredRows`/`useSortedRows` a URL tier (`TableNG/hooks.ts:58,97,164`). Keep the framing though — `filterByValue` is the post-query, per-panel, datasource-agnostic complement to 13.1's unified drilldown (pre-query, all-panels, Prom/Loki only).

## Persistence: three tiers

Default for every view-mode gesture is **Tier 1**, never Tier 2.

**Tier 0 — Ephemeral.** State must _not_ live in `SceneDataTransformer.state.transformations` — both serializers and the change tracker read it. Mechanism: a new `AdHocTransformationsBehavior extends SceneObjectBase` on `VizPanel.$behaviors`. Two verified properties make this exact: `$behaviors` are never serialized _from_ state; and `isUpdatingPersistedState` falls through to `return false` for unknown classes (`DashboardSceneChangeTracker.ts:168`), so it is **automatically invisible to dirty-tracking**. Rejected `instanceState` — already carries options-pane state.

**Tier 1 — URL-shareable.** `SceneObjectUrlSyncConfig` on the same behavior, using the dynamic-key pattern from `TabsLayoutManager.tsx:76` for panel scoping (`_adhoc.<pathId>`, from `getPathId()`). Cap at ~1.5 KB, degrade to Tier 0 rather than truncate.

**Tier 2 — Persisted.** Two mandatory changes: gate on `canEditDashboard() && state.isEditing` (both — `isEditing` is what eliminates F4), and route through `dashboardEditActions.edit({ perform, undo })`.

`getTransformations()` returns the **effective** merged pipeline, so `useTransformedData` needs no change — only writers learn about tiers.

**This reconciles #95628 with #43479**: view-mode gestures land in Tier 1; Tier 2 requires edit mode plus explicit "Save to panel." It also rescues `origin: { source: 'panel' }` from becoming the next `hideSeriesFrom` (note the parallel with `__systemRef` at `SeriesVisibilityConfigFactory.ts:16-17`).

**One-line fix worth landing regardless:** gate the setter on `canEditDashboard()` (`setDashboardPanelContext.ts:143-145`); leave the getters ungated.

## API gap spec

- **G1** — `adHocTransforms: { own?, write?, ids? }`, legacy `true` ≡ `{ own: true, write: true }`. Write-only capabilities become ~10 LOC instead of full bypass adoption. Threads the same seven layers already touched.
- **G2** — `{ position: 'prepend' | 'append' | { before: DataTransformerID } }` on `add`/`replaceAdHoc`. Not the closed merge question — ordering. F2 and phase 6 both demand it.
- **G3** — static `adHocTransforms.ids` so a surface doesn't render all 34.
- **G4** — `getApplicableTransformations(data, ids?)` in `@grafana/data`; de-duplicates `TransformationCard.tsx:40-53`. **Caveat:** `organize.isApplicable` returns `NotPossible` for `data.length > 1` (`organize.ts:26-30`) — phase 5's multi-frame field selector must relax it.
- **G5** — ephemeral tier on the context.
- **G6** — `onTransformationError`; `useTransformedData.ts:29-33` documents its own blind spot.
- **G7** — append-never-merge **does not hold** for a per-keystroke filter: needs the ephemeral tier (churn), the F5 undo fix, and the existing commit-time `replaceAdHoc` contract. Do not debounce inside the hook — it would break the array's use as an effect dependency.
- **G8** — document that `add()` rewrites the whole array; panels should batch.

## Build order

**Phase 7 — Correctness and the dead paths (S, no new UI).** Gate + undo-route `setTransformations`; add `onTransformationError`; fix `getPrepareTimeseriesSuggestion` to use the scenes lookup; make `loadSuggestion` apply `s.transformations` and render outside `CoreApp.PanelEditor`; **change phase 4's "Hide column" to write `custom.hideFrom.viz`**.

_Accepts when:_ a viewer's `setTransformations()` is a no-op with a byte-identical save model; an edit-mode write is Ctrl-Z reversible; a failing pipeline reaches the panel header; a `TimeSeriesLong` frame in a **scenes** dashboard offers and applies `prepareTimeSeries`; a hidden column's data link still resolves and Inspect → Data still shows it.

**Phase 8 — Write-only participation + ephemeral/URL tier (M).** G1 through seven layers; `AdHocTransformationsBehavior` + URL sync; G2 position hint; first consumer is sort from `HeaderCell` and from the legend via the now-implemented `onToggleLegendSort`.

_Accepts when:_ `{ write: true }` without `{ own: true }` receives transformed data and can still write; an ephemeral transformation renders but is absent from `getSaveModel()`, doesn't set `isDirty`, and **doesn't dirty the dashboard on entering edit mode** (F4 regression, explicit test); the URL reproduces the sort in a new tab; `add(cfg, { before: 'rowsToFields' })` changes bar order.

**Phase 9 — Generic surface + promotion (M) — gated.** G3 + G4; `allowedIds` on `TransformationsDrawer`; "Save to panel" promotion; allowlist `organize`, `sortBy`, `limit`, `filterByValue`, `groupingToMatrix`, `transpose` so pivot and Top-N cost nothing.

**Gate on two things, not this document:** (a) `grafana_panel_transformations_clicked` telemetry confirming or refuting the hard-coded top-4 — verified zero `groupBy` usage says the curation may be wrong; (b) `grafanaDataProSquad` sign-off, given the SQL-Expressions direction.

## Verification

```bash
yarn jest --no-watch public/app/features/dashboard-scene/scene/adHocTransformations.test.ts
yarn jest --no-watch public/app/features/dashboard-scene/scene/setDashboardPanelContext.test.ts
yarn jest --no-watch public/app/features/dashboard-scene/saving
yarn jest --no-watch packages/grafana-ui/src/components/PanelChrome
yarn jest --no-watch public/app/plugins/panel/timeseries/suggestions.test.ts
yarn typecheck && yarn lint
go test ./pkg/plugins/... ./apps/plugins/pkg/app/meta/...   # phase 8 G1 only
make gen-cue && make gen-apps && git diff --exit-code
```

New tests: `AdHocTransformationsBehavior.test.ts` (URL round-trip, save-model invisibility, F4 dirty-on-edit regression) and a `DashboardSceneChangeTracker.test.ts` case asserting the behavior falls through `isUpdatingPersistedState`.

**Manual** (`make run` + `yarn start`, `panelAdHocTransformations` on): (1) as a viewer, sort a table → URL gains `_adhoc.<pathId>`, no unsaved-changes prompt; new tab reproduces it; bare URL doesn't. (2) As an editor, sort then click Edit → **must not** be dirty; sort, "Save to panel", Ctrl-Z → reverted. (3) Hide a column referenced by a data link → link still resolves, Inspect → Data still lists it. (4) Long-format timeseries in a scenes dashboard → the transform card appears and works. (5) `-- Dashboard --` query with "use transformed data" sees the ad-hoc result.

## Risks

| Risk                                                                                                     | Mitigation                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| G1 reshapes a shipped plugin.json field                                                                  | Experimental toggle, zero consumers, legacy `true` preserved. Land before phases 4–6 multiply adopters.      |
| A third tier is conceptual cost for plugin authors                                                       | Tiers are invisible to readers — `getTransformations()` returns the effective pipeline; only writers opt in. |
| URL length                                                                                               | Cap ~1.5 KB, degrade to Tier 0 rather than truncate.                                                         |
| Phase 9 is panel-edit-in-a-popover for viewers, against 212 restrict-viewer issues and the SQL direction | Hard gate on squad sign-off + telemetry. Phases 7–8 stand alone if declined.                                 |
| #17245 will look fixed and won't be for wide-frame gauges (F2)                                           | State scope in PR and docs; wide-frame needs a separate design.                                              |
| Capability 6 (119 reactions) may be the better investment and needs none of this API                     | Spike separately; don't let this workstream foreclose it.                                                    |
| Ranking rests on weak reaction counts (top open FR = 16)                                                 | Query telemetry before phase 9. Treat the catalog as a hypothesis, not a roadmap.                            |
| `organize.isApplicable` rejects multi-frame data, which phase 5 will hit                                 | Relax in `getApplicableTransformations` (G4 caveat).                                                         |
