> Full plan also written to `/Users/galen/.claude/plans/panels-need-to-be-calm-nygaard.md`

# Ad-hoc panel transformations

## Context

Panel plugins want transformation UI inside the visualization itself — e.g. a table column header menu with "Hide column" that appends an `organize` transformation. Today the pipeline runs entirely outside the panel: `SceneDataTransformer` executes it and `PanelProps.data` arrives already transformed, so a panel can neither see its own pipeline nor participate in it.

An earlier spike on two local branches proved the idea out and is worth reusing:

- `gtk-grafana/transform-within-viz-poc` (`b92ba7b2435`) — feature toggle `panelAdHocTransformations`, an `origin` field on `DataTransformerConfig`, `PanelContext.onAddAdHocTransformation`, and tests.
- `gtk-grafana/transform-within-viz-poc__table-poc` (`c55976481e4`, `0cbf3cde549`) — a table `HeaderCell` menu, plus self-described "hacky" merge logic and the open question of whether panel-added transformations should append to or merge into the existing pipeline.

This plan turns that spike into a shippable feature.

**Decisions already made (do not revisit):**

| Decision         | Choice                                                                          |
| ---------------- | ------------------------------------------------------------------------------- |
| Pipeline bypass  | Upstream `skipTransformations` flag in `@grafana/scenes`                        |
| Persisted marker | Reuse the spike's `origin?: { source: 'panel' \| 'editor'; pluginId?: string }` |
| Schema scope     | v1 **and** all v2 kinds, including the hand-written Go conversions              |
| Panel API        | Ship hooks that handle interpolation + field config, not just raw get/set       |

Per `AGENTS.md`, frontend and backend ship as separate PRs.

## Goal

Let a panel plugin opt out of the host transformation pipeline and own it instead, reading and writing its transformations through `PanelContext` and persisting them with provenance.

## Approach

Keep `SceneDataTransformer.state.transformations` as the **single source of truth**. Everything that reads it today — v1/v2 serializers, both panel-edit transformation UIs, `PanelModelCompatibilityWrapper`, `instanceof SceneDataTransformer` checks — keeps working untouched. The only change is that the transformer stops _executing_ the array when a new `skipTransformations` state flag is set.

This buys reactivity for free: `VizPanelRenderer` calls `dataObject.useState()` on the transformer (scenes `dist/index.js` ~3668), so any `transformations` change already re-renders the panel. The context therefore exposes stable **getter/setter functions** rather than a live array — `getPanelContext()` memoizes the context object into `_panelContext`, so a value would go stale.

Two hazards drive the rest of the design, both verified in this codebase:

1. **Interpolation.** `transformDataFrame` refuses to interpolate whenever `window.__grafanaSceneContext != null` — always true in a dashboard (`packages/grafana-data/src/transformations/transformDataFrame.ts:66`). Something must pre-interpolate. `setDashboardPanelContext` does it with `sceneGraph.interpolate`, mirroring `SceneDataTransformer._interpolateVariablesInTransformationConfigs`, because `PanelProps.replaceVariables` does **not** merge `data.request.scopedVars` (where repeat-by-row values live) and would silently diverge for repeated panels.
2. **Field config.** `VizPanel.applyFieldConfig()` runs _before_ the panel, so panel-applied transforms that rename or create fields yield frames with no display processor. The context exposes a **pure** re-application helper. It must not delegate to `vizPanel.applyFieldConfig` — that method mutates `_prevData` / `_dataWithFieldConfig` / `_structureRev` (scenes `dist/index.js:5348-5417`), so a second call per render would bump `structureRev` forever and thrash consumers like `TableFlat.tsx:296` and `GraphNG.tsx:232`. It also must start from pre-field-config data, because `setFieldConfigDefaults` does `config.links.push(...defaults.links)` (`packages/grafana-data/src/field/fieldOverrides.ts:423-425`) — re-running over already-processed frames duplicates every panel data link.

