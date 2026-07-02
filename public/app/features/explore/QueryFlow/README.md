# QueryFlow

QueryFlow visualizes a PromQL or LogQL query in Explore as a left-to-right flow graph: the query
result on the left, its data sources expanding to the right. It's gated behind the
`exploreQueryFlow` feature toggle and is opened per query row via a row action
(`registerQueryFlowRowAction.tsx`).

This document is an internal map of the code for contributors extending or debugging the feature.
It does not cover the query-editing experience, which is a separate, later effort.

## Layers

```mermaid
flowchart LR
  expr["Query text (Redux)"] --> mapper["model/ mapper<br/>(promql.ts / logql.ts)"]
  mapper --> graph["QueryFlowGraph"]
  graph --> layout["layout.ts"]
  graph --> diagnostics["diagnostics/<br/>analyzeGraph"]
  layout --> canvas["QueryFlowCanvas<br/>+ components/"]
  diagnostics --> canvas
  enrichment["enrichment/<br/>lazy, on hover"] --> canvas
  canvas --> panel["QueryFlowPanel"]
  panel --> explore["ExploreQueryFlow"]
```

- **`model/`** — parses query text into a language-agnostic graph (`QueryFlowGraph`). See
  [Adding a language](#adding-a-language) and [Node-kind taxonomy](#node-kind-taxonomy).
- **`layout.ts`** — lays the graph out left-to-right with `d3-hierarchy`, producing absolute pixel
  positions for nodes and edges. See [Layout/CSS height contract](#layoutcss-height-contract).
- **`diagnostics/`** — pure, synchronous lint rules (`promRules.ts`/`logqlRules.ts`) and
  educational tips (`suggestions.ts`) run over the graph on every rebuild. Never throws; a
  misbehaving rule is caught per-rule in `analyze.ts`.
- **`enrichment/`** — lazy, per-node datasource queries (metric metadata, cardinality, Loki stats,
  detected fields) fetched only on hover/focus via `useQueryFlowEnrichment`. Kept separate from
  `model/` because it's async, network-backed, and best-effort (never blocks rendering).
- **`components/` + `QueryFlowCanvas.tsx`** — presentation: node cards, SVG edges, floating
  diagnostic callouts, pan/zoom/keyboard interaction.
- **`QueryFlowPanel.tsx` / `ExploreQueryFlow.tsx`** — wire the hooks together and render the chrome
  (header, status badge, issue counts) around the canvas.
- **`hooks/`** — one hook per concern: reading the active query (`useActiveQueryFlowQuery`),
  building the graph live as the user types (`useQueryFlowGraph`), lazy enrichment
  (`useQueryFlowEnrichment`), and Monaco editor highlighting (`useEditorHighlight`).

## Adding a language

To support a third language (mapper registered by datasource `type`):

1. Add a new file under `model/languages/<name>.ts` exporting a `QueryFlowMapper` (see
   `mapper.ts`'s `QueryFlowMapper` interface): a `language` id and a `buildGraph(expr)` function.
2. Inside `buildGraph`, run `replaceVariables` on the input, parse with the language's Lezer parser,
   walk the tree building `QueryFlowNode`s via a `GraphContext` (`ctx.addNode`, `ctx.origSpan`,
   `ctx.makeId`), and finish with `assembleGraph(ctx, rootId)`. Wrap the walk in `try/catch` and
   push to `ctx.errors` on failure — `buildGraph` must never throw.
3. Reuse `handleBinaryExpr` and `emitUnknown` from `mapper.ts` for binary operators and
   graceful fallback nodes instead of reimplementing them per language.
4. Register the mapper in `model/registry.ts` (keyed by datasource `type`).
5. Optionally add a diagnostics rule module under `diagnostics/` and register it in
   `diagnostics/registry.ts`, and an enricher under `enrichment/` registered in
   `enrichment/registry.ts`.
6. Add docs links for the new language's node kinds in `docs/docsLinks.ts`.

## Node-kind taxonomy

`QueryFlowNodeKind` (`model/types.ts`) is a small, coarse, language-agnostic set — the renderer
only switches styling on `kind`; all language-specific detail lives in `label`/`sublabel`/`params`.
When adding a language, prefer mapping its constructs onto an existing kind (e.g. an
extraction/parsing step → `Parser`, a value modifier → `Modifier`) rather than adding a new kind.
Only add a new kind when nothing existing fits — see `model/nodeColors.ts` for the icon/color
`KIND_META` table every kind must have an entry in (the `Record<QueryFlowNodeKind, ...>` type makes
this compiler-enforced).

## Span invariants

Every `QueryFlowNode.span` is a half-open `[from, to)` range into the **original** query text
(before variable replacement) — this is what a future editing feature will splice against, and
what `useEditorHighlight` uses to decorate the Monaco editor. Rules to preserve:

- Never index into the variable-*replaced* string outside `GraphContext` — always go through
  `ctx.origSpan(node)` / `ctx.text(node)`, which map back via `mapSpanToOriginal`
  (`model/variables.ts`).
- A node's span should cover its whole subexpression, including any trailing modifier text
  (e.g. `handleRange`/`handleModifier` in `promql.ts` compute the range/modifier's own text as
  "everything after the inner expression's span").
- Set `synthetic: true` (see `QueryFlowNode.synthetic`) when a node has no corresponding source
  text — e.g. a grammar-recovered placeholder for a missing-but-required construct (LogQL's range
  in `handleLogRange`). Diagnostics that care whether something was actually written should check
  this flag rather than re-deriving it from source text (text scanning can't distinguish a
  placeholder from a construct that just looks absent — see the regression this fixed in
  `diagnostics/logqlRules.ts`).

## Layout/CSS height contract

`layout.ts`'s `nodeHeight()` computes each card's reserved vertical space from constants
(`NODE_VERTICAL_PADDING`, `NODE_HEADER_HEIGHT`, `NODE_SUBLABEL_HEIGHT`, `NODE_DIVIDER_HEIGHT`,
`NODE_PARAM_ROW_HEIGHT`) that must stay in sync with the actual CSS in
`components/QueryFlowNode.tsx` (`.card`, `.sublabel`, `.params`, `.param`). If you change that CSS
(padding, margins, border widths, row heights), update the matching constant in `layout.ts` in the
same change, and check `layout.test.ts`'s `nodeHeight` describe block — it locks in the formula and
includes a sibling bounding-box overlap test that catches drift between the two.

## Testing notes

- Model/mapper/diagnostics tests build real graphs via `promqlMapper`/`logqlMapper` rather than
  hand-constructing `QueryFlowGraph` objects, so they exercise the real parser+walker together.
- jsdom doesn't implement `PointerEvent`, so tests exercising drag/pan (`QueryFlowCanvas.test.tsx`)
  build events manually (see the `pointerEvent()` helper there) instead of using RTL's
  `fireEvent.pointerDown` etc., which silently drop pointer-specific fields in this environment.
- `mapper.ts`'s dev-only integrity warnings (`console.warn` on id collisions / unreachable nodes /
  missing child references) run whenever `NODE_ENV !== 'production'`, which includes tests — this
  repo's Jest setup fails a test if it logs an unexpected `console.warn`, so tests that
  intentionally trigger these warnings mock `console.warn` first (see `model/mapper.test.ts`).
