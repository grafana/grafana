## Context

This branch (`gtk-grafana/dataviz/ad-hoc-transforms-poc__2-ui-hooks`) has already landed the foundation from `.air/plans/ad-hoc-panel-transformations.plan.md`: the feature toggle and schema (Phase 1), the bypass plumbing (Phase 2), and — confirmed by directly reading the current source, not just the plan doc — the real, working `@grafana/ui` hooks (Phase 3):

- `packages/grafana-ui/src/components/PanelChrome/useAdHocTransformations.ts` — `{ enabled, transformations, adHocTransformations, add, replaceAdHoc, clearAdHoc, set }`
- `packages/grafana-ui/src/components/PanelChrome/useTransformedData.ts` — runs the pipeline, applies field config after, and supports `splitTrailing` so a panel can see the data as it was before its own trailing transformation (e.g. a column picker that needs to offer back columns the panel itself hid)
- `packages/grafana-ui/src/components/PanelChrome/PanelContext.ts` — `isAdHocTransformsEnabled`, `getTransformations`, `setTransformations`, `getUntransformedData`, `applyFieldConfig`

There's also a `chore(poc): logstable with ad-hoc-transforms poc` commit already on this branch — `public/app/plugins/panel/logstable/hooks/useLogsTableTransformations.ts` — which is exactly the base plan's Phase 6. **Per your instructions, that work is excluded here entirely** — it's in flight, not a gap to fill. It's referenced below only as proven prior art: it's the one shipped example of `replaceAdHoc({ before, after })`, a `pipelineKey` idempotency check, and `splitTrailing` for a field picker, and every new idea below follows the same shape rather than inventing a new one.

The question this document answers: now that a panel _can_ read and write its own pipeline, what else becomes possible — beyond Table's planned "hide column" menu / field-selector sidebar (Phase 4/5, already scoped) and beyond logstable (excluded)? I researched this from three angles and cross-checked the highest-leverage claims directly against source rather than trusting either research pass at face value:

1. **Codebase**: the full transformation catalog with each one's config-UI complexity and any panel pairing Grafana's own docs already call out, plus every place a panel _already_ does local, non-transformation UI to change its displayed data (legend hide-series, table sort-on-click, cell filter buttons, geomap location mapping) — these are either prior art or consolidation targets.
2. **GitHub**: real issues (with reaction/comment counts pulled via `gh`) and Grafana community forum threads, so demand signal below is evidence, not a guess.
3. **Independent brainstorm**: a second pass (Plan agent) generated ideas from the same research, which I then spot-checked — 8 for 8 — against the actual current source (hook APIs, transformer option shapes, `PanelContext.onSelectRange`, the logstable PoC file). That agent's own hedges (e.g., "I did not verify this deeply") are preserved below rather than smoothed over.

**How to read confidence below**: a numbered GitHub issue with reactions is the strongest signal; an explicit "useful for panel X" line in Grafana's own transformation docs is next; a characterization from the catalog research is weaker; "conceptually plausible, no citation" is the weakest and is labeled as such every time.

## Tier 1 — strongest evidence, cleanest fit

### 1. Row-to-Tile Configurator

**Stat / Gauge / BarGauge / Pie chart × `rowsToFields`**

Grafana's own docs explicitly name this pairing ("Useful when visualizing data in: Gauge, Stat, Pie chart"), and GitHub issue #40425 (10 comments) shows exactly where it breaks down today: a user wanted one gauge per table row with per-row Max/Threshold from other columns, got the reshape but not the field config, and gave up after "bashing my head against this for a solid day." The transform's options are forgiving of a narrow UI — `RowToFieldsTransformOptions { nameField?, valueField?, mappings? }` (verified: `public/app/features/transformers/rowsToFields/rowsToFields.ts:21-25`) — `mappings` is optional, so a v1 affordance can skip the complex field-to-config matrix editor entirely and still solve "one row → one tile."

- **UI**: when a Stat/Gauge/BarGauge/Pie chart gets a wide table it hasn't reshaped yet, an inline empty-state prompt in the visualization area: "This looks like a table — turn each row into its own tile?" with two dropdowns (Name column, Value column).
- **Technical approach**: `add({ id: 'rowsToFields', options: { nameField, valueField } })`. Populate the dropdowns from `useTransformedData(data, { splitTrailing: 1 }).dataBeforeTrailing` so the picker shows pre-reshape columns. A v2 closing #40425's actual gap would add one more narrow control ("use column X to set each tile's max/threshold") that appends a single `FieldToConfigMapping` entry — still never rendering the general matrix editor.

### 2. Exclude Bad Readings

**Time series × `filterByValue`**

