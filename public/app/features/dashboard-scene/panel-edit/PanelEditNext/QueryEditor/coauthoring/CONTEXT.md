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

The Prometheus query editor registers a row-scoped `QueryEditorCoauthoringAdapterV1`. The adapter reports editor facts and constructs PromQL-specific context and typed proposals. It does not render Core UI or stage an editor-specific preview.

## Private seam

For this PanelEditNext experiment, Core passes the optional `unstable_queryEditorCoauthoringV1` prop only to the `prometheus` plugin type. Amazon Managed Service for Prometheus remains outside this experiment even though it reuses Prometheus editor modules. The interface is private to this paired Core and Prometheus implementation: each repository keeps a structurally identical copy rather than publishing an experimental contract from `@grafana/data`. An older Core omits the prop, and an older Prometheus plugin ignores it, so mixed versions degrade to the ordinary query editor.

Before a second datasource adapter is added, promote a reviewed, generalized interface into `@grafana/data`; do not copy this private prop or either repository's local contract. The same promotion review is required before query coauthoring graduates from this experiment to a supported plugin extension point.

## Internal modules

`QueryCoauthoring` remains the transaction owner and render shell. Its internal implementation is split by responsibility:

- `useQueryCoauthoringInvocation` owns atomic invocation loading, baseline synchronization, semantic identification, and cancellation.
- `createQueryCoauthoringRequest` owns Assistant tools and converts completion callbacks into typed clarification, fallback, proposal, ignored, or error outcomes.
- `useQueryCoauthoringViewport` owns portal measurement and viewport/scroll observation.
- `QueryCoauthoringViews` owns the presentational states.

These are private implementation modules, not datasource extension seams. The datasource-facing interface remains `QueryEditorCoauthoringAdapterV1`.

## Preview invariant

Proposals must not enter the canonical `SceneQueryRunner.state.queries` until Accept. `startQueryPreview` clones the canonical runner, replaces only the selected query in the clone, and projects the clone's `PanelData` back into the canonical runner. Preview status comes directly from the clone because projected scene updates may batch away an intermediate loading state. Saving, sharing, query-library actions, and other query serializers continue to see the baseline query during preview.

## Lifecycle

1. The datasource publishes a selection or shortcut invocation.
2. Core reads the atomic typed baseline and synchronizes any unblurred editor contents.
3. Core asks the datasource to validate and construct a typed proposal.
4. Core passes the proposal through normal query-editor props and starts the isolated panel preview.
5. Accept commits the proposal. Discard disposes the preview and reruns the baseline.
6. A genuine editor change or explicit query run during a proposal cancels coauthoring; an editor change then becomes normal query state.

Only one transaction is owned by a given query row. Cross-row session coordination is intentionally outside this experiment.