## File Changes

### Phase 0 — `grafana/scenes` (separate repo, release 8.14.0)

| File                                                        | Action | Change                                                                                                                                                           |
| ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/scenes/src/querying/SceneDataTransformer.ts`      | Modify | Add optional `skipTransformations?: boolean` to `SceneDataTransformerState`; extend the existing early-return in `transform()`; re-transform when the flag flips |
| `packages/scenes/src/querying/SceneDataTransformer.test.ts` | Modify | Cases listed under Verification                                                                                                                                  |

### Phase 1 — Backend + schema (backend PR)

| File                                                                                       | Action | Change                                                                                            |
| ------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| `pkg/services/featuremgmt/registry.go`                                                     | Modify | `panelAdHocTransformations` toggle — reuse the spike's entry verbatim                             |
| `kinds/dashboard/dashboard_kind.cue:540`                                                   | Modify | `origin` on `#DataTransformerConfig`                                                              |
| `apps/dashboard/kinds/v2alpha1/dashboard_spec.cue:151`                                     | Modify | `origin` on `DataTransformerConfig`                                                               |
| `apps/dashboard/kinds/v2beta1/dashboard_spec.cue:149`                                      | Modify | same                                                                                              |
| `apps/dashboard/kinds/v2/dashboard_spec.cue:151`                                           | Modify | `origin` on `TransformationSpec`                                                                  |
| `apps/dashboard/pkg/migration/conversion/v2beta1_to_v2.go:35-65`                           | Modify | Carry `origin` in `fixupTransformations_V2beta1_to_V2`                                            |
| `apps/dashboard/pkg/migration/conversion/v2_to_v2beta1.go`                                 | Modify | Mirror                                                                                            |
| `apps/dashboard/pkg/migration/conversion/v2alpha1_to_v2beta1.go`, `v2beta1_to_v2alpha1.go` | Modify | Mirror                                                                                            |
| `apps/dashboard/pkg/migration/conversion/v1_to_v2alpha1.go:2331`                           | Modify | Read `origin` in `transformPanelTransformations`                                                  |
| `apps/dashboard/pkg/migration/conversion/v2alpha1_to_v1.go:1144`                           | Modify | Write `origin` back                                                                               |
| `docs/sources/developers/plugins/plugin.schema.json`                                       | Modify | `adHocTransforms` next to `skipDataQuery:514` — required, `additionalProperties: false` at line 8 |
| `pkg/plugins/plugins.go:104-106`                                                           | Modify | `AdHocTransforms bool` in the `// Panel settings` block                                           |
| `pkg/plugins/models.go:314-331`                                                            | Modify | `PanelDTO.AdHocTransforms`                                                                        |
| `pkg/api/bootdata.go:396-413`                                                              | Modify | Map it in `getFSPanels`                                                                           |
| `apps/plugins/kinds/meta.cue:69`                                                           | Modify | `adHocTransforms?: bool`                                                                          |
| `apps/plugins/pkg/app/meta/converter.go:168`                                               | Modify | Omit-when-false mapping                                                                           |

Generated artifacts (`make gen-cue`, `make gen-apps`, `make -C apps/plugins generate`, `make gen-feature-toggles`) must ride with their sources in this PR — CI verifies codegen is in sync — even though several land under `packages/`. Call that out in the PR description.

### Phase 2 — Frontend plumbing (frontend PR)

