# Save Review: design overview

Code: this folder, `public/app/features/dashboard-scene/saving/review/`.

## What it does

When you save a dashboard, the save drawer has a **Review** tab. It turns the JSON diff between "what's saved" and "what you're about to send" into plain language, grouped by dashboard, section (row or tab) and panel:

```
Dashboard
  Properties   Title: "Old" → "New"
Row "API"  moved after Row "DB"
  Panel "Latency"  was updated (2 changes)
    Visualization   Visualization: Time series → Gauge
    Field config    Unit: set to "ms"
  + Added "Errors"      ← its + opens what it is set to
System defaults (3)   ← values Grafana filled in, not edits you made
Metadata (1)          ← e.g. folder
```

It's a pure, synchronous function from `ReviewInput` to `ReviewSummary`, with a thin React layer on top. It only works on v2 dashboard specs.

## Architecture

```
 SaveDashboardDrawer ──(Review tab open)──► LazyReviewPane ─► ReviewPane (in ReviewTab)
                                                                  │
                     ui/useReviewSummary  ◄───────────────────────┘
                     • builds ReviewInput from the drawer's change info (baseline, payload, mode)
                     • preloads panel plugins (≤1s, then gives up)
                     • recomputes when that change info changes (useDashboardSaveChanges)
                                  │ ReviewInput
                                  ▼
 ┌────────────── summarizeDashboardChanges (orchestrator) ──────────────┐
 │                                                                      │
 │  flatDiff(baseline, payload) ──► Diff[]                              │
 │        │                                                             │
 │        ├── layout/* + elements/<x> ─► structure/buildStructure       │
 │        │     layout     walk both layouts → sections, placements;    │
 │        │                rich names: Panel "CPU", parent paths        │
 │        │     matching   pair rows/tabs across sides; LCS: which      │
 │        │                panels moved vs kept their order             │
 │        │   ─► Structure { nodes, changes: RawChange[], panelNodeId } │
 │        │                                                             │
 │        └── everything else ─► describe/                              │
 │              fields          diff path → FieldTarget (owner,         │
 │                              category, label, how to word it),       │
 │                              then the field's ReviewChange           │
 │              lists           named lists (variables, queries…)       │
 │                              and show/hide rules                     │
 │              structureText   structure-change lines; status texts,   │
 │                              counts, overview line                   │
 │              wording         labels and value formatters             │
 │              systemDefaults  is this just a default filling in?      │
 │              paths           path helpers, flatDiff, empty baseline  │
 │                                                                      │
 │  buildTree: attach changes to nodes, prune unchanged ones, hide      │
 │  what's inside a removed section ─► ReviewSummary                    │
 └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
            ui/ReviewTab ─► ReviewNodeView (recursive) ─► ReviewChangeList
            ReviewPrimitives: disclosure, marks, property list, useReviewExpansion
```

## What each part is responsible for

