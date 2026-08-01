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

- **Durable model**: the `Notebook` resource + shared dashboard `PanelKind` leaf types.
  Scenes/`VizPanel` are how we render live panels (same stack as dashboards/Explore),
  not the source of truth. Capture and round-trip stay cheap because of that reuse.
- **Edit and view are separate surfaces (intentional)**:
  - **Edit**: Notion-style block editor — dnd, inline query/markdown editing, autosave,
    collab overlays. Each panel is a small `EmbeddedScene` + `VizPanel`
    (`editor/cells/PanelCellView` / `buildNotebookVizPanel`). Notebooks aren’t dashboards,
    so this doesn’t go through DashboardScene edit chrome.
  - **View**: read-only document page via the `layout-notebook` dashboard-scene pipeline
    (`NotebookScenePageStateManager` + `buildNotebookEnvelope`) for URL sync, time
    controls, and panel chrome.
  - Both read the same `NotebookSpec` and build the same kind of `VizPanel`. Keep panel /
    narrative construction shared so the two surfaces don’t drift; don’t force edit into
    a dashboard scene just to have “one path.”
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
- View-mode time controls are hidden when a notebook has no visualization panels
  (nothing for the shared range to drive); they stay editable when panels are present.
- Notebook `description` exists on the spec (list search / declare-incident can use it)
  but is **not editable in the POC UI** — fast follow. Declare-incident title order:
  named title → first markdown line → description → `Investigation: Untitled notebook`.
  New notebooks are titled `Investigation — {today}` (not Untitled) so capture targets are easier to find.

## Review notes (private preview readiness)

- **Permissions**: editing is gated on the dashboards `create`/`write` actions as a
  POC shortcut. A real rollout wants notebook-scoped actions (or at least a
  deliberate decision to inherit dashboard permissions) plus folder placement.
- **Generated files**: the schema change (`height`, `timeFrom`, `timeTo` on
  `NotebookLayoutItemSpec`) lives in `apps/dashboard/kinds/v2beta1/notebook_spec.cue`;
  the Go/OpenAPI/TS outputs were generated and committed together — CI's codegen
  verification should pass as-is.
- **Security posture**: markdown renders through the standard text-panel sanitizer
  (js-xss whitelist; `data:image/` is allowed for img src by its defaults, which the
  image paste feature relies on — pasted images are downscaled and capped at ~500KB).
  The Live channel is org-isolated upstream; the relay handler does **not** stamp
  sender identity server-side yet, so collab messages trust the client-supplied user
  (fine for preview, must fix before GA — the handler receives the authenticated
  requester and can stamp it).
- **Shipping split**: per repo convention the backend (CUE schema, Live handler,
  navtree) and frontend should land as separate PRs; the backend diff is ~130 lines
  and has no frontend dependency.
- **Test coverage**: model/spec transforms, editor state (undo/autosave), collab
  merge, capture orchestration, markdown export, view-page loading are covered.
  Not covered: the Live hook itself (`useNotebookCollab` — needs a Live mock
  harness) and the editor component tree (exercised manually).

## Running it

`make run` + `yarn start`, with `dashboard.notebooks = true` under `[feature_toggles]`.
Open `/notebooks`. For the collaboration demo, open the same notebook in two windows.
