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

**Status: implemented** on `gtk-grafana/dataviz/ad-hoc-transforms-poc__4-logstable-adoption`. Adopting a panel with real transformation needs (rather than the table's empty-by-default pipeline) surfaced four gaps in the Phase 3 hooks. See [Phase 6 findings](#phase-6-findings--upstream-changes-the-logstable-adoption-forced) for what had to change outside the panel and what is still outstanding.

| File                                                                        | Action     | Change                                                                                                                             |
| --------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/grafana-ui/src/components/PanelChrome/useAdHocTransformations.ts` | Modify     | Local-state fallback when the host provides no pipeline; `replaceAdHoc({ before, after })`                                         |
| `packages/grafana-ui/src/components/PanelChrome/useTransformedData.ts`      | Modify     | `transformations`, `splitTrailing` (+ `dataBeforeTrailing`) and `applyFieldConfig` options; run whenever the pipeline is non-empty |
| `public/app/plugins/panel/logstable/plugin.json`                            | Modify     | `"adHocTransforms": true`                                                                                                          |
| `public/app/plugins/panel/logstable/hooks/useLogsTableTransformations.ts`   | **Create** | Derives both configs, syncs them idempotently via `replaceAdHoc({ before, after })`, runs the pipeline, returns both stages        |
| `public/app/plugins/panel/logstable/hooks/useDecorateFields.tsx`            | **Create** | The field config that cannot be a transformation: level pills, time column width, `filterable`, `inspect`, the React cell renderer |
| `public/app/plugins/panel/logstable/hooks/useExtractFields.ts`              | **Delete** | Replaced                                                                                                                           |
| `public/app/plugins/panel/logstable/hooks/useOrganizeFields.tsx`            | **Delete** | Replaced                                                                                                                           |
| `public/app/plugins/panel/logstable/LogsTable.tsx`                          | Modify     | Wire both hooks; the field selector now reads `availableFieldsFrame`                                                               |

`transforms/extractLogsFieldsTransform.ts` and `transforms/organizeLogsFieldsTransform.ts` are unchanged — they were already pure config builders, which is why they drop straight into a pipeline.

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
- ~~Migrate `logstable`'s `useOrganizeFields` / `useExtractFields` onto the shared hooks~~ — done in Phase 6. The manual `merge({}, fieldConfig.defaults, field.config)` loop is gone, though `applyFieldConfig` turned out **not** to be the thing that closed the gap; see finding 4 below.
- `PanelDataPaneNext` calls `runQueries()` after transformation edits instead of `reprocessTransformations()`; wasteful under bypass.

## Phase 6 findings — upstream changes the logstable adoption forced

The table panel (Phase 4) is a weak test of the hooks: its pipeline is empty by default, so `useTransformedData` is a no-op until a user hides a column, and it needs nothing from the pipeline it did not put there. `logstable` is the opposite — it **cannot render at all** without its two transformations, it needs them on both sides of the user's, and it needs to see an intermediate stage. Four gaps followed. All four are additive and none change existing behaviour for the table panel.

### 1. `replaceAdHoc` could only append — ordering had to become expressible

Phase 3 decided panel entries always run last (`replaceAdHoc` keeps editor entries first, then appends). That is right for "hide this column" but cannot express what logstable needs:

```
extractFields (panel)  →  whatever the user added  →  organize (panel)
```

Extracting first is the whole point: today a user transformation runs against the raw frame, so it cannot reference a label column, and `organize`'s `includeByName` would drop any field it created. Organizing last is what makes user-created fields selectable in the sidebar.

`replaceAdHoc` now accepts `{ before, after }` alongside the array form. Positions do **not** need persisting — the panel recomputes both entries from its own state on every data change and writes them in one call, so it never reads a position back. That kept `origin` out of it and avoided a schema change.

### 2. Non-dashboard hosts got no pipeline at all — the hooks now degrade

`ExploreLogsTable.tsx:167` renders `LogsTable` **directly as a React component** with a hand-rolled `PanelContextProvider` (`:159-166`) containing only `eventBus` / `onAddAdHocFilter` / `app`. There are also context-free hosts: `PanelRenderer` wraps only `ErrorBoundaryAlert` + `PluginContextProvider` (`PanelRenderer.tsx:94-116`), which viz-suggestion previews and Explore's `CustomContainer` go through.

With Phase 3's `enabled && transformations.length > 0` gate, logstable in Explore would render a raw `labels` JSON blob with every column at once. The alternative — keeping a second, local copy of the transformation code for those hosts — doubles the panel and undercuts the point.

So `useAdHocTransformations` now keeps the pipeline in component state when the host provides none, and `useTransformedData` runs whenever the pipeline is non-empty rather than only when the host handed it over. A panel gets **one code path**; the difference between hosts is only whether the pipeline is persisted and visible in the transformations editor.

`enabled` deliberately kept its old meaning — "the host owns the pipeline" — so UI that implies persistence still gates correctly. The table's "Hide column" item does not appear in Explore, which is right.

**Consequence worth knowing:** with the feature toggle off, or on a dashboard whose panel does not declare `adHocTransforms`, `enabled` is false, the host executes the editor pipeline as usual, and the panel applies its own entries locally on top of already-transformed data. That is exactly today's behaviour, and nothing is written to the dashboard. `LogsTable.test.tsx` mounts in precisely that shape and passes unchanged.

**Caveat:** two instances of `useAdHocTransformations` in the same panel each hold their own fallback state. `useTransformedData` therefore grew a `transformations` option so a panel that calls both hooks can pass the one it actually wrote to. A shared fallback store would remove the footgun; deliberately not built, because the only clean options are a new context provider or mutating the host's `PanelContext` object.

### 3. The trailing transformation starved the sidebar — hence `splitTrailing`

The field selector enumerates available columns from the frame it is given. Two independent consumers break on the post-`organize` frame:

- `buildColumnsWithMeta.ts:42-59` builds its whole key set by iterating `dataFrame.fields`. Non-displayed fields simply cease to exist, so a label you deselect can never be re-selected. `LogsTable.test.tsx:252-260` asserts against exactly this.
- `getFieldsWithStats.ts:11-22` calls `parseLogsFrame` (returns `null` without a time **and** string body field, `logsFrame.ts:74-76`) and reads label keys out of the `labels` column. `organize` drops that column, so `uniqueLabels` collapses to `[]`.

`filterFieldsByName` also drops frames with no surviving fields (`filter.ts:67-69`), so this is a hard failure, not degraded output.

`useTransformedData(input, { splitTrailing: n })` now also returns `dataBeforeTrailing` — the data as of before the last `n` transformations, with field config applied. Both stages come from a **single** pass (`transformPanelData(head) → switchMap → transformPanelData(tail)`), so the expensive `extractFields` JSON parse still happens once. Opt-in, so the table panel pays nothing.

This generalises rather than being logstable-specific: **Phase 5's table sidebar needs the identical thing.** Any panel that appends a column-selection transformation has to know what was available to select from.

### 4. `context.applyFieldConfig` was not usable by this panel

The plan expected `applyFieldConfig` to close logstable's `merge({}, fieldConfig.defaults, field.config)` gap. The merge loop did go away — but because field config now runs _after_ the transformations, not because the host helper was used. The helper could not be:

- It applies `vizPanel.state.fieldConfig`, but the panel synthesizes `custom.filterable: true` and `custom.wrapText` into its own copy first (`LogsTable.tsx:203-216`). `filterable` has **no** schema default (`defaultTableFieldOptions`, `common.types.ts:43-50`), so losing that augmentation silently disables every column filter. Forcing it after the fact instead would override a per-field override that disables it — a parity break, not a cosmetic one.
- It uses `plugin.fieldConfigRegistry`, which is unreachable in Explore, where no host implementation exists at all.

`useTransformedData` therefore takes an `applyFieldConfig` override, and the panel passes the `applyFieldOverrides` call it already had. This is strictly more capable than adding a `fieldConfig` argument to `PanelContext.applyFieldConfig`, which would still have needed an Explore fallback. `context.applyFieldConfig` remains the right default for panels without a custom registry.

### Incidental fix: field config is no longer applied twice in a dashboard

Worth calling out because it validates the "start from pre-field-config data" rule in the Approach section. `useExtractFields` used to call `applyFieldOverrides` on `props.data.series[frameIndex]`, which `VizPanel.applyFieldConfig()` had **already** processed — two passes, so `setFieldConfigDefaults` appended the panel's default data links a second time (`fieldOverrides.ts:423-425` pushes rather than replaces). Sourcing from `getUntransformedData()` means exactly one pass in a dashboard, so panel data links stop duplicating.

`merge({}, fieldConfig.defaults, field.config)` turned out not to be load-bearing: `setFieldConfigDefaults` merges per registry property and only fills nulls (`fieldOverrides.ts:445-466`), so it never shallow-overwrites `custom`. Non-dashboard hosts still get two passes if the host field-configs its data first, which is unchanged from before.

### Accepted trade-offs

| Trade-off                                                                                                                                                                                                                                                                                                                     | Why it is acceptable                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dirty on first edit-mode open.** Both entries are derived, so the panel writes them on mount. Any non-`data` `SceneDataTransformer` update trips the change tracker (`DashboardSceneChangeTracker.ts:75-79`) and `transformations` is serialized verbatim, so an existing dashboard shows unsaved changes until saved once. | Self-healing: after one save the derived configs equal what is in JSON, `pipelineKey` matches, and no write happens. Stage B is gated on `isEditing`, so view mode never dirties. The write is also gated on data having arrived, so it fires once rather than on every render.                                                                                                             |
| **`organize` applies to every frame.** Today the panel splices only `series[frameIndex]`; in a pipeline all frames are transformed and `includeByName` drops frames with none of the named fields (`filter.ts:67-69`). A logs frame plus a non-logs frame in one panel loses the second from the frame selector.              | `includeByName` derived only from `displayedFields` keeps the persisted config compact, stable, and diff-friendly. The `excludeByName` alternative (computable now that `dataBeforeTrailing` exists) would preserve other frames but make the persisted config data-derived, so every new label rewrites it. `organize`'s own `isApplicable` already reports multi-frame as `NotPossible`.  |
| **Panel entries cannot be deleted or reordered from the editor.** The sync compares the whole pipeline against the arrangement `replaceAdHoc` would produce, so deleting either row — or dragging a user row past one of them — is undone on the next render.                                                                 | They are derived from `options.displayedFields` and the data shape; the sidebar is the way to change them. Restoring beats a table whose columns disagree with its own sidebar, or an `organize` that runs before the transformation whose fields it is meant to select from. Comparing the full pipeline rather than only the panel's own entries is also what makes the check idempotent. |
| **Field names containing `$` or `[[`.** `getTransformations` interpolates the whole pipeline as one JSON string when any entry looks variable-ish (`adHocTransformations.ts:134-139`), so a label literally named `foo$bar` would be mangled.                                                                                 | Pre-existing for any panel-authored transformation, not introduced here. Worth a follow-up: interpolate per entry, or skip entries with `origin.source === 'panel'`.                                                                                                                                                                                                                        |
| **Two `applyFieldOverrides` passes** when `splitTrailing` is used, one per stage.                                                                                                                                                                                                                                             | Keeps the documented contract — each stage gets field config exactly once, from unprocessed frames — instead of applying it mid-pipeline. Memoized on the frames, so it is per data change, not per render. `VizPanel`'s own discarded pass is the bigger waste, and the `skipFieldConfig` follow-up above covers it.                                                                       |

### Trying it out

`logstable` sets `hideFromList: true`, so it is not in the viz picker. Use the existing fixture instead:

```bash
make run && yarn start                      # enable panelAdHocTransformations in conf/custom.ini
# open devenv/dev-dashboards/panel-logstable/logs-table.json
```

What to look for, in order of how much it exercises the new code:

1. Panel edit → Transformations shows **Extract fields** and **Organize fields** rows the panel wrote. Toggling a column in the sidebar rewrites the `organize` row live.
2. Add a transformation between them — e.g. **Filter data by values** on an extracted label. This is the capability that did not exist before: user transformations used to run against the raw frame, so no label column was reachable.
3. Add a transformation that **creates** a field (e.g. **Add field from calculation**). It appears in the sidebar's available list, because the sidebar reads `dataBeforeTrailing`, and becomes selectable.
4. Inspect → Data now shows extracted columns rather than a raw `labels` JSON blob, via `runPanelTransformations`.
5. Switch the viz to Table and back; confirm the pipeline survives and the panel re-derives its entries.
6. Repeat 1–3 in Explore (needs the `logsTablePanelNG` flag). Everything works except that the transformations are not persisted and there is no editor to see them in — that is the local-fallback path from finding 2.

### Phase 6 follow-ups

- Share the fallback pipeline between hook instances, so passing `transformations` explicitly is not required.
- Interpolate transformation configs per entry so field names containing `$` survive.
- Revisit `excludeByName` for `organize` once there is a real multi-frame logs case to test against.
- `useDecorateFields` still rebuilds the first column's cell renderer whenever options change. It is memoized, but a serialisable cell-options descriptor would let even this be a transformation.