The demand for "hide something from a graph" is real (see Bad Fits below) but most of it is actually about hiding a whole flat/noisy _series_, which has a better-suited existing mechanism. What's left standing for `filterByValue` specifically is the case that mechanism can't cover: an actual bad data point (sensor glitch, ingestion blip) that should be removed from the pipeline, not just hidden from view — because a display-only hide still skews any downstream `reduce`/Stat calculation. That correctness distinction is the real argument for a transformation here.

- **UI**: a brush-select gesture on the time series canvas (toolbar "Exclude" mode, or a modifier+drag) draws a value-range band, then a small popover: "Exclude readings between X–Y for [field]?"
- **Technical approach**: `PanelContext.onSelectRange` already turns a drag into `RangeSelection2D { x?, y? }` (verified: `PanelContext.ts:52`, `types.ts:15-24`) — a Y-range maps directly onto `FilterByValueTransformerOptions { filters: [{ fieldName, config: MatcherConfig }], type, match }` (verified: `packages/grafana-data/src/transformations/transformers/filterByValue.ts:21-30`) using a `between` value matcher. Open product question to settle before building: does each brush-select `add()` a new stacking exclusion, or does it `replaceAdHoc` a single "current exclusion"?

### 3. Real Sort, Finally

**Bar chart / Pie chart × `sortBy`**

Table's header-click-to-sort already bypasses the real `sortBy` transformation, persisting into a parallel `options.sortBy` panel option instead (confirmed: `public/app/features/table/utils.ts:65-77`) — an acknowledged inconsistency, not a pattern to repeat. Bar chart and Pie chart have **no sort control at all** today (confirmed: neither `panelcfg.gen.ts` has a sort field). This is a genuinely missing capability, and the transform itself is the simplest in the whole catalog: `SortByTransformerOptions { sort: SortByField[] }`, with the source comment confirming only the first entry is ever used (verified: `packages/grafana-data/src/transformations/transformers/sortBy.ts:13-19`).

- **UI**: a field dropdown + asc/desc toggle in the panel toolbar — visible and usable in **view mode**, not just edit, so Viewers get it too.
- **Technical approach**: `replaceAdHoc([{ id: 'sortBy', options: { sort: [{ field, desc }] } }])`, kept in sync with the toolbar control.

### 4. Show Top N

**Bar chart / Pie chart × `sortBy` + `limit`**

Directly answers a recurring community-forum theme (wanting to see a calculated/filtered subset "without losing the rest") reframed as "too many bars/slices." No specific issue number, but `limit` is a one-input transform and pairs naturally with idea #3's toolbar.

- **UI**: "Show: Top 5 / 10 / 20 / All" dropdown next to the sort control from #3, in the same toolbar, Viewer-usable.
- **Technical approach**: `replaceAdHoc([sortByEntry, { id: 'limit', options: { limitField, limit: n } }])`. Use `useTransformedData(data, { splitTrailing: 2 }).dataBeforeTrailing` to show "Top 10 of 47" in the dropdown label. Share the sort-entry code with #3 rather than duplicating it.

## Tier 2 — solid evidence, more design or engineering lift

### 5. Quick Calculated Series

**Time series (secondarily Table) × `calculateField`**

No GitHub issue or docs pairing, but this is the standard shape of "add a computed percentage/delta/ratio column" requests seen in the community themes. `CalculateFieldTransformerOptions` has 6 mutually-exclusive sub-modes (binary/unary/reduceRow/index/cumulative/window) — a narrow affordance only needs to expose one (binary: A op B) to cover the common case.

- **UI**: toolbar/edit-hover button "Add calculated series" → inline form (Operation, Field A, Field B, Name).
- **Technical approach**: `add({ id: 'calculateField', options: { mode: 'binary', binary: { left, operator, right }, alias } })`. Use `add()`, not `replaceAdHoc` — a second calculated series should be a second entry, and once added it's a normal, independently-editable row in the Transform tab.

### 6. Sniff-and-Extract JSON

**Time series × `extractFields`** — deliberately the _non_-logs pairing; docs separately and explicitly name Time series as a use case for this transform.

The bigger win isn't the transform itself but the interaction pattern: community complaints center on configuring transformations "blind" in a disconnected tab. A panel already holding the live data can offer real JSON keys instead of an empty JSONPath input.

- **UI**: when a string/JSON-shaped field sits alongside the time field, a dismissible banner — "This field looks like JSON — extract as separate lines?" — opens a checklist of _actual keys found in the data_.
- **Technical approach**: `add({ id: 'extractFields', options: { source, format: 'json', jsonPaths: checkedKeys.map(k => ({ path: k, alias: k })) } })`. The general editor is Complex (branching source/format pickers), but the panel only ever needs the JSON branch, pre-populated — the branch is a foregone conclusion once the banner is showing at all.

### 7. Un-pivot for Bars

**Bar chart × `partitionByValues`**

