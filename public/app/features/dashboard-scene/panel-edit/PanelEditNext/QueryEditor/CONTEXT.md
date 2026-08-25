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

The datasource query editor registers a row-scoped `QueryEditorCoauthoringAdapterV1`. The adapter reports editor facts and constructs datasource-specific context and typed proposals. It does not render Core UI or stage an editor-specific preview.

## Preview invariant

Proposals must not enter the canonical `SceneQueryRunner.state.queries` until Accept. `startQueryPreview` clones the canonical runner, replaces only the selected query in the clone, and projects the clone's `PanelData` back into the canonical runner. Saving, sharing, query-library actions, and other query serializers continue to see the baseline query during preview.

## Lifecycle

1. The datasource publishes a selection or shortcut invocation.
2. Core reads the atomic typed baseline and synchronizes any unblurred editor contents.
3. Core asks the datasource to validate and construct a typed proposal.
4. Core passes the proposal through normal query-editor props and starts the isolated panel preview.
5. Accept commits the proposal. Discard disposes the preview and reruns the baseline.
6. A genuine editor change during a proposal cancels coauthoring and becomes normal query state.

Only one transaction is owned by a given query row. Cross-row session coordination is intentionally outside this experiment.
