# Per-item (mark) overrides in core Grafana

## Context

Grafana's override system is **field-scoped**: `FieldMatcher` is `(field, frame, allFrames) => boolean`, and every matcher UI (`byName`, `byRegexp`, `byType`, `byFrameRefId`, `byValue`) selects _columns_. For visualizations whose marks are **rows** — node-graph nodes and edges, pie slices, geomap features, canvas elements — there is no way to say "colour **eu-west** red" or "link **us-west → us-east** to a trace". `FieldNameMatcherEditor` actively rejects anything that is not a field display name, and hand-written JSON renders as `gateway (not found)`.

This was diagnosed while building the relations family of an ECharts panel plugin (`todo/relations-item-overrides.md` in `grafana-echarts-panel`). That doc lists five ways out and recommends shipping plugin-local rules now and taking **option 4 — first-class row/item overrides — to core**. This plan is option 4, scoped for core.

Core has already solved the adjacent problem once: PR #119684 (`Dashboard: Add matcher scope to schema`) added `MatcherConfig.scope` (`series | nested | annotation | exemplar`), and PR #119996 (`Table: Add nested field overrides`) built the UI for it. `applyFieldOverrides` skips rules whose `scope` does not match the pass it is running (`packages/grafana-data/src/field/fieldOverrides.ts:122`). That pair is the template this plan follows for mechanics — but **not** for the data model: `scope` selects a _field_ universe from a closed enum, while item kinds (`node`, `edge`, `slice`) are declared by the plugin and open-ended, so they get their own matcher type.

Outcome: a panel plugin declares its item kinds and the properties each supports; core supplies the storage, the matcher registry, the override editor UI, and the resolver; the plugin applies the resolved config to its marks.

## Goal

Ship `fieldConfig.itemOverrides` — a persisted, editable, plugin-extensible sibling to `fieldConfig.overrides` that targets rows instead of fields — with node graph and pie chart as the two in-tree consumers.

## Approach

**Storage: `fieldConfig.itemOverrides`, a third key on `FieldConfigSource`.** The live panel editor reads panel state from `@grafana/scenes`' `VizPanel` (external dep, pinned at 8.13.5), so a brand-new top-level `panel.itemConfig` would need a scenes release on the critical path. `FieldConfigSource` is core-owned in both `@grafana/data` (`packages/grafana-data/src/types/fieldOverrides.ts:58`) and CUE, `panel.onFieldConfigChange` already persists the whole object, and the v1 save/load path spreads it verbatim. This is literally "a sibling to `fieldConfig.overrides`" as the design doc words it, at a fraction of the surface.

**Model: a deliberate analogue of `ConfigOverrideRule`.** `{ matcher: { id, kind, options }, properties: DynamicConfigValue[] }`. `kind` sits on the matcher exactly as `scope` does on `MatcherConfig` — same precedent, same shape, and one rule targets exactly one kind (mirroring the existing "overrides cannot be applied across multiple target scopes" rule at `getFieldOverrideElements.tsx:242`). `DynamicConfigValue` is reused unchanged, so the whole property layer — registries, editors, the "Add override property" picker — comes along for free.

**Reuse over invention.** Item property registries are `FieldConfigOptionsRegistry` instances holding `FieldConfigPropertyItem`s, because every standard item we care about is already field-agnostic (`color` and `links` use `shouldApply: () => true` with `identityOverrideProcessor` / `dataLinksOverrideProcessor`, `public/app/core/components/OptionsUI/registry.tsx:371,402`). That means `DynamicConfigValueEditor`, `OptionsPaneCategoryDescriptor`, `ValuePicker`, `FieldConfigEditorBuilder` and every existing editor render item properties with no changes. Only three things are genuinely new: an `itemMatchers` registry, an `applyItemOverrides` resolver, and the matcher editors.

**Ordering.** Schema first (so rules survive a round trip through the API server), then the frontend model, then the editor, then one consumer per PR, then docs. Backend and frontend are separate PRs per `AGENTS.md`.

## The stored model

```jsonc
// panel.fieldConfig
{
  "defaults": {
    /* unchanged */
  },
  "overrides": [
    /* unchanged, field-scoped */
  ],
  "itemOverrides": [
    {
      "matcher": { "id": "byItemIds", "kind": "node", "options": ["eu-west", "us-east"] },
      "properties": [{ "id": "color", "value": { "mode": "fixed", "fixedColor": "red" } }],
    },
    {
      "matcher": { "id": "byItemRegexp", "kind": "edge", "options": "^us-west" },
      "properties": [{ "id": "custom.thickness", "value": 3 }],
    },
  ],
}
```