| File                                                                                                 | Action     | Change                                                                   |
| ---------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `package.json` / `yarn.lock`                                                                         | Modify     | `@grafana/scenes` → 8.14.0                                               |
| `packages/grafana-schema/src/veneer/dashboard.types.ts:61`                                           | Modify     | `origin` on `DataTransformerConfig` (verbatim from the spike)            |
| `packages/grafana-data/src/types/panel.ts:21-30`                                                     | Modify     | `PanelPluginMeta.adHocTransforms?: boolean`                              |
| `packages/grafana-runtime/src/services/pluginMeta/mappers/v0alpha1PanelMapper.ts:42,62`              | Modify     | Destructure + return                                                     |
| `public/app/features/dashboard-scene/scene/adHocTransformations.ts`                                  | **Create** | `panelSkipsTransformationPipeline()` + `syncSkipTransformationsBehavior` |
| `public/app/features/dashboard-scene/utils/runPanelTransformations.ts`                               | **Create** | Shared "run the pipeline off-band" helper                                |
| `public/app/features/dashboard-scene/utils/createPanelDataProvider.ts:40`                            | Modify     | Set flag + behavior                                                      |
| `public/app/features/dashboard-scene/serialization/layoutSerializers/utils.ts:229`                   | Modify     | same (v2 path)                                                           |
| `public/app/features/dashboard-scene/panel-edit/PanelEditor.tsx:287`                                 | Modify     | same                                                                     |
| `public/app/features/dashboard-scene/scene/DashboardScene.tsx:1013`                                  | Modify     | same                                                                     |
| `public/app/features/dashboard-scene/utils/utils.ts:309`                                             | Modify     | same                                                                     |
| `public/app/features/dashboard-scene/scene/setDashboardPanelContext.ts`                              | Modify     | The new context members                                                  |
| `public/app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2.ts:512-526`     | Modify     | Carry `origin` into `TransformationSpec`                                 |
| `public/app/plugins/datasource/dashboard/datasource.ts:89`                                           | Modify     | Honour `withTransforms` under bypass                                     |
| `public/app/features/dashboard-scene/inspect/InspectDataTab.tsx:76-88`                               | Modify     | Same for the "Apply panel transformations" toggle                        |
| `public/app/features/dashboard-scene/panel-edit/PanelDataPane/PanelDataTransformationsTab.tsx:83-94` | Modify     | Compute the "after" preview locally under bypass                         |
| `public/app/features/dashboard-scene/panel-edit/PanelEditNext/PanelDataPaneNext.tsx:503+`            | Modify     | Same; stamp `origin: {source:'editor'}` on adds                          |

`transformSceneToSaveModel.ts:339` needs **no change** — it assigns the whole config objects, so `origin` flows through. `transformationCompat.ts` spreads `...spec` in both directions, so it also needs no change, but add a regression test.

### Phase 3 — `@grafana/ui` hooks (frontend PR)

| File                                                                        | Action     | Change                                                        |
| --------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| `packages/grafana-ui/src/components/PanelChrome/PanelContext.ts`            | Modify     | New optional members                                          |
| `packages/grafana-ui/src/components/PanelChrome/useAdHocTransformations.ts` | **Create** | Read/write pipeline, stamp `origin`                           |
| `packages/grafana-ui/src/components/PanelChrome/useTransformedData.ts`      | **Create** | Run `transformDataFrame`, split topics, re-apply field config |
| `packages/grafana-ui/src/index.ts`                                          | Modify     | Export both hooks near `usePanelContext` (line 179)           |
| `docs/sources/developers/plugins/`                                          | Modify     | Document `adHocTransforms` + the hooks (see `docs/AGENTS.md`) |

### Phase 4 — Table panel adoption (frontend PR)

| File                                                                         | Action | Change                    |
| ---------------------------------------------------------------------------- | ------ | ------------------------- |
| `public/app/plugins/panel/table/plugin.json`                                 | Modify | `"adHocTransforms": true` |
| `public/app/plugins/panel/table/TablePanel.tsx`                              | Modify | Use both hooks            |
| `packages/grafana-ui/src/components/Table/TableNG/components/HeaderCell.tsx` | Modify | "Hide column" menu item   |

### Phase 5 - Table panel adoption 2 (frontend PR)

Another, more realistic demonstration. Pull in the `FieldSelector` component as a table sidebar similar to the logstable implementation, but without any of the logs frame specific assumptions.