Docs say this is "particularly useful when dealing with a metrics SQL table" — one row per category rather than one field per category, the classic shape mismatch that makes a SQL result render wrong in Bar chart until reshaped. No GitHub issue, but a narrow, low-risk config.

- **UI**: detect a table-shaped result (one categorical field + numeric fields, many rows) → "Split into bars by [column]?"
- **Technical approach**: `add({ id: 'partitionByValues', options: { fields: [chosenColumn] } })` — the general editor supports a growable field list; the panel only ever needs one.

### 8. One Location Brain — _needs a design spike before feasibility is proven_

**Geomap ↔ `spatial`**

The clearest _duplication_ finding, not just a missing feature: Geomap's per-layer location mapping (`addLocationFields`, panel options) and the standalone `spatial` transformation's "Prepare spatial field" step both call the same `getLocationMatchers`/`getGeometryField` utilities. The Route layer separately re-implements "points → line" at render time — exactly what `spatial`'s `LineBuilder` operation already does in the pipeline. Two independent implementations of the same geometry logic.

- **UI**: in Geomap's Location editor, a "Promote to transformation" action that materializes the current layer's location config as a persisted, reusable pipeline step — visible to Inspect and to _other_ panels via the Dashboard datasource, not locked inside one layer.
- **Real tension to resolve first**: Geomap panels commonly have multiple layers, each potentially wanting a _different_ derived geometry at once — that doesn't map cleanly onto "one linear pipeline appended after the editor's transforms" the way a single-query Table does. Worth a short design pass before committing engineering time; `spatial` is also still alpha.

## Tier 3 — roadmap-worthy, weaker evidence