## PR breakdown

Seven PRs: two backend, four frontend, one docs. Each leaves `main` working and reviewable on its own.

| #   | Side     | Title                                                | Depends on |
| --- | -------- | ---------------------------------------------------- | ---------- |
| 1   | backend  | Dashboard: add `fieldConfig.itemOverrides` to schema | —          |
| 2   | backend  | FeatureToggles: add `dashboard.itemOverrides`        | —          |
| 3   | frontend | ItemOverrides: data model, matchers and resolver     | 1          |
| 4   | frontend | ItemOverrides: panel editor UI                       | 2, 3       |
| 5   | frontend | NodeGraph: per-node and per-edge overrides           | 3, 4       |
| 6   | frontend | PieChart: per-slice overrides                        | 3, 4       |
| 7   | docs     | Docs: document item overrides                        | 5, 6       |

---

### PR 1 — backend: add `itemOverrides` to the dashboard schema

Additive optional field, so **no `schemaVersion` bump and no v1 migration**. Mirror PR #119684 exactly.

**Modify (hand-written CUE):**

- `kinds/dashboard/dashboard_kind.cue:723` — add `itemOverrides?: [...#ItemOverrideRule]` to `#FieldConfigSource`; define `#ItemOverrideRule` and `#ItemMatcherConfig` next to `#MatcherConfig` (`:747`), reusing `#DynamicConfigValue`.
- `apps/dashboard/kinds/v2alpha1/dashboard_spec.cue`, `.../v2beta1/dashboard_spec.cue`, `.../v2/dashboard_spec.cue` — same addition to `FieldConfigSource` (`v2beta1:172`) and `ItemOverrideRule` / `ItemMatcherConfig` next to `MatcherConfig` (`v2beta1:276`).

**Modify (conversions + tests) — the four pairs that hand-map field config:**

- `apps/dashboard/pkg/migration/conversion/v1_to_v2alpha1.go` — `extractFieldConfigSource` (`:2535`) gains `extractItemOverrides`; add `buildItemMatcherConfig` beside `buildMatcherConfig` (`:2942`).
- `.../v2alpha1_to_v1.go` — `convertFieldConfigSourceToV1` (`:2016`) emits `itemOverrides`.
- `.../v2alpha1_to_v2beta1.go` + `.../v2beta1_to_v2alpha1.go` — extend `convertFieldConfigSource_*` (`:318`).
- `.../v2beta1_to_v2.go` + `.../v2_to_v2beta1.go` — same.
- One test per direction in the existing `*_test.go` files, asserting `itemOverrides` (including `matcher.kind` and an unknown-kind rule) survives round trips.

**Generated (do not hand-edit):** run `make gen-cue`, `make gen-apps app=dashboard`, `yarn generate-apis`. Expect churn in `apps/dashboard/pkg/apis/dashboard/**/dashboard_spec_gen.go`, `zz_generated.openapi.go`, `dashboard_manifest.go`, `pkg/kinds/dashboard/dashboard_spec_gen.go`, `packages/grafana-schema/src/raw/dashboard/x/types.gen.ts`, `packages/grafana-schema/src/schema/dashboard/v2*/types.spec.gen.ts`, and the api-clients/openapi JSON. The `FieldConfigSource` veneer at `packages/grafana-schema/src/veneer/dashboard.types.ts:53` extends the raw type, so it picks the field up with no edit.

**Acceptance criteria**

- `go test ./apps/dashboard/pkg/migration/...` passes; if testdata changes, checksums regenerated with `REGENERATE_CHECKSUMS=true go test ./apps/dashboard/pkg/migration/...`.
- `CODEGEN_VERIFY=1 make gen-apps app=dashboard` reports generated code up to date.
- A v1 dashboard JSON containing `fieldConfig.itemOverrides` round-trips v1 → v2alpha1 → v2beta1 → v2 → v1 byte-identical in that field, including a rule whose `matcher.kind` no core panel declares.

### PR 2 — backend: feature toggle

**Modify:** `pkg/services/featuremgmt/registry.go` — add