### Phase 6 - Logstable panel adoption (frontend PR)

Replace the current tranforms ran locally in the `logstable` panel hooks. The extract fields transform should always be prepended into the transformation array, so any user added transformations happen after the extract fields. OrganizeFields should be ran at the end, after any user transformations

## Implementation Steps

### Task 0 — `@grafana/scenes` (PR 0, separate repo)

1. Add the state field and extend the existing early return:

```ts
export interface SceneDataTransformerState extends SceneDataState {
  transformations: Array<DataTransformerConfig | CustomTransformerDefinition>;
  /**
   * When true the pipeline is not executed and source data passes straight through.
   * `transformations` is still stored, serialised and scanned for variable usage, so
   * consumers that own the pipeline themselves (a panel plugin declaring `adHocTransforms`)
   * still see it.
   */
  skipTransformations?: boolean;
}

// in transform()
if (this.state.skipTransformations || this.state.transformations.length === 0 || !data) {
  this._prevDataFromSource = data;
  this.setState({ data }); // required: drives useState() re-render
  if (data) {
    this._results.next({ origin: this, data });
  } // required: dashboard DS awaits this
  return;
}
```

2. In `activationHandler`, re-transform when the flag flips (viz type changed):

```ts
this._subs.add(
  this.subscribeToState((n, p) => {
    if (n.skipTransformations !== p.skipTransformations) {
      this.reprocessTransformations();
    }
  })
);
```

Leave `reprocessTransformations()`, `haveAlreadyTransformedData()` and `_calculateTransformationMetrics` alone — the metrics call already sits after the early return, so the skip path correctly records no transform timings. Release as a minor (8.14.0).

### Task 1 — Backend schema and capability (PR 1)

3. Add the feature toggle, reusing the spike's entry: name `panelAdHocTransformations`, description "Allow panels to add transformations to the panel's transformation pipeline at runtime", `FeatureStageExperimental`, `grafanaDashboardsSquad`, `Generate{LegacyGo: true, LegacyFrontend: true}`, `Expression: "false"`. Run `make gen-feature-toggles`.

4. Add `origin` to all four CUE kinds. Comment it consistently: _absent means editor-authored; do not backfill._

```cue
// Records how this transformation was created. Absent means it was authored in the
// transformations editor.
origin?: {
    source:    "panel" | "editor"
    pluginId?: string
}
```

5. Run `make gen-cue` and `make gen-apps`; commit the generated Go, TS and OpenAPI snapshots.

6. Update every hand-written Go conversion listed above. Add one `convertTransformationOrigin` helper per direction rather than inlining the mapping five times. `conversion_data_loss_detection.go` needs no change — it counts panels, queries, annotations and links only.

7. Add the `adHocTransforms` plugin capability following `skipDataQuery` exactly through all seven layers: JSON schema → `plugins.go` → `models.go` → `bootdata.go` → `meta.cue` → `converter.go` → generated artifacts.

### Task 2 — Bypass plumbing (PR 2)

8. Bump `@grafana/scenes` to 8.14.0.

9. Add the veneer type, `PanelPluginMeta.adHocTransforms`, the mapper change, and update the meta fixtures (`pluginMocks.ts:64`, `test-fixtures/config.panels.ts`, `v0alpha1Response.ts`).

10. Create `public/app/features/dashboard-scene/scene/adHocTransformations.ts`:

```ts
export function panelSkipsTransformationPipeline(pluginId: string | undefined, metas = safeMetas()): boolean {
  if (!config.featureToggles.panelAdHocTransformations || !pluginId) {
    return false;
  }
  const meta = metas[pluginId];
  // adHocTransforms is meaningless without data; skipDataQuery panels never get a transformer.
  return Boolean(meta?.adHocTransforms && !meta.skipDataQuery);
}

/** $behavior on SceneDataTransformer: keeps the flag in sync with the parent VizPanel's pluginId. */
export function syncSkipTransformationsBehavior(transformer: SceneDataTransformer) {
  /* ... */
}
```

