# Why `useExtractFields` can't be deleted

Follow-up 1 of `panel-registered-transformations.plan.md` assumed logstable adoption would delete
`hooks/useExtractFields.ts`. It can't be, yet.

## The blocker

`explore/Logs/ExploreLogsTable.tsx:16` imports the `LogsTable` **React component** and renders it
with Explore's own `PanelData`. There is no `SceneQueryRunner` → `SceneDataTransformer` chain, so
`PanelPluginDataTransformer` never runs and `plugin.getDataTransformations()` is never called.
Deleting the hook drops every label column in Explore's logs table and its field selector.

Two second-order effects make it worse than "missing columns":

- The hook's `applyFieldOverrides` is Explore's **only** override pass — Explore applies overrides
  per container (`Logs/LogsTable.tsx:146`, `Table/TableContainer.tsx:144`), never before the panel.
  Without it, fields have no `display`, and `TableNG`'s `AutoCell.tsx:12` calls `field.display!(…)`
  unconditionally → the table throws rather than degrades.
- Extraction is **not idempotent**: `extractFields` routes new columns through `getUniqueFieldName`,
  so a second pass yields `service 1` / `level 1` rather than a no-op. Extraction must happen in
  exactly one place, not "wherever it might be missing".

## What this branch does instead

Keeps the hook, gated. `LogsTable` skips it only when it knows something upstream already ran it:
`extractFieldsInPanel || !panelPluginTransformations`. Explore sets `extractFieldsInPanel`; the
dashboard case is the default because scenes passes `PanelProps` and nothing more. The dashboard
path gains what the plan was after — derived fields participate in overrides, and
`fieldConfig.defaults.links` stop being duplicated by the second override pass
(`fieldOverrides.ts:423-425`).

## Options for actually removing it

1. **Move it into Explore** (smallest). `ExploreLogsTable` calls `extractLogsFieldsTransforms` +
   `transformDataFrame` + `applyFieldOverrides` itself. The logic moves one level up to the host
   that needs it rather than being deleted; the panel gets one code path.
2. **Teach `PanelRenderer` to run plugin transformations** (largest payoff).
   `panel/components/PanelRenderer.tsx:42` already runs `useFieldOverrides(plugin, …)` and so
   already holds the plugin — adding a transformation step there fixes every non-scenes host at
   once. Blocked on Explore rendering through `PanelRenderer`, which it avoids today because it
   passes non-`PanelProps` extras (`isLabelFilterActive`, `buildLinkToLogLine`) to `LogsTable`.
3. **Keep the gate.** Honest and cheap, but a third direct-render host silently loses columns.

## `useOrganizeFields` cannot move at all

Not just "not yet" — the API can't express it:

- It is driven by panel options (`options.displayedFields`), and
  `PanelDataTransformationsContext` carries only `series`.
- It must run **after** user transformations; registered transformations always run first.
- Most of it isn't a transformation — cell renderers, widths, level enhancements, `filterable` —
  it's field-config decoration that belongs in the panel regardless.
