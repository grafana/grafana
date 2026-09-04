# PanelEditNext query coauthoring

## Scope

Query coauthoring is currently a `PanelEditNext` feature. The supported entry points are a toolbar shown for an editor selection and the editor's `Cmd/Ctrl + .` shortcut. A shortcut invocation without a selection focuses the whole query.

## Ownership

The query row owns the coauthoring transaction:

- the typed baseline query
- the proposed typed query
- the Core-owned toolbar and popover
- the temporary panel-data preview
- accept, discard, and manual-edit cancellation

The datasource query editor registers a row-scoped `QueryEditorCoauthoringAdapterV1`. The adapter publishes invocation snapshots, exposes an atomic typed baseline and language-specific context, and prepares and validates typed proposals. It does not render Core UI or stage an editor-specific preview.

Core binds each registration to the current datasource instance and query row. The transaction and surface consume an adapter only while that identity still matches; switching rows or datasources invalidates the registration before the previous editor's cleanup runs.

## Private seam

The Core-owned transaction and UI are datasource-neutral. Prometheus is the first datasource implementation for this proof of concept, so Core currently supplies the optional `unstable_queryEditorCoauthoringV1` registrar only to the `prometheus` plugin type. This remains a private, paired integration seam; each side keeps a structurally identical local contract rather than publishing an experimental contract from `@grafana/data`. If either side does not provide the seam, the ordinary query editor continues unchanged.

Before the seam is reused by another datasource, promote a reviewed, generalized interface into `@grafana/data`; do not copy this private prop or either local contract. The same promotion review is required before query coauthoring graduates to a supported plugin extension point.

## Internal modules

The row-level transaction is split by responsibility:

- `QueryEditorPanel` provides the identity-scoped registrar, stores the adapter registered by the datasource, and connects only the matching adapter to `useQueryProposalTransaction` and the Core surface.
- `QueryCoauthoringSurface` subscribes to adapter snapshots, renders the selection toolbar or inline surface, and recovers from render failures by reverting the transaction and dismissing the adapter.
- `useQueryProposalTransaction` owns the row's baseline, proposed editor props, preview lifecycle, accept/revert, and cancellation when canonical query state changes.
- `QueryCoauthoring` is the inline render shell, while `useQueryCoauthoringSession` owns its Assistant session, feedback state, and handoff/dismissal behavior.
- `useQueryCoauthoringInvocation` loads and validates an atomic invocation, synchronizes its baseline, generates the semantic selection explanation, and rejects stale asynchronous work.
- `createQueryCoauthoringRequest` owns Assistant tools and converts completion callbacks into typed clarification, fallback, proposal, ignored, or error outcomes.
- `queryPreview` owns the isolated runner clone; `useQueryCoauthoringViewport` owns portal measurement and viewport/scroll observation; `QueryCoauthoringViews` owns the presentational states.

These are private implementation modules, not datasource extension seams. The datasource-facing interface remains `QueryEditorCoauthoringAdapterV1`.

## Preview invariant

Proposals must not enter the canonical `SceneQueryRunner.state.queries` until Accept. `startQueryPreview` finds the canonical runner through `getQueryRunnerFor`, clones it, replaces only the selected query in the clone, and projects the clone's `PanelData` back into the canonical runner. Preview status comes directly from the clone because projected scene updates may batch away an intermediate loading state. Saving, sharing, query-library actions, and other query serializers continue to see the baseline query during preview.

The clone is disposed and the canonical data restored when the proposal is reverted or replaced. A change to the canonical query list also disposes the clone, so a stale preview cannot overwrite newer query state.

## Lifecycle

1. The adapter publishes a selection or shortcut invocation.
2. Core reads the atomic typed baseline and context, verifies the invocation revision, and synchronizes the baseline only while its `refId` matches the current query row.
3. The inline session requests a typed proposal. It can instead show a clarification, an error, or a bounded handoff to Assistant; stale completions are ignored.
4. Core validates the proposal through the adapter, passes it through normal query-editor props, and starts the isolated panel preview.
5. Accept clears the preview, commits the proposal through the ordinary query update path, and runs the query. Close, Escape, and Assistant handoff clear the inline session and revert an active preview; Stop cancels ongoing generation and reverts any preview while retaining the session context.
6. Switching query rows or datasources invalidates the registered adapter before the next surface render and clears the transaction. The datasource cleanup still disposes its editor resources.
7. A genuine editor change, an explicit query run, or a canonical-query change clears the transaction and prevents stale proposal or preview data from overwriting newer query state.

Only one transaction is owned by a given query row. Cross-row session coordination is intentionally outside this experiment.