`safeMetas()` must wrap `getPanelPluginMetasMapSync()` in try/catch returning `{}` — it throws in dev before init. Never read `config.panels` directly; the `no-config-panels` lint rule bans it.

11. Set `skipTransformations` at construction **and** attach `syncSkipTransformationsBehavior` at all five `new SceneDataTransformer` sites. Setting it at construction avoids a first-render flash; the behavior handles later viz-type changes. A behavior is used rather than per-call-site logic because `changePluginType` has six call sites and only `DashboardScene.tsx:1003` handles the analogous `skipDataQuery` transition today.

12. Extend `setDashboardPanelContext.ts` behind the toggle. All members are functions, since `getPanelContext()` memoizes the context object:

```ts
context.isAdHocTransformsEnabled = () => panelSkipsTransformationPipeline(vizPanel.state.pluginId);

// Interpolated, with a stable array identity while the interpolated value is unchanged
// (the hook uses it as an effect dependency).
context.getTransformations = () => {
  /* filter to DataTransformerConfig, JSON-memoize,
     sceneGraph.interpolate(dp, json, dp.state.data?.request?.scopedVars) */
};

context.setTransformations = (configs) => {
  dp.setState({ transformations: configs });
  dp.reprocessTransformations();
};

// Source data before the pipeline AND before field config; honours seriesLimit for parity
// with scenes' useDataWithSeriesLimit.
context.getUntransformedData = () => {
  /* ... */
};

// PURE re-application. Calls applyFieldOverrides directly — never vizPanel.applyFieldConfig,
// which mutates _prevData/_dataWithFieldConfig/_structureRev.
context.applyFieldConfig = (data) => {
  /* ... */
};
```

`applyFieldConfig` must mirror `VizPanel.applyFieldConfig` (scenes `dist/index.js:5348-5417`): `plugin.fieldConfigRegistry`, `vizPanel.interpolate`, `config.theme2`, `data.request?.timezone`, `config.featureToggles`, empty field config for annotations, and clearing `alertState` / `annotations` per `plugin.dataSupport`.

13. Add `origin` to the v2 serializer's field-by-field `TransformationSpec` build. This is the one serializer that would silently drop it.

14. Create `runPanelTransformations.ts` and use it in the three places that would otherwise read untransformed data under bypass: the dashboard datasource `withTransforms` path, Inspect's "Apply panel transformations" toggle, and both panel-edit transformation previews. **These are correctness bugs, not polish — they must land in this PR.**

15. Stamp `origin: { source: 'editor' }` on transformations added through the editor (`PanelDataPaneNext.addTransformation:528` and the older add path) so provenance is explicit rather than inferred from absence.

### Task 3 — Public hooks (PR 3)

16. Extend `PanelContext`:

```ts
/** True when this panel owns its transformation pipeline. @alpha */
isAdHocTransformsEnabled?: () => boolean;
/** The pipeline with template variables interpolated; stable identity while unchanged. @alpha */
getTransformations?: () => DataTransformerConfig[];
/** Replace the pipeline verbatim; persisted to the dashboard. @alpha */
setTransformations?: (configs: DataTransformerConfig[]) => void;
/** Source data before transformations and before field config. @alpha */
getUntransformedData?: () => PanelData | undefined;
/** Pure field-config application. Callers must memoize. @alpha */
applyFieldConfig?: (data: PanelData) => PanelData;
```

Drop the spike's `onAddAdHocTransformation` — it stamped `origin` in the scene layer, which is the wrong place now that the hook can read the pluginId from `usePluginContext()`.

17. `useAdHocTransformations(): AdHocTransformationsApi` — `{ enabled, transformations, adHocTransformations, add, replaceAdHoc, clearAdHoc, set }`. Stamps `origin: { source: 'panel', pluginId }` from `usePluginContext()`.

