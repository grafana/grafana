# Notebooks (POC)

Living documents for investigations: narrative text, code snippets and **live panels**
captured from dashboards or Explore, with real-time collaboration. Behind the
`dashboard.notebooks` feature toggle.

Notebooks are stored as a `Notebook` resource in the `dashboard.grafana.app/v2beta1`
API group (spec defined in `apps/dashboard/kinds/v2beta1/notebook_spec.cue`). A
notebook is a flat list of layout cells referencing elements: markdown/code cells and
panels that reuse the dashboard v2 `PanelKind` shape, so panels round-trip cleanly
between dashboards, Explore and notebooks.

## Directory map

| Path             | What lives there                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model/`         | Pure functions over the `NotebookSpec` (insert/move/duplicate/update blocks, time locks, normalization) — everything here is unit-tested and side-effect free                                    |
| `api/`           | Imperative CRUD over the generated RTK client, plus URL helpers and the last-used-notebook store                                                                                                 |
| `editor/`        | The block editor: dnd reordering, markdown/code editing, inline datasource query editing (`cells/PanelQueryEditor`), viz suggestions, per-panel time locks, undo/redo (`useNotebookEditorState`) |
| `collab/`        | Real-time layer over Grafana Live: presence, live cursors, follow mode, activity feed, last-write-wins doc sync (`useNotebookCollab`, `mergeRemoteSpec`)                                         |
| `addToNotebook/` | Capture entry points: dashboard panel menu, Explore toolbar, quick-add-to-last-notebook                                                                                                          |
| `sidebar/`       | Compact companion editor docked in the extension sidebar                                                                                                                                         |
| `pages/`         | List page, editor page, read-only view page (renders through the dashboard scene pipeline)                                                                                                       |
| `extensions/`    | Core extension-point registrations (Explore, sidebar, IRM landing card, command palette) and the declare-incident button                                                                         |

Related code outside this folder:

- `public/app/features/dashboard-scene/scene/layout-notebook/` — the read-only view renderer (pre-existed this POC; the editor reuses its markdown cell and panel-building utils).
- `pkg/services/live/features/notebook.go` — the Live channel relay for collaboration.
- `pkg/services/navtree` — the nav entry.

## Architecture notes

- **Rendering**: every panel block is a self-contained `EmbeddedScene` + `VizPanel`
  (`editor/cells/PanelCellView`), rebuilt when its spec changes — so committing a
  query/viz edit re-runs it automatically. The read-only page renders the whole
  notebook through the v2 dashboard scene pipeline instead.
- **Editing model**: all mutations are immutable spec transforms in `model/notebookSpec.ts`,
  applied through `useNotebookEditorState` (debounced autosave with optimistic-concurrency
  retry, snapshot-based undo/redo with typing coalescing).
- **Collaboration**: ephemeral messages relayed verbatim over `grafana/notebook/uid/<uid>`.
  Presence/cursors/follow/activity are production-shaped; **document sync is deliberately
  POC-grade** (full-doc broadcast, wall-clock last-write-wins, per-block merge protection
  only for the actively edited block). The block-structured spec was chosen so the real
  implementation can be per-block revisions / ops rather than general collaborative text.
- **Query editing**: embeds each datasource's own `QueryEditor` with `CoreApp.Correlations`
  (the established value for standalone embeds), local draft state, explicit commit on run —
  same pattern as the saved-queries inline editor.

## Known limitations / next steps

- Doc sync loses concurrent structural edits beyond ~5 active editors (see above) —
  needs per-block versioning, a single-writer save election, and server-side identity
  stamping in the Live handler before real multiplayer use.
- Assistant integration (context handoff + write-back functions) was built and then
  deliberately removed to keep the core lean; it lives in git history.
- No template gallery, slash-menu insertion, or export beyond copy-as-Markdown — parked
  pending user feedback.
- Notebooks are not in the search index: no "recent notebooks" or search results in the
  command palette (dashboards get this via unified search). Indexing the notebook
  resource is the natural GA path; the list page's content search is client-side.
- Known bug: canvas panels render in the editor but can hang on "Loading plugin
  panel..." on the read-only view page — needs investigation in the scene view
  pipeline.

## Running it

`make run` + `yarn start`, with `dashboard.notebooks = true` under `[feature_toggles]`.
Open `/notebooks`. For the collaboration demo, open the same notebook in two windows.