```go
{
    Name:         "dashboard.itemOverrides",
    Description:  "Enables per-item (row) overrides in the panel editor for visualizations whose marks are rows",
    Stage:        FeatureStageExperimental,
    Owner:        grafanaDatavizSquad,
    HideFromDocs: true,
    Expression:   "false",
    Generate:     Generate{React: true},
},
```

Then `make gen-feature-toggles`. Generated: `toggles_gen.go`/`toggles_gen.json`, `packages/grafana-runtime/src/internal/openFeature/openfeature.gen.ts` (yields `useDashboardItemOverrides()`), `openfeature-types.gen.d.ts`, docs. Follows the `table.refactorNested` precedent (`registry.go:2994`).

Note the flag gates only the **editor UI**. Schema acceptance and the resolver stay unflagged so provisioned dashboards keep working regardless.

**Acceptance criteria:** `go test ./pkg/services/featuremgmt/...` passes; `useDashboardItemOverrides` exists in `openfeature.gen.ts`.

### PR 3 — frontend: data model, matchers and resolver (`@grafana/data`)

No UI, no consumer — pure model plus unit tests.

**Create:**

- `packages/grafana-data/src/types/itemOverrides.ts`

  ```ts
  /** One selectable mark within a panel — a node, an edge, a slice. */
  export interface PanelItem {
    /** Stable id; this is what matchers store in dashboard JSON. */
    id: string;
    /** Human label for the matcher UI and rule summary. Defaults to id. */
    label?: string;
    description?: string;
  }

  /** Selects marks of one kind. Analogue of MatcherConfig; `kind` mirrors `scope`. */
  export interface ItemMatcherConfig<TOptions = any> {
    id: string;
    kind: string;
    options?: TOptions;
  }

  /** Analogue of ConfigOverrideRule for marks that are rows. */
  export interface ItemOverrideRule {
    matcher: ItemMatcherConfig;
    properties: DynamicConfigValue[];
  }

  /** A mark universe declared by a panel plugin. */
  export interface ItemKindDescriptor<TItemConfig extends object = {}> {
    id: string;
    name: string;
    getItems: (data: DataFrame[]) => PanelItem[];
    /** Standard properties offered for this kind. Defaults to [Color, Links]. */
    standardOptions?: Partial<Record<FieldConfigProperty, StandardOptionConfig>>;
    useCustomConfig?: (builder: FieldConfigEditorBuilder<TItemConfig>) => void;
  }
  ```

- `packages/grafana-data/src/transformations/itemMatchers/` — `itemMatchers` registry (mirrors `transformations/matchers`), `ItemMatcher = (item: PanelItem) => boolean`, with `byItemIds` (options: `string[]`, set membership on `id`), `byItemRegexp` (options: `string`, tested against `label ?? id`), `allItems`.
- `packages/grafana-data/src/field/itemOverrides.ts` — `applyItemOverrides()` returning `Map<string, TItemConfig>` (item id → resolved config; entries only for matched items), plus a private `setItemConfigValue` that reuses `item.process(value, context, item.settings)` and lodash `set`/`unset` exactly like `setDynamicConfigValue` (`fieldOverrides.ts:379`) minus the `isCustom` branch. Rules apply in array order, last write wins per property; unknown matcher ids and unknown kinds are skipped with a `console.warn`, matching `fieldOverrides.ts:128`.

**Modify:**

- `packages/grafana-data/src/types/fieldOverrides.ts:58` — `itemOverrides?: ItemOverrideRule[]` on `FieldConfigSource`, marked `@alpha`.
- `packages/grafana-data/src/panel/registryFactories.ts` — `createItemConfigRegistry(kind, pluginName)`: builds a `FieldConfigOptionsRegistry` from `kind.useCustomConfig` (custom ids prefixed `custom.`, as `createFieldConfigRegistry:33` does) plus the allowlisted entries of `standardFieldConfigEditorRegistry`, with the colour item's settings forced to `{ byValueSupport: false, bySeriesSupport: false }` so only fixed-colour modes are offered.
- `packages/grafana-data/src/panel/PanelPlugin.ts` — `useItemConfig({ kinds })` following the lazy `_initConfigRegistry` pattern (`:171`); getters `itemKinds` and `getItemConfigRegistry(kindId)`.
- `packages/grafana-data/src/panel/getPanelOptionsWithDefaults.ts:53` — carry `itemOverrides` through `applyFieldConfigDefaults` and drop rules whose `matcher.kind` the new plugin does not declare, or whose properties are absent from that kind's registry (mirroring the existing `filterFieldConfigOverrides` step at `:79`). Without this, every item rule is silently dropped on panel load.
- `packages/grafana-data/src/index.ts` — export the new types, registry and resolver.