| Component                      | Responsibility                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types.ts`                     | The contract. `ReviewInput`/`ReviewSummary` face the UI; `Structure`/`RawChange` are the internal contract between `structure/` and `describe/`. Read this first.                                            |
| `summarizeDashboardChanges.ts` | The orchestrator. It splits the diffs, sets aside bookkeeping (e.g. `revision`), sorts diffs into real changes and system defaults, and builds the tree.                                                     |
| `structure/`                   | Identity and layout. It works out which section or panel on one side is the same one on the other, what was added, removed or moved, and what to call each one. It knows nothing about wording beyond names. |
| `describe/`                    | Attribution and wording. The rules table in `fields.ts` maps a diff path to a field. The other files turn before/after values into translated sentences.                                                     |
| `ui/`                          | Layout only. Every string arrives already translated; the UI owns expand/collapse state and visuals.                                                                                                         |
| `__corpus__/`                  | Golden tests. Each case is an input plus its expected rendered text (`__corpus__/renderReviewText.ts`). [`__corpus__/WORDING.md`](__corpus__/WORDING.md) is the wording spec.                                |

## Subtleties and quirks

- **Claims are the core invariant.** Each `ReviewChange` and node carries `claims`, the diff paths it accounts for. `corpus.test.ts` checks that across the corpus, every diff path is claimed exactly once and no claim points at nothing. If you add a rule, the claims have to add up, or this test fails. Bookkeeping is claimed but never shown.
- **The baseline isn't always "what's saved".**
  - In `new` mode it's an empty spec (`emptyBaselineFor`), and everything is relabelled "added".
  - In `saveAsCopy` mode it's the source dashboard.
  - It can also be a _pending change_ (`baselineKind: 'pendingChanges'`).
- **System defaults.** Serializers and plugins fill in values the user never touched. `describe/systemDefaults.ts` spots them using schema defaults and the plugin's own defaults, so they go into their own section instead of cluttering the review. A visualization type change gets special treatment: the new plugin's defaults collapse to one line, "Plugin options: set to the Gauge defaults".
- **Index-shift noise.** Removing panel #2 from a grid makes `compare` report every later `items[i]` as changed. `buildStructure` records "array events" and assigns that noise to the nearest real event, so you see "1 removed" instead of 40 changes.
- **Moves.** A move is "outside the longest common subsequence of reading order". When there's a tie, the LCS keeps panels whose grid coordinates didn't change.
- **Names are rich text with icons.** Wherever a panel, row or tab is named (headers, move texts, "removed with it", System defaults owners), the text is `RichText`: strings plus named elements, built with `rich()` from [`richText.ts`](richText.ts) so each sentence stays one translatable `t()` call. The UI shows each element's kind as its outline icon, announced to screen readers as the word; the corpus renders it as the word (`Row "API"`). Change lines stay plain text.
- **Headers say what happened.** Added and removed nodes read `Added "New row" under ⧉"Tab 1"` and `Removed "Tab 2"`. "under <parent path>" appears only when the tree doesn't show the node's direct parent as its parent (path compression hid it); `buildTree` decides this, because only it knows which ancestors are shown.
- **Layout changes explain where panels went, and new sections list them.** Grouping a grid into rows doesn't mark each panel moved: the `Layout:` line accounts for it. So that the review still shows where they landed, `buildStructure` gives each added section `movedInContents`, the existing elements a restructure placed directly in it, and the header reads `Added "New row" (3 panels moved to it)`.
- **Progressive disclosure, everywhere.** One line per element says what happened; detail is one click deeper. An added or removed element carries `properties` (from [`describe/properties.ts`](describe/properties.ts)): what it is set to without defaults, literal values inline and objects behind Show, falling back to its defaults so nothing is unreviewable. Several field changes of one list item become one `ReviewChange` with nested `changes`. A rule set added or removed lists its settings as `properties`.
- **The overview line names top-level elements.** `topLevelCounts` rolls every node up to its top-level row, tab or panel, plus the section a panel moved out of, so a panel added in a tab reads "Changes to 1 tab".
- **Names are positional when ambiguous.** Two panels titled "CPU" become `Panel "CPU" at position 2` and so on, counted per container.
- **`flatDiff` (in `describe/paths.ts`) instead of `jsonDiff`.** It does the same diff without the line numbers, which are expensive. Path segments stay JSON-pointer-escaped, so use `unescapeSegment` and `valueAt`.
- **Plugins are optional and untrusted.** `getPlugin` may return nothing (the label falls back to a humanized key) or throw (wrapped in `safely()`).
- **The hook reuses the drawer's change tracking.** `useDashboardSaveChanges` returns the same change info until a persisted-state event (100ms debounce), the scene's meta or a save option changes, and the drawer memoizes the metadata, so `useReviewSummary` keys its effect on those inputs directly. Save As modes still call `getSaveAsModel`, because the save options' masking rewrites the change info's time settings and variable values in place.
- **Large reviews start collapsed.** With more than 10 changed panels, panels and "removed with it" lists start closed.

## Worth asking someone about

1. **[`describe/fields.ts`](describe/fields.ts)**: how the rules pattern table, `FieldTarget`, `order` and categories fit together. It's the densest file and the one you'll extend most.
2. **The claims model and the completeness check in `corpus.test.ts`**: what counts as one change, and why exactly-once matters.
3. **[`structure/buildStructure.ts`](structure/buildStructure.ts)** (~1100 lines): claim resolution (`resolve` → `resolveContainer` → `misaligned` / `nearestEvent` / `fallback`), and how restructures such as rows → tabs keep section identity.
4. **System-default heuristics**: when a filled-in value counts as a default rather than an edit, especially around visualization changes and colour modes.
5. **[`__corpus__/WORDING.md`](__corpus__/WORDING.md)**: the product decisions behind the wording, such as separate keys for lowercase vs sentence-start forms.
6. **The pipeline is synchronous and runs on every edit while Review is open.** It diffs once on top of the drawer's own `jsonDiff`; ask whether that matters on large dashboards.