| #   | Idea                             | Panel × transform                      | Evidence                                                                                                                                                          | Note                                                                                               |
| --- | -------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 9   | Label as Location Field          | Geomap × `labelsToFields`              | Community-forum-level (Prometheus label pivoting)                                                                                                                 | Simple options shape; use `replaceAdHoc({ before })`, same position as logstable's `extractFields` |
| 10  | One Aggregation, Many Fields     | Bar chart × `groupBy`                  | No citation — illustrates a compression trick (delegate "which field is the key" to the panel's existing X-axis option) more than it reflects proven demand       | Sequence behind Tier 1/2                                                                           |
| 11  | Config From a Second Query       | any × `configFromData`                 | No citation; general-purpose sibling of idea #1                                                                                                                   | Build only after #1's mapping-entry UI exists, and share it                                        |
| 12  | Join Two Queries Into One Series | Time series / XY chart × `joinByField` | Docs pairing is Table-flavored, not Time-series-specific — scoped here deliberately to stay non-duplicative of Phase 4/5, but no direct evidence for this pairing | Simple 2-dropdown config regardless                                                                |
| 13  | Trendline on Demand              | Time series × `regression`             | Weakest — catalog lists no documented pairing, options shape not independently verified                                                                           | Short spike, not a commitment                                                                      |

Transforms with no proposed idea at all — `formatString`, `formatTime`, `convertFieldType`, `transpose`, `groupingToMatrix`, `concatenate`, `joinByLabels`, `groupToNestedTable`, `smoothing` — sit in the lowest evidence tier with nothing found to contradict that; proposing panel affordances for them now would be speculation dressed as research.

## Explicitly bad fits — don't build these with this mechanism

- **Hide a whole flat/zero/noisy series** (time series/graph panels). This has the _strongest_ raw GitHub signal in the entire research pass (issues #1007, #5788 (4 👍), #46734, Discussion #38299 — one comment calls the old Graph panel's equivalent "a lifesaver" and its absence "a big oversight") — but `filterByValue` drops _rows_ (every field's value at that time), the wrong semantic for "drop one named series." The existing legend `hideSeriesFrom` override already does this correctly and is tagged for provenance (`__systemRef`, verified: `packages/grafana-data/src/types/fieldOverrides.ts:31-55`). The fix is a "hide all currently-zero series" bulk action through that existing factory, not a transform.
- **Isolate/hide a single value on Stat, Gauge, BarGauge.** These panels never wire up `onToggleSeriesVisibility` the way their graphical siblings do — that's a real gap, but the fix is wiring the _existing_ override mechanism into this panel family. Doing it via `filterFieldsByName`/`organize` instead would fully drop the field from the frame, recreating issue #24092 — **98 👍, 5 ❤️, 52 comments, opened 2020, still unresolved** — where hiding a field via a transformation broke a data link elsewhere that referenced its value. This is the single strongest quantitative signal found in this whole research pass, and it argues _against_ a transformation-based hide, not for one.
- **Table/Logs cell "filter for"/"filter out."** Already correctly built on the ad-hoc-filter-_variable_ mechanism (`onAddAdHocFilter`), which reruns the query and can affect every panel sharing that variable — a materially different, more powerful semantic than reshaping one panel's already-fetched data. Don't collapse the two.
- **`reduce` for Stat/Gauge/BarGauge.** Already solved by the "Value options → Calculation" panel option. A transform-based version would give one panel family two ways to do the same thing.
- **`heatmap`/`histogram` for their own panels.** Likely redundant with native bucketing options, same shape as the `reduce` case — not independently verified, so audit before assuming it's open ground.
- **`renameByRegex`, `filterByRefId` as standalone affordances.** No demand signal for either; `filterByRefId`'s job (suppress one query's contribution) is already one click via the query editor's existing per-query hide toggle.
- **Table column resize (`custom.width`).** Correctly modeled today as a field-config override — width is layout, not a data reshape. Relevant here only as a provenance-consistency cleanup (see below): it writes an override with no tag at all, unlike the legend mechanism.

## Platform-level capabilities

- **One "reset ad-hoc changes" affordance, not one per panel.** `clearAdHoc(predicate?)` already supports both a full reset and a scoped one (verified: `useAdHocTransformations.ts:133-137`). Every idea above produces `origin: {source:'panel'}` entries this can already strip — building this once at the `PanelChrome`/host level (gated on `adHocTransformations.length > 0`) is far cheaper than trusting each future panel author to build their own undo button.
- **Two provenance conventions exist independently — worth aligning.** This project's `origin: {source, pluginId}` on transformations is a structured version of the same idea the codebase already solved for field overrides via the bare-string `__systemRef` tag. While in this area, the untagged column-width resize override (bad-fits list) is a one-line fix to bring it into a consistent convention.
- **Idea #8 (Geomap) is the concrete instance of "consolidate scattered mechanisms"** — worth citing as the flagship example precisely because the duplication was verified in code, not inferred.
- **Viewer self-service exploration deserves to be a named capability.** Since unsaved changes are inherently session-local for a Viewer, ideas #2–#4 in particular put real toolbar-level data manipulation in front of every dashboard viewer, not just editors — for free. Worth a small "you're viewing local changes that won't be saved" affordance so a Viewer doesn't lose an afternoon of tweaking to an accidental refresh.
- **Explore already degrades gracefully — the gap is visibility, not plumbing.** `useAdHocTransformations` already falls back to component state outside a dashboard host (verified in the hook source). The remaining product work, if this is worth pursuing, is a lightweight "applied transformations" indicator in Explore rather than new plumbing.
- **Cross-panel reuse may already work.** The Dashboard datasource's `withTransforms` flag lets one panel query another's transformed output, and the base plan's own manual test script already exercises exactly this ("add a second panel with a `-- Dashboard --` query… confirm it sees the hidden column removed"). The community "reuse one panel's transform result in another panel" ask may be a documentation/discoverability gap more than an engineering one — worth confirming before scoping new work.

## Suggested next step

Given several of these are real product decisions (append-vs-replace semantics, whether a brush-select stacks or overwrites) rather than pure engineering, prototype before committing:

- **Cheapest, highest-visible-value pairing**: #3 + #4 together (one toolbar, two of the lowest-complexity transforms in the catalog, Viewer-usable immediately, no ambiguous product decisions to resolve first).
- **Best-evidenced single pairing**: #1 (Row-to-Tile), directly answers a docs-documented pairing plus a specific, still-open GitHub complaint.
- Either way, validate against the same manual recipe the base plan already defines (enable `panelAdHocTransformations`, confirm the transform appears correctly in the Transform tab with `origin: {source:'panel', pluginId}`, confirm it survives save/reload, confirm it round-trips through v1 and v2 dashboard schema) before investing in a second idea.

## Risks

| Risk                                                    | Notes                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Narrow-affordance coverage gap                          | Several sketches (calculateField's binary-only mode, spatial's single-mode) deliberately cover a slice of a Complex transform's full generality. Confirm that slice is actually the common case before shipping — a narrow control that doesn't cover typical usage will just disappoint next to the full editor. |
| Scope creep into panel-options/field-override territory | The Bad Fits section exists because several plausible-sounding ideas are better solved without this mechanism. Any new idea should pass the same test: does it reshape data, or just change display/layout?                                                                                                       |
| Hooks are `@alpha`/experimental                         | Confirmed directly in the source (`useAdHocTransformations.ts`, `useTransformedData.ts`, `PanelContext.ts` all marked `@alpha -- experimental`). Expect signatures to still move; none of this should be built against as a stable contract yet.                                                                  |
| Per-instance state scoping                              | Toolbar state for ideas #2–#4 (current sort, current exclusion range) must be scoped per panel instance on a dashboard with repeated panels of the same type — should fall out naturally since the hooks are per-component, but worth an explicit test case.                                                      |