**Append, never merge.** `add()` appends unconditionally. `options` is `any` and there is no per-transformer merge contract, which is exactly the `@todo` the table spike wrote against itself; merging would also silently rewrite editor-authored entries and defeat `origin`. Unbounded growth is solved by `replaceAdHoc`, which keeps every non-panel entry in order and then appends the panel's entries — so **ad-hoc transformations always run last**. The panel keeps its own view state (e.g. the hidden-column set) and rewrites its single entry. If merging is ever needed the right shape is an optional `merge(a, b)` on `TransformerRegistryItem`; explicit non-goal here.

18. `useTransformedData(data: PanelData): { data: PanelData; isTransforming: boolean; error?: DataQueryError }`.

- Returns `PanelData`, not `DataFrame[]`, so panels can shadow `props.data` in one line.
- State-based, not suspense: `transformDataFrame` resolves operators through a dynamic `import()` (`transformDataFrame.ts:29`), so suspense would unmount the panel subtree on every change — unacceptable for uPlot and TableNG.
- Effect deps are `[configs, source.series, source.annotations]` so metadata-only changes (`state`, `request`, `errors`) merge in without re-running — the same trick as `haveAlreadyTransformedData`.
- Stale-while-revalidate: keep the previous result in flight; on the very first run return the input with `state: Loading` rather than raw frames, which would flash.
- Owns its own monotonic `structureRev` via `compareArrayValues(…, compareDataFrameStructures)`.
- Replicates the topic split: `topic == null || Series` → series, `Annotations` → annotations, `AlertStates` dropped (exact parity with `SceneDataTransformer`; do not "fix" it here), then re-buckets output by `frame.meta.dataTopic`.
- Mirrors the scenes error shape (`Error transforming data: …`). Note the caveat: `PanelChrome`'s header indicator will not see it, so panels should render `<PanelDataErrorView />`.

### Task 4 — Table adoption (PR 4)

19. Set `"adHocTransforms": true`, wire both hooks in `TablePanel.tsx`, add the `HeaderCell` "Hide column" item driven by `replaceAdHoc`. Delete the spike's `organize` merge logic and the `onAddAdHocTransformation` prop threading.

## Acceptance Criteria

1. A panel with `"adHocTransforms": true` and a non-empty `transformations` array receives `props.data.series` reference-identical to the query runner's output.
2. The same panel with the feature toggle **off** receives fully transformed data (unchanged behaviour).
3. `usePanelContext().getTransformations()` returns the panel's configs with `$var` resolved using `data.request.scopedVars`, and returns the **same array instance** across renders while the interpolated value is unchanged.
4. `setTransformations()` persists to dashboard JSON: v1 under `panel.transformations`, v2 under `elements[k].spec.data.spec.transformations`.
5. A transformation added via `useAdHocTransformations().add()` serialises with `origin: { source: 'panel', pluginId: '<id>' }` in both v1 and v2 JSON.
6. `origin` survives every conversion hop: v1 → v2alpha1 → v2beta1 → v2 → v2beta1 → v2alpha1 → v1.
7. Calling `context.applyFieldConfig()` never changes `vizPanel`'s `structureRev`: applying `vizPanel.applyFieldConfig(raw)`, then `context.applyFieldConfig(other)`, then `vizPanel.applyFieldConfig(raw)` again leaves `structureRev` unchanged.
8. `context.applyFieldConfig()` on frames carrying panel-level data links does not duplicate them.
9. A `-- Dashboard --` query with `withTransforms: true` against a bypassed panel returns transformed frames.
10. Inspect → Data → "Apply panel transformations" shows transformed data for a bypassed panel.
11. The panel-edit Transformations tab preview shows transformed output for a bypassed panel.
12. Switching a bypassed panel to a normal viz type keeps every transformation, flips the flag false, and renders identical data. Switching back is also lossless.
13. `adHocTransforms` alongside `skipDataQuery` is inert — `panelSkipsTransformationPipeline` returns false.
14. `yarn typecheck`, `yarn lint`, and `make lint-go` pass.

