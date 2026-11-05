# Save Review: design overview

Companion to [PLAN-DIFFING.md](PLAN-DIFFING.md). Code: [`public/app/features/dashboard-scene/saving/review/`](public/app/features/dashboard-scene/saving/review/).

## What it does

When you save a dashboard, the save drawer has a **Review** tab. It turns the JSON diff between "what's saved" and "what you're about to send" into plain language, grouped by dashboard, section (row or tab) and panel:

```
Dashboard
  Properties   Title: "Old" → "New"
Row "API"  moved after Row "DB"
  Panel "Latency"  was updated (2 changes)
    Visualization   Visualization: Time series → Gauge
    Field config    Unit: set to "ms"
System defaults (3)   ← values Grafana filled in, not edits you made
Metadata (1)          ← e.g. folder
```

It's a pure, synchronous function from `ReviewInput` to `ReviewSummary`, with a thin React layer on top. It only works on v2 dashboard specs.

## Architecture

```
 SaveDashboardDrawer ──(Review tab open)──► LazyReviewPane ─► ReviewPane
                                                                  │
                     ui/useReviewSummary  ◄───────────────────────┘
                     • builds ReviewInput from the scene (baseline, payload, mode)
                     • preloads panel plugins (≤1s, then gives up)
                     • recomputes on persisted-state events (100ms debounce)
                                  │ ReviewInput
                                  ▼
 ┌────────────── summarizeDashboardChanges (orchestrator) ──────────────┐
 │                                                                      │
 │  flatDiff(baseline, payload) ──► Diff[]                              │
 │        │                                                             │
 │        ├── layout/* + elements/<x> ─► structure/buildStructure       │
 │        │     walkLayout    walk both layouts → sections, placements  │
 │        │     matchSections pair rows/tabs across sides               │
 │        │     naming        "Panel "CPU"", "Row "API" › Tab "Inner""  │
 │        │     lcs           which panels moved vs kept their order    │
 │        │   ─► Structure { nodes, changes: RawChange[], panelNodeId } │
 │        │                                                             │
 │        └── everything else ─► describe/                              │
 │              rules           diff path → FieldTarget (owner,         │
 │                              category, label, how to word it)        │
 │              systemDefaults  is this just a default filling in?      │
 │              describeFields  / structureChanges / namedLists /       │
 │              showHideRules / formatters → translated ReviewChange    │
 │              overview        status texts, counts, overview line     │
 │                                                                      │
 │  buildTree: attach changes to nodes, prune unchanged ones, hide      │
 │  what's inside a removed section ─► ReviewSummary                    │
 └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
            ui/ReviewTab ─► ReviewNodeView (recursive) ─► ReviewChangeList
            ReviewDisclosure, ReviewMarks, useReviewExpansion
```

## What each part is responsible for

| Component | Responsibility |
|---|---|
| `types.ts` | The contract. `ReviewInput`/`ReviewSummary` face the UI; `Structure`/`RawChange` are the internal contract between `structure/` and `describe/`. Read this first. |
| `summarizeDashboardChanges.ts` | The orchestrator. It splits the diffs, sets aside bookkeeping (e.g. `revision`), sorts diffs into real changes and system defaults, and builds the tree. |
| `structure/` | Identity and layout. It works out which section or panel on one side is the same one on the other, what was added, removed or moved, and what to call each one. It knows nothing about wording beyond names. |
| `describe/` | Attribution and wording. `rules.ts` is a pattern table that maps a diff path to a field. The other files turn before/after values into translated sentences. |
| `ui/` | Layout only. Every string arrives already translated; the UI owns expand/collapse state and visuals. |
| `__corpus__/` | Golden tests. Each case is an input plus its expected rendered text (`renderReviewText`). `WORDING.md` is the wording spec. |

## Subtleties and quirks

- **Claims are the core invariant.** Each `ReviewChange` and node carries `claims`, the diff paths it accounts for. `completeness.test.ts` checks that across the corpus, every diff path is claimed exactly once and no claim points at nothing. If you add a rule, the claims have to add up, or this test fails. Bookkeeping is claimed but never shown.
- **The baseline isn't always "what's saved".**
  - In `new` mode it's an empty spec (`emptyBaselineFor`), and everything is relabelled "added".
  - In `saveAsCopy` mode it's the source dashboard.
  - It can also be a *pending change* (`baselineKind: 'pendingChanges'`).
- **System defaults.** Serializers and plugins fill in values the user never touched. `systemDefaults.ts` spots them using schema defaults and the plugin's own defaults, so they go into their own section instead of cluttering the review. A visualization type change gets special treatment: the new plugin's defaults collapse to one line, "Plugin options: set to the Gauge defaults".
- **Index-shift noise.** Removing panel #2 from a grid makes `compare` report every later `items[i]` as changed. `buildStructure` records "array events" and assigns that noise to the nearest real event, so you see "1 removed" instead of 40 changes.
- **Moves.** A move is "outside the longest common subsequence of reading order". When there's a tie, the LCS keeps panels whose grid coordinates didn't change.
- **Names are positional when ambiguous.** Two panels titled "CPU" become `Panel "CPU" (2nd)` and so on, counted per container.
- **`flatDiff` instead of `jsonDiff`.** It does the same diff without the line numbers, which are expensive. Path segments stay JSON-pointer-escaped, so use `unescapeSegment` and `valueAt`.
- **Plugins are optional and untrusted.** `getPlugin` may return nothing (the label falls back to a humanized key) or throw (wrapped in `safely()`).
- **The hook reads options through a ref.** The drawer rebuilds its options on every render, so keying an effect on them would loop forever.
- **Large reviews start collapsed.** With more than 10 changed panels, panels and "removed with it" lists start closed.

## Worth asking someone about

1. **`describe/rules.ts`**: how the pattern table, `FieldTarget`, `order` and categories fit together. It's the densest file and the one you'll extend most.
2. **The claims model and the completeness test**: what counts as one change, and why exactly-once matters.
3. **`structure/buildStructure.ts`** (~1000 lines): claim resolution (`resolve` → `resolveContainer` → `misaligned` / `nearestEvent` / `fallback`), and how restructures such as rows → tabs keep section identity.
4. **System-default heuristics**: when a filled-in value counts as a default rather than an edit, especially around visualization changes and colour modes.
5. **`__corpus__/WORDING.md`**: the product decisions behind the wording, such as separate keys for lowercase vs sentence-start forms.
6. **The pipeline is synchronous and runs on every edit while Review is open.** On large dashboards it diffs twice; ask whether that matters in practice.
7. **[PLAN-DIFFING.md](PLAN-DIFFING.md)**: the original design doc, if you want the reasoning behind all this.