**Tests:** `itemOverrides.test.ts` (ordering, last-write-wins, unknown kind/matcher/property, `custom.` paths), `itemMatchers.test.ts`, and new cases in `getPanelOptionsWithDefaults.test.ts` for preserve-and-prune.

**Acceptance criteria**

- `yarn jest --no-watch packages/grafana-data/src/field/itemOverrides.test.ts` and the matcher/defaults tests pass.
- `applyItemOverrides` with two rules touching the same item returns the later rule's value for the shared property and both values for disjoint ones.
- Switching a panel type keeps rules whose kind the new plugin declares and drops the rest, with `defaults` and `overrides` untouched.

### PR 4 — frontend: panel editor UI

**Create:**

- `packages/grafana-ui/src/components/MatchersUI/items/` — `itemMatchersUI` registry + `types.ts` (mirroring `MatchersUI/fieldMatchersUI.ts` and its `FieldMatcherUIRegistryItem`), `ItemIdsMatcherEditor.tsx` (multi-select `Combobox` over `kind.getItems(data)`, rendering unknown stored ids as `{{name}} (not found)` — reuse the string from `MatchersUI/utils.ts:223`), `ItemRegexpMatcherEditor.tsx`, and `ItemKindSelector.tsx` (`RadioButtonGroup` over the plugin's declared kinds, a direct analogue of `MatcherScopeSelector.tsx`, shown only when a plugin declares more than one kind).
- `public/app/features/dashboard/components/PanelEditor/getItemOverrideElements.tsx` — `getItemOverrideCategories(fieldConfig, plugin, data, searchQuery, onFieldConfigsChange)`, structurally the same as `getFieldOverrideElements.tsx`: one `OptionsPaneCategoryDescriptor` per rule containing kind selector → matcher editor → property editors (`DynamicConfigValueEditor`, unchanged) → "Add override property" `ValuePicker` scoped to that kind's registry, plus a trailing "Add item override" button. Unknown matcher ids get the same non-crashing `Alert` treatment as `getFieldOverrideElements.tsx:115`.

**Modify:**

- `public/app/features/dashboard/components/PanelEditor/OverrideCategoryTitle.tsx` — widen to accept a pre-computed matcher label and property-name list so both override families share one title component.
- `public/app/features/dashboard-scene/panel-edit/PanelOptions.tsx:62` — build item categories alongside `justOverrides` when `useDashboardItemOverrides()` is on and `plugin.itemKinds?.length`, appending them in both the `OptionFilter.All` and `OptionFilter.Overrides` branches and to `renderSearchHits`. (`OptionsPaneOptions.tsx` is the pre-scenes path and is now referenced only by its own test — no wiring needed there.)
- `public/app/features/dashboard-scene/panel-edit/PanelOptionsPane.tsx:88` — the plugin-change rebuild constructs `{ defaults, overrides }` and would drop `itemOverrides`; carry it through, then let `getPanelOptionsWithDefaults` prune.
- `public/app/features/dashboard/state/PanelModel.ts:387` — same carry-through on the legacy model path.
- `public/app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2.ts:337` — include `itemOverrides` in the v2 `vizFieldConfig`. (v1 write at `transformSceneToSaveModel.ts:240` casts the whole object, and the read path spreads it at `transformToV1TypesUtils.ts:169` — both already correct.)
- `make i18n-extract` for the new strings.

**Tests:** `getItemOverrideElements.test.ts` mirroring the existing override-elements test; a `transformSceneToSaveModelSchemaV2` case asserting `itemOverrides` survives; an RTL test that a rule added in the editor lands on `fieldConfig.itemOverrides` with the right `matcher.kind`.

**Acceptance criteria**

- With the flag on and a panel declaring two kinds, "Add item override" produces a rule whose kind can be switched, whose ids come from real panel data, and whose property list is that kind's registry only.
- With the flag off, no item-override UI renders and existing field overrides are unchanged.
- A rule created in the editor, saved, and reloaded (both v1 and v2 dashboards) comes back intact.

### PR 5 — frontend: node graph consumer

Two kinds in one panel — the case that stresses the design.

**Modify:**

- `public/app/plugins/panel/nodeGraph/module.tsx:9` — add `.useItemConfig({ kinds: [nodeKind, edgeKind] })`. `nodeKind.getItems` reads the node frame's `id` field (labelled with `title` when present); `edgeKind.getItems` reads the edge frame's `id`, labelled `source → target`. Both reuse the existing `getNodeFields` / `getEdgeFields` helpers in `utils.ts`. Standard options: `Color`, `Links`. Custom via `useCustomConfig`: `nodeRadius` (nodes), `thickness` and `strokeDasharray` (edges).
- New `public/app/plugins/panel/nodeGraph/itemConfig.ts` — the kind descriptors plus a `resolveItemStyles(fieldConfig, data)` wrapper over `applyItemOverrides`.
- `public/app/plugins/panel/nodeGraph/NodeGraphPanel.tsx:13` — `PanelProps.fieldConfig` is already in scope (`packages/grafana-data/src/types/panel.ts:100`); resolve both maps and pass them to `NodeGraph`.
- `public/app/plugins/panel/nodeGraph/NodeGraph.tsx:121` (`Props`) and `:165` (the `processNodes` memo) — accept the maps and merge resolved styles onto the datums.
- `public/app/plugins/panel/nodeGraph/types.ts` — an optional resolved-style bag on `NodeDatum` / `EdgeDatum`. Needed because `NodeDatum.color` and `NodeDatum.nodeRadius` are `Field`s read through a display processor (`Node.tsx:212`, `utils.ts:368`), whereas an override yields a concrete value; keeping them separate avoids synthesising fake fields.
- `public/app/plugins/panel/nodeGraph/Node.tsx:212` and `Edge.tsx` — prefer the resolved value over the field-derived one. **Precedence: item override beats the data-driven `color`/`nodeRadius`/`thickness` columns**, consistent with field overrides beating datasource-supplied field config.
- Per-item links join the field-derived ones in `useContextMenu.tsx` rather than replacing them.
- `devenv/dev-dashboards/panel-nodegraph/nodegraph_item_overrides.json` (new) using the testdata datasource's `nodeGraph` query type (`pkg/tsdb/grafana-testdata-datasource/scenarios.go:190`) + an entry in `devenv/jsonnet/dev-dashboards.libsonnet`.
- `e2e-playwright/panels-suite/nodegraph-item-overrides.spec.ts` (new) — add a node rule in the editor, assert the node's stroke changes; add an edge rule, assert stroke width changes.

**Acceptance criteria**

- With the flag on, an `Override → Nodes → gateway → Color = red` rule paints only that node red; other nodes keep their palette colour.
- An `Edges → byItemRegexp` rule with `custom.thickness` thickens only matching edges.
- A per-node data link appears in that node's context menu and nowhere else.
- `yarn jest --no-watch public/app/plugins/panel/nodeGraph` and the new Playwright spec pass.

### PR 6 — frontend: pie chart consumer

Proves the abstraction on a second, structurally different family, and closes a real gap: with `reduceOptions.values: true` each slice is a **row**, so today no override can target one.

**Modify:**

- `public/app/plugins/panel/piechart/module.tsx` — `.useItemConfig({ kinds: [sliceKind] })`; `getItems` derives ids from `getFieldDisplayValues(...).map(fd => fd.display.title)` (mirroring the keying `PieChart.tsx` already uses at `:280`, `:429`). Standard options: `Color`, `Links`.
- `public/app/plugins/panel/piechart/PieChartPanel.tsx:47` — resolve after `getFieldDisplayValues` and overlay the resolved colour onto `display.color` (the same slot `PieChart.tsx:92,428` already reads), so `PieChart.tsx` needs no change.
- `public/app/plugins/panel/piechart/PieChartPanel.test.tsx` — a case asserting one slice recolours while its neighbours do not, in both "Calculate" and "All values" reduce modes.

**Acceptance criteria**

- In "All values" mode, a slice rule targeting a row value recolours exactly that slice — the case field overrides cannot express.
- Legend swatch and tooltip agree with the overridden slice colour.

### PR 7 — docs

**Modify:** `docs/sources/visualizations/panels-visualizations/configure-overrides/index.md` — a section on item overrides: what a mark is, how kinds differ from field scopes, which panels support it, that ids are matched by value so a renamed id shows as "not found", and that item overrides beat data-driven style columns. Follow `docs/AGENTS.md`.

---

## Verification

Run from the repo root; use a login shell for frontend commands.

```bash
# PR 1
make gen-cue && make gen-apps app=dashboard && yarn generate-apis
go test ./apps/dashboard/pkg/migration/...
CODEGEN_VERIFY=1 make gen-apps app=dashboard

# PR 2
make gen-feature-toggles && go test ./pkg/services/featuremgmt/...

# PR 3, 4
yarn jest --no-watch packages/grafana-data/src/field/itemOverrides.test.ts
yarn jest --no-watch public/app/features/dashboard/components/PanelEditor
yarn jest --no-watch public/app/features/dashboard-scene/serialization
yarn typecheck && yarn lint

# PR 5, 6
yarn jest --no-watch public/app/plugins/panel/nodeGraph public/app/plugins/panel/piechart
yarn e2e:playwright e2e-playwright/panels-suite/nodegraph-item-overrides.spec.ts
```

**End-to-end, by hand** (needs `make run` + `yarn start`, and the flag enabled in `conf/custom.ini` under `[feature_toggles]`):

1. Open the provisioned node-graph demo dashboard, edit the panel, confirm an "Item overrides" section appears under the field overrides.
2. Add `Nodes → gateway → Color = red`; the node recolours immediately and no other node changes.
3. Switch the kind selector to `Edges`; the id list repopulates with `source → target` labels and the property list changes to the edge registry.
4. Save, reload, reopen the editor — the rule is intact. Inspect → Panel JSON shows it under `fieldConfig.itemOverrides`.
5. Repeat on a v2 (`dashboardNewLayouts`) dashboard to exercise the v2 serializer and the Go conversions.
6. Switch the panel type to pie chart and back: slice-kind rules are dropped, node/edge rules return.
7. Turn the flag off: the UI disappears, previously saved rules still render (resolver is unflagged) and are not stripped on save.

## Risks & mitigations

- **Silent rule loss at pruning sites.** Three places rebuild `FieldConfigSource` from its parts and would drop a new key: `getPanelOptionsWithDefaults.ts:53`, `PanelOptionsPane.tsx:88`, `PanelModel.ts:387`. All three are in PRs 3–4 with tests; a fourth (`transformSceneToSaveModelSchemaV2.ts:337`) drops it on save. This is the single most likely bug, so each gets an explicit assertion.
- **Backend drops the field until PR 1 lands.** The v1→v2 conversion hand-maps field config, so item rules would vanish for anyone on v2 dashboards. Mitigated by landing PR 1 first and keeping the flag off until PR 4.
- **Two `FieldConfigSource` types.** The generated schema type (`packages/grafana-schema/src/raw/dashboard/x/types.gen.ts:1007`, veneered at `veneer/dashboard.types.ts:53`) and the hand-written `@grafana/data` one (`types/fieldOverrides.ts:58`) both need the field — the first from codegen in PR 1, the second by hand in PR 3. Divergence would surface as a type error at the serialization boundary; `yarn typecheck` catches it.
- **Item ids are not stable across refreshes.** `byItemIds` breaks if a node id changes. Mitigated by offering `byItemRegexp` and by reusing the existing "(not found)" affordance instead of silently discarding the rule — the same contract `byName` has today.
- **Node graph style plumbing is `Field`-shaped.** `NodeDatum.color` / `nodeRadius` are `Field`s consumed through a display processor. Adding a separate resolved-style bag rather than synthesising fields keeps the diff contained, at the cost of two lookup sites in `Node.tsx` / `Edge.tsx`.
- **Second overrides UI in the pane.** Two "Override 1" families could confuse. Mitigated by a distinct section heading, kind-named rule summaries ("Nodes → gateway → Color"), and the flag defaulting off while UX reviews it.

## Explicitly out of scope

- `panel.itemConfig` as a top-level field (needs a `@grafana/scenes` release; revisit once the abstraction is proven).
- Widening `MatcherScope` with item kinds — kinds are plugin-declared and open-ended; conflating them with the closed field-universe enum is the dishonesty option 5 was rejected for.
- System item overrides (`__systemRef`) for legend-click hiding, the analogue of `SeriesVisibilityConfigFactory.ts`. Natural follow-up once the model is in.
- Geomap features, canvas elements, state-timeline rows — additional consumers, each a later PR.
- Retiring the plugin-local `relationsItemRules` editor in `grafana-echarts-panel`; that migration happens plugin-side once these APIs ship, and the stored shape is deliberately close enough to make it mechanical.
