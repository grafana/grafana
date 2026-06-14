# Visual dashboard diff when saving dashboard

## Problem

When a user saves a dashboard they want to review what changed in a way that is easy for a human to see — a rendered, side-by-side view of the actual panels/variables/config, not a JSON/text diff.

## Approach (high level)

The visual diff is rendered as **a full dashboard scene with a very specific layout**, so that changed panels render *for real* with live query data. Concretely:

- We build a dedicated `DashboardScene` whose layout is a two-column list of "change rows" (old on the left, new on the right).
- Panels in this scene are real `VizPanel`s with their own query runners, so they execute queries and render exactly as they would in a normal dashboard.
- Configuration that does **not** need a query runner (dashboard options, variable definitions) is rendered as plain visual components in the same page flow — it does not need to be part of the scene.

This splits the feature into two rendering paths:

1. **Panel diff** → real scene + real panels (needs runners, time range, variables).
2. **Config diff** → static visual rendering (no runner needed).

## UI placement

- Add a new tab **"Visual diff"** to the save dashboard drawer (`SaveDashboardDrawer.tsx`), alongside the existing "Details" and "Changes" tabs.
- Same visibility rules as the existing "Changes" tab (only when there are changes and the dashboard is not provisioned/managed).

## Layout

- A **linear list of change rows**. For now disregard the original dashboard layout/grid positions — changes are listed top to bottom.
- Each row has **two columns**: old version on the **left**, new version on the **right** (horizontal split).
- Only render entities that **differ** between old and new. Unchanged panels/variables/options are omitted.

## Panel diff (real data)

### Building the scenes

- **New / current version**: comes from the live dashboard scene that is already loaded and running. Reuse the already-running `VizPanel`s where possible.
- **Old version**: deserialize the previous dashboard JSON into a full scene via `transformSaveModelToScene(oldJSON)` (`serialization/transformSaveModelToScene.ts`). This gives a complete `DashboardScene` with `$timeRange` and `$variables` wired up.
- We do **not** render the old scene's normal layout. Instead we pull the changed `VizPanel`s out and place them into the diff scene's two-column layout. Panels must retain a scene ancestor that provides `$timeRange` and `$variables` so their queries run.

### Time range and variables (important)

- **Both columns must use the current dashboard's time range and current variable values.** Override the old scene's `$timeRange` and variable values to match the live dashboard, so that differences reflect *configuration* changes, not a different time window or different variable selections.

### Which panels to render

- Match panels by panel **id**.
  - Present in both, but different → render old on the left, new on the right.
  - Present only in old → render on the left, leave empty space on the right (deleted).
  - Present only in new → render on the right, leave empty space on the left (added).
- "Different" is determined by comparing the panels' JSON models. Reuse the existing structured diff (`getDashboardChanges` / `jsonDiff`) to decide which panel ids changed rather than re-implementing comparison.
- Best-effort matching is **just by id** for now. Drop fuzzy matching — if an id exists on only one side, treat it as add/delete.
- Empty-space placeholders should match the height of the rendered panel on the other side.

### Rendering details

- Both old and new versions of changed panels must actually render with data (run their queries). This is the core of the feature.
- If an old panel references a datasource that no longer exists / was renamed, the panel renders its normal error state (handled by `DashboardDatasourceBehaviour`, does not crash). That is acceptable and even informative.
- The tab is **not instant** — it waits on query execution. Show per-panel loading and error states.

## Config diff (no runner)

Rendered as static visual components in the same page flow, **not** part of the scene:

- **Variables**: for each variable that changed, render its definition (name, type, query/options, current value) old vs new. Render to visually resemble how variables appear, but this is a static representation — it does not need a live interactive variable control or a runner.
- **Dashboard config options**: for the dashboard-level options that changed (e.g. title, tags, refresh, time settings, annotations, links), render old vs new. Keep it to a clear labeled before/after of the changed options; do not attempt to reuse the full interactive config-page forms.

## Schema support (v1 and v2)

Both the legacy v1 `Dashboard` schema and the v2 `DashboardV2Spec` are supported. The scene-rendering
core (build two scenes, force the same time range, render only the changed panels) is schema
agnostic; only the change-enumeration adapters differ:

- **Scene building**: v1 uses `transformSaveModelToScene`; v2 uses `transformSaveModelSchemaV2ToScene`
  (wrapped in a minimal `DashboardWithAccessInfo` DTO). Both yield panels keyed `panel-<id>`, so the
  scene → panel-by-id map is shared.
- **Panel enumeration**: v1 reads the flat `panels[]` (matched by numeric `id`); v2 reads the
  `elements` record (matched by `element.spec.id`). v2 panel heights use a default since layout is
  ignored.
- **Config diff**: v1 reads `templating.list` + top-level option keys; v2 reads `variables[]` (by
  `spec.name`) + `timeSettings`/top-level keys.

## Out of scope (for now)

- Layout / grid-position changes (panels are listed linearly, positions ignored).
- Fuzzy panel matching beyond id.
- Interactive editing within the diff view (read-only).