## Verification Steps

**Scenes (PR 0)** — in `SceneDataTransformer.test.ts`: pass-through with a non-empty array; `_results` still emits once per source emission; state object identity changes on every emit so `useState()` subscribers re-render; flipping the flag false→true→false re-transforms both ways; `reprocessTransformations()` while skipped re-emits without throwing; a variable change while skipped still produces one emission; `clone()` preserves the flag.

**Backend**

```bash
go test ./apps/dashboard/pkg/migration/conversion/...
go test ./apps/plugins/pkg/app/meta/...
go test ./pkg/plugins/... ./pkg/api/ -run 'Panel|Plugin'
make gen-cue && make gen-apps && make gen-feature-toggles && git diff --exit-code
```

Add a golden fixture under `apps/dashboard/pkg/migration/conversion/testdata/input/` containing a panel-origin transformation, regenerate `testdata/output/` and `golden_checksums.json` (see the update flag in `golden_test.go`).

**Frontend**

```bash
yarn jest --no-watch public/app/features/dashboard-scene/scene/setDashboardPanelContext.test.ts
yarn jest --no-watch public/app/features/dashboard-scene/scene/adHocTransformations.test.ts
yarn jest --no-watch public/app/features/dashboard-scene/serialization
yarn jest --no-watch packages/grafana-ui/src/components/PanelChrome
yarn jest --no-watch public/app/plugins/datasource/dashboard
yarn typecheck && yarn lint
```

New/extended test files and their key cases:

- `setDashboardPanelContext.test.ts` — interpolation via `request.scopedVars`; stable array identity; custom operator functions filtered out; `setTransformations` calls `reprocessTransformations`; the `structureRev` regression (criterion 7); the data-link duplication guard (criterion 8); `getUntransformedData` honours `seriesLimit`; all members `undefined` when the toggle is off.
- `useTransformedData.test.tsx` — returns input verbatim when disabled; metadata-only input change does **not** re-run `transformDataFrame` (spy on call count); stale result kept while `isTransforming`; error surfaces as `state: Error`; `structureRev` bumps only on structural change; annotation-topic configs only touch annotations; unmount unsubscribes.
- `useAdHocTransformations.test.tsx` — `add()` stamps `origin` from `PluginContextProvider`; adding the same id twice yields **two** entries (locks in the append decision); `replaceAdHoc` keeps editor entries first; `adHocTransformations` excludes entries with no `origin`.
- `transformSceneToSaveModelSchemaV2.test.ts`, `transformationCompat.test.ts`, `transformSceneToSaveModel.test.ts` (extend the spike's additions) — `origin` round-trips.
- `DashboardScene.test.tsx` — viz-type switch in both directions (criterion 12).

**Manual, end to end**

```bash
make run                     # localhost:3000, admin/admin
yarn start
```

Enable `panelAdHocTransformations` in `conf/custom.ini`. Build a table panel on the TestData datasource, hide a column from the header menu, confirm the column disappears and the panel-edit Transformations tab lists an `organize` row. Save, reload, confirm it persists. Check Panel JSON for `"origin": {"source": "panel", ...}`. Save the dashboard as v2 (dashboard API v2) and confirm `origin` is present under `spec.data.spec.transformations`. Switch the viz to Time series and back; confirm nothing is lost. Add a second panel with a `-- Dashboard --` query and "use transformed data" enabled; confirm it sees the hidden column removed.

## Risks & Mitigations

| Risk                                                                                                                                                                                                                                                           | Mitigation                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Silent wrong data** via the dashboard datasource `withTransforms` and Inspect's transform toggle — both read the transformer's output, which is now untransformed. Verified at `datasource.ts:89` and `InspectDataTab.tsx:76-88`.                            | Ship `runPanelTransformations.ts` and wire all three consumers in PR 2, not as follow-up. Covered by criteria 9-10.                                                                      |
| **Panel-edit preview regression** — the Transformations tab reads `transformer.state.data`, which under bypass is the "before" data, so the "after" preview lies.                                                                                              | Compute the preview locally with the same helper. Covered by criterion 11.                                                                                                               |
| **`structureRev` thrash** if `applyFieldConfig` is delegated to `vizPanel.applyFieldConfig`, which mutates `_prevData`/`_structureRev` on every call. Would rebuild uPlot configs and reset table column widths every render.                                  | Implement a pure helper calling `applyFieldOverrides` directly. Regression test in criterion 7.                                                                                          |
| **Duplicated data links** from re-running `applyFieldOverrides` over already-processed frames (`fieldOverrides.ts:423-425` pushes rather than replaces).                                                                                                       | Start from `getUntransformedData()`, which returns pre-field-config data. Test in criterion 8.                                                                                           |
| **Variable divergence** if interpolation used `PanelProps.replaceVariables`, which omits `request.scopedVars` — repeated panels would resolve `$var` differently from the normal pipeline.                                                                     | Interpolate in the context getter with `sceneGraph.interpolate` and the request's scoped vars, mirroring `SceneDataTransformer`.                                                         |
| **Blocked on a scenes release** — PR 2 cannot merge until 8.14.0 ships.                                                                                                                                                                                        | PR 0 is small and additive; PRs 1 and 3 are independent and can land meanwhile.                                                                                                          |
| **Stale flag on viz-type change** — six `changePluginType` call sites, only one handles the analogous `skipDataQuery` transition today.                                                                                                                        | A `$behavior` on the transformer syncs from the parent `VizPanel`'s `pluginId`; the scenes `subscribeToState` handler turns the flip into a re-transform, so no call site must remember. |
| **Snapshots** bake in `getPanelDataFrames(dataProvider.state.data)` (`transformSceneToSaveModel.ts:341`), which under bypass is untransformed. Still renders correctly (the snapshot keeps `transformations` and the panel re-applies) but differs from today. | Add a snapshot round-trip test; if the difference is unacceptable, route snapshot serialization through the shared helper.                                                               |
| **Non-dashboard hosts** (alerting previews, Explore, plugin-hosted panels) get no `PanelContextProvider` from `VizPanel`, so ad-hoc transformations are not reflected there.                                                                                   | Safe by construction — `isAdHocTransformsEnabled()` is false and `useTransformedData` returns `props.data` untouched. Document the alert-preview gap.                                    |
| **Wasted field-config pass** — `props.data` still costs a full `applyFieldOverrides` the ad-hoc panel discards. Measurable on wide tables.                                                                                                                     | Accept for v1; the fix (a `skipFieldConfig` flag on `VizPanel`) is upstream-only. Track as follow-up.                                                                                    |
| **Custom transform operators** (`CustomTransformerDefinition` functions) cannot be interpolated or serialised.                                                                                                                                                 | The getter filters them out, matching `PanelDataTransformationsTab.tsx:85-94`; `setTransformations` writes verbatim so they are preserved. Dashboards never contain them.                |

### Follow-ups (not in scope)

- Upstream `skipFieldConfig` on `VizPanel` to remove the redundant field-config pass and restore strict query → transform → field config ordering.
- A panel-edit badge on rows with `origin.source === 'panel'` ("added by the visualization").
- `PanelContext.onTransformationError` so the panel chrome header surfaces transform errors.
- Migrate `logstable`'s `useOrganizeFields` / `useExtractFields` onto the shared hooks — its manual `merge({}, fieldConfig.defaults, field.config)` loop is exactly the gap `applyFieldConfig` closes.
- `PanelDataPaneNext` calls `runQueries()` after transformation edits instead of `reprocessTransformations()`; wasteful under bypass.
