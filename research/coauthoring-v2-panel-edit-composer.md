# What panel edit needs to host a Composer session (DPRO-505)

Research notes, facts only. Source: `grafana/grafana` at `49324840f0e`. All paths are relative to
`public/app/features/dashboard-scene/` unless they start with `public/` or `packages/`. Line numbers refer
to that commit.

Design decisions are out of scope here. The decision points and constraints are listed at the end.

## 0. Why panel edit is refused today

- `canEnterComposer` returns `unsupported` when any of these is set: `planning`, `editPanel`, `editview`,
  `viewPanel`, or Composer mode itself. Its comment says "v1 covers saved dashboards in the plain dashboard
  view only" (`composer/composerAccess.ts:12-34`).
- `ComposerSession.enter` uses the same check and throws when it fails (`composer/ComposerSession.ts:114-120`).
  The restricted `composer.canEnter`/`enter` APIs both go through it
  (`public/app/features/plugins/components/restrictedGrafanaApis/composer/composerApi.ts:45-62`).
- The mode picker turns that refusal into a disabled "Composer is not available for this dashboard right
  now." option (`scene/DashboardModePicker.tsx:169-199`). The picker is rendered from `DashboardControls`
  (`scene/DashboardControls.tsx:378`), and `DashboardControls` also renders `PanelEditControls` while
  `editPanel` is set (`scene/DashboardControls.tsx:240,252`).

## 1. How responsibilities are divided

### `ComposerAPI` (restricted API `composer`), `composer/types.ts`

- `ComposerAPI` has `version: 1`, `canEnter(target?)`, `enter(target?, options?)` and
  `onEnterRequested(listener, options?)` (`composer/types.ts:50-78`). Only the outer shape is mirrored in
  `@grafana/data` (`packages/grafana-data/src/context/plugins/RestrictedGrafanaApis.tsx:24-77`). The plugin
  declares the other types itself and checks the handle at runtime (`composer/types.ts:1-6`).
- `ComposerTarget` is `{ resource: 'dashboard' | 'notebook'; uid }` (`composer/types.ts:21-27`). The target
  says which document to use, but nothing smaller than a document. There is no panel or sub-document target.
- `enter` options: `presentation: 'floating' | 'none'`, with `'floating'` as the default
  (`composer/types.ts:37-46`). The host handles the sidebar, not the session: with `'floating'`, closing the
  extension sidebar exits the session, and the session's abort signal clears the floating override
  (`composerApi.ts:67-88`).
- `onEnterRequested` delivers each request from Grafana's own UI to one listener. Listeners say which
  `resources` they support, and core never enters Composer by itself
  (`composer/types.ts:63-77`, `composer/composerEntryRequests.ts`, `composer/useAssistantComposerEntry.ts:16-43`).
- The API exists only while the `GrafanaDashboardComposer` flag is on
  (`public/app/features/plugins/components/restrictedGrafanaApis/restrictedGrafanaApis.ts:16-35`).
  `dashboardComposerEnabled()` also needs dashboard modes, which means new layouts plus `GrafanaDashboardPreviewMode`
  (`scene/dashboardModes.ts:14-23`).
- Finding a target: `resolveTarget` refuses `notebook` with `unsupported`. Otherwise it takes the top
  `DashboardMutationClient` from the mounted-document stack (`composerApi.ts:31-40`;
  `.../dashboardMutation/dashboardMutationApi.ts:32-70`). The stack holds one client per mounted document
  (dashboard or notebook) and has no entry for a panel editor.

### `ComposerSessionAPI` (what the plugin gets), `composer/types.ts:198-293`

The plugin gets: picks (`pickElement`, `pickRegion`), `captureRegion`, `listElements` (returns `[]` in M1),
`highlight`, `setPaused`, annotations (`setAnnotations`, `onAnnotationClick`, `onAnnotationHover`,
`getAnnotationAnchor`, `revealAnnotation`), `readSpec`/`applySpec`, `canWrite`/`onCanWriteChange`,
`exit`/`closed`, and an optional `retrySave`. The `Spec` type parameter defaults to the dashboard v2 spec.

### Picks: `ElementRef` and `ElementPick`

- `ElementRef` is a closed union: `panel{panelId}`, `row|tab{name}`, `region{regionId}`, `variable{name}`,
  `annotation{name, layerKind}`, `cell{name}` (notebook) (`composer/types.ts:84-96`). It has no query,
  expression or transformation kind, and no kind nested inside a panel.
- `ElementPick` holds `ref` (any kind except region), `label`, `tabPath`, a normalised `point`, and
  `additive` (⌘/Ctrl) (`composer/types.ts:104-119`). `RegionPick` adds `rect`, `intersects` (at most 20) and
  `timeRange` (`composer/types.ts:140-154`).

### `ComposerSession`: shared, works for any document (`composer/ComposerSession.ts`)

The class comment says "Everything the documents share (picks, regions, pins, anchors, capture) lives here"
(`ComposerSession.ts:87-92`). In detail:

- Pending pick state. Only one pick is pending at a time, and it is cancelled on pause or end
  (`ComposerSession.ts:180-202, 464-474`).
- Region storage. Regions are stored relative to a scroll container. That container is found with a
  dashboard-specific selector, `DashboardSidebarSplitter.bodyContainer`, and otherwise falls back to the
  overlay's own scroller (`ComposerSession.ts:37-57, 476-518, 698-715`). A region is pruned once no
  annotation references it (`ComposerSession.ts:300-310`).
- Region capture. One capture runs at a time, with a timeout and an abort-on-scroll. The image is rendered
  from `document.findCaptureRoot`. Capture excludes `[data-composer-capture-exclude]` and
  `[data-extension-sidebar]`, and refuses to start over `[data-dashboard-actions]`
  (`ComposerSession.ts:31-35, 204-259`).
- Highlight, pause, the annotation list, anchors (zero-size portal containers), and reveal/scroll
  (`ComposerSession.ts:265-391`).
- `readSpec` and `applySpec` pass through to the document, with `isOpen` set to `!this.ended`. `canWrite`
  is `!ended && document.canWrite?.() ?? true` (`ComposerSession.ts:393-419`).
- `exit()` calls `document.detach()` and then `close()`. `close()` aborts the signal, runs cleanups, clears
  anchors and regions, and resolves `closed` with `document.finish()` (`ComposerSession.ts:421-448`).
- It ends itself when `document.isEnabled()` turns false after a flag change (`ComposerSession.ts:162-178`).
- There are two factories. `enter(scene)` is dashboard-only and runs `canEnterComposer`. `open(document)`
  works for any document whose checks already passed, and throws `unsupported` when `attach` returns false
  (`ComposerSession.ts:113-130`).

### `ComposerDocument<Spec, Session>`: the per-resource strategy (`composer/ComposerDocument.ts:13-74`)

Its comment says "how one kind of document is found in the DOM, read, written, and entered and left". The
members are:

- DOM hit-testing: `elementSelector`, `elementKeyAttribute`, `elementHint()`, `resolveElementPick(key, point)`,
  the optional `resolveVariablePick` and `resolveAnnotationPick`, `findElementRoot(ref, container)`, and
  `isHidden(ref)`.
- Regions: `regionContext()` (tab keys, tab path, time range), `isRegionShown(tabKeys)`,
  `findIntersectingElements`, `findCaptureRoot`.
- Lifecycle: `attach(session)` (puts the scene into its Composer state, returns false if refused),
  `start(events)` (subscribe and report `layoutChanged`), `isEnabled()`, `detach()`, `finish()`, and the
  optional `retrySave`.
- Writes: `readSpec()` returns `{spec, revision}`. `applySpec(spec, opts, isOpen)` returns `ApplyOutcome`.
  `canWrite`/`onCanWriteChange` are optional. `reportsSave` controls whether `exit` resolves with a save
  outcome.

### `DashboardComposerDocument`: dashboard-specific (`composer/DashboardComposerDocument.ts`)

- Hit-testing uses `[data-viz-panel-key]`/`data-viz-panel-key` (`:59-60`), variable and data-layer control
  selectors (`composer/composerGeometry.ts:14-22`), and scene lookups such as `sceneGraph.findObject`,
  `getPanelIdForVizPanel` and `TabsLayoutManager` (`:218-396`). A repeat clone resolves to its source panel
  (`:295-300, 391-395`).
- `attach` calls `scene.enterComposerMode(session)`, and `detach` calls `scene.exitComposerMode()` (`:76-108`).
- Revision: a private counter. `start` subscribes to `DashboardStateChangedEvent`; when the event is not
  caused by this document's own apply, the counter increments and `layoutChanged` fires. Tab switches only
  re-measure (`:81-100`).
- `readSpec` returns `transformSceneToSaveModelSchemaV2(scene)` (`:130-132`), so it always reads the whole
  dashboard.
- `applySpec` (`:134-188`) runs in three steps:
  1. Zod-validate the spec against `dashboardV2SpecSchema`; failure returns `invalid`.
  2. Run the synchronous gate `checkWrite` (`:191-215`). It returns `closed` when the session ended, the
     scene is inactive, or the scene's session is a different one. It returns `aborted` on the signal,
     `closed` when the flag is off, `denied` when `canStillEdit` fails, and `stale` when `baseRevision`
     differs. Over Viewing it calls `startComposerEditingForAssistant()` and returns `denied` if that fails.
  3. Call `activateSidebar()`, then `withAssistantWrite(applyDashboardSpec({... scope: 'composer'}))`.
     An unchanged `body` returns `denied`. On success it bumps the revision, calls
     `clearDirtyIfUnchanged`, `recordEditMutation('assistant')` and `forceRender()`, and returns
     `applied` with the re-serialised spec.
- `finish()` returns `{}`, because dashboards never save (`:126-128`, `composer/types.ts:193-196`).

### Overlay (`composer/ComposerOverlay.tsx`)

- The overlay takes `session: ComposerSession<unknown>` and an option `belowStickyControls`, documented as
  "For a document whose sticky controls sit outside the overlay (a notebook's)"
  (`ComposerOverlay.tsx:52-60`).
- It catches presses and clicks on the window in the capture phase. Tab headers (`[role="tab"]`) and the
  dashboard controls (`selectors.pages.Dashboard.Controls`) stay usable. It hit-tests with
  `session.elementSelector` and `session.elementKeyAttribute`, and treats variable and data-layer controls
  as special cases (`ComposerOverlay.tsx:15-21, 39-51, 441, 491, 576-650`).
- It is mounted in only one place: as `overlay` of `DashboardSidebarSplitter`, which renders only when
  `!editPanel` (`scene/DashboardSceneRenderer.tsx:48, 176-188`). In panel edit,
  `<editPanel.Component>` renders instead, with no overlay slot.

### Pause

- `setPaused(true)` cancels a pending pick and disables pins (`ComposerSession.ts:271-279`).
  `useComposerPaused` reads `getOverlayState().paused` (`composer/useComposerPaused.ts:7-14`); for example,
  `scene/new-toolbar/actions/SaveDashboard.tsx` uses it.
- `DashboardScene.leaveComposer()` and `setComposerEditing(false)` ask for confirmation while paused,
  because ending or downgrading the session stops the Assistant turn (`scene/DashboardScene.tsx:960-1065`).

### Exit

- Dashboard `exit()` returns `void`. `closed` resolves `{}` (`ComposerSession.ts:421-428`,
  `composer/types.ts:277-292`).
- `DashboardScene` closes the session whenever it leaves Composer mode by any path, through the state
  subscription at `scene/DashboardScene.tsx:577-591`. Deactivating the scene also exits and closes it
  (`scene/DashboardScene.tsx:597-603`).
- `exitComposerMode()` returns to `edit` if Composer was over Editing, otherwise to `agent` or `view`. It
  never saves or discards (`scene/DashboardScene.tsx:937-952`).

### Scene-side Composer state (`scene/DashboardScene.tsx`)

- `_composer?: { session, modeBefore }` (`:247-248`) and `getComposerSession()` (`:1067-1069`).
- `enterComposerMode` sets `composerEditing = modeBefore === 'edit'` and calls
  `setDashboardMode('composer', 'composer')` (`:918-935`).
- `setDashboardMode` refuses every mode change while `planning`, `editPanel`, or `editview` is set
  (`:815-825`). So the scene cannot enter `composer` mode from panel edit either, separately from
  `canEnterComposer`.
- `prepareEditAction` in Composer mode allows a write only inside `withAssistantWrite`
  (`:421-440`). `canComposerWrite()` is `isComposerEditing(state)` (`:954-957`).
- `canManuallyEditDashboard` is false in Composer mode (`scene/dashboardModes.ts:49-51`), and
  `isFullDashboardEditing` is false in Composer mode (`scene/types/dashboard.ts:99-102`).

## 2. A second document type: what the notebook stub shows

This repo has no `NotebookComposerDocument` (`grep -rl omposer public/app/features/notebook` finds
nothing). Notebook support so far is the contract plus a few hooks in shared code:

- Contract types: `ComposerResource = 'dashboard' | 'notebook'`, `ElementRef.kind 'cell'`,
  `ComposerApplyOptions.viewOnlyChanges` (notebooks only), `ComposerSaveOutcome`,
  `ComposerExitResult.save`, `retrySave?`, and a union return type for `enter`
  (`composer/types.ts:9-27, 57-62, 95-96, 173-196, 288-292`). The notebook spec type is
  `app/features/notebook/types` `Spec` (`public/app/features/notebook/types.ts:52`).
- Revision semantics are documented per document: a notebook's revision counts edit-history changes, so a
  query refresh never makes a read stale (`composer/types.ts:262-266`).
- `composerApi.resolveTarget` refuses notebook targets with `unsupported` (`composerApi.ts:32-34`).
- Entry requests already route by resource (`composer/composerEntryRequests.ts:29`, and tests in
  `composer/composerEntryRequests.test.ts:51-106`).
- Shared code anticipates a notebook: `ComposerSession` is generic in `Spec`, the session hands `retrySave`
  through, `finish()` covers the exit save (`ComposerSession.ts:92-141`), and the overlay has
  `belowStickyControls` (`ComposerOverlay.tsx:56-60`).
- The mutation-client stack already registers `NotebookMutationClient` next to `DashboardMutationClient`
  (`.../dashboardMutation/dashboardMutationApi.ts:38-64`). `DashboardComposerDocument` deliberately writes
  to its own scene and never to "whichever mutation client is newest on the global stack (that can be a
  notebook)" (`composer/DashboardComposerDocument.ts:49-56`).

The extension pattern these pieces show:

1. Add a `ComposerResource` value and any new `ElementRef` kinds to the public contract.
2. Implement `ComposerDocument<Spec, ComposerSession<Spec>>` for the new document type.
3. Teach `composerApi.resolveTarget` to find the document and run its own `canEnter`.
4. Call `ComposerSession.open(document)`.
5. Give the scene an `attach`/`detach` hook into its own Composer state.
6. Mount `ComposerOverlay` in that document's renderer.
7. Let entry-request listeners opt in through `resources`.

**What is generic and what is dashboard-specific.**

- Generic: everything in `ComposerSession`, the overlay mechanics, `raster.ts`/`regionCapture.ts`, and
  `composerGeometry.findCaptureRoot` (it takes a `selector` argument, `composerGeometry.ts:28`).
- Dashboard-specific:
  - All of `DashboardComposerDocument`.
  - `canEnterComposer` and `canStillEdit`.
  - `ComposerSession.enter`.
  - These constants inside `ComposerSession`, which leak dashboard specifics into the "shared" class:
    the region scroller selector `DashboardSidebarSplitter.bodyContainer`, `DASHBOARD_ACTIONS_SELECTOR`, and
    the overlay's `CONTROLS_SELECTOR` for dashboard controls (`ComposerSession.ts:34-38`,
    `ComposerOverlay.tsx:17`).
  - `composerApi.resolveTarget`, which knows only `DashboardMutationClient`.
  - `useComposerPaused`, which takes a `DashboardScene`.

## 3. Panel edit's scene ownership

### PanelEditor (`panel-edit/PanelEditor.tsx`)

- It is a `SceneObjectBase` stored as `DashboardScene.state.editPanel`, built lazily by
  `dashboardViews.editPanel` (`scene/dashboardViewRegistry.ts:47-51`) and opened with `openPanelEditor`
  (`panel-edit/openPanelEditor.ts:16-22`).
- State: `panelRef` (a ref to the dashboard's own `VizPanel`, not a clone), `optionsPane`, `dataPane`
  (`PanelDataPane | PanelDataPaneNext`), `tableView?: VizPanel`, `isDirty`, `useQueryExperienceNext`, and
  others (`PanelEditor.tsx:56-74`).
- It edits the panel and its layout item in place. It snapshots `_originalSaveModel` and
  `_layoutItemState` when it opens (`:87-100, 237-245`), and computes dirtiness by deep-comparing
  `vizPanelToPanel` (`:252-270`).
- Inside panel edit there is no undo. `DashboardEditActionEvent`s from the layout item are performed
  immediately (`:143-148`, which has a "TODO add support for undo/redo within panel edit").
- When panel edit is deactivated, `commitChanges()` packs the whole panel-edit session into one
  "Panel changes" edit action. The sidebar publishes it once it is active again, because "the main dashboard
  edit / undo system is not active while panel edit is active" (`:166-219`; `sidebar/DashboardSidebar.tsx:130-132, 224-226`).
  `commitChanges` skips the commit when the tree was replaced wholesale, and the code names APPLY_SPEC as one
  cause (`:179-185`).
- `onDiscard` restores `_layoutItemState` (or removes a new panel) and clears `?editPanel`
  (`:368-386`).
- Table View switch: `onToggleTableView` builds a separate table `VizPanel` whose data is a
  `DataProviderSharer` over the panel's `$data` (`:433-456`). `PanelEditPanelWrapper` renders that panel
  instead of the dashboard body (`panel-edit/PanelEditPanelWrapper.tsx:29-36`). The toggle lives in
  `PanelEditControls` inside the dashboard controls (`panel-edit/PanelEditControls.tsx:25-30`). Changing
  plugin turns Table View off (`PanelEditor.tsx:301-304`).
- Panel preview: when Table View is off, the preview renders `dashboard.state.body` through
  `SoloPanelContextForPanelEdit`, so only the edited panel shows (`PanelEditPanelWrapper.tsx:20-35`). The
  panel's `data-viz-panel-key` DOM root therefore still exists in panel edit. The table-view panel is a
  different `VizPanel` that is not in the dashboard body.
- Switching between v1 and v2 editors replaces `dataPane` (`PanelEditor.tsx:458-472`).
  `buildPanelEditScene` chooses v2 from the `QueryEditorNext` flag plus a localStorage preference
  (`:475-488`).

### PanelEditNext data pane (`panel-edit/PanelEditNext/`)

- `PanelDataPaneNext` is a scene object with `panelRef`, `datasource`, `dsSettings`, `dsError`, and
  `defaultDatasourceRef` (`PanelDataPaneNext.tsx:100-117`). It mutates the canonical runner directly through
  `getQueryRunnerFor(panel)` with `queryRunner.setState({ queries })`: `updateQueries`,
  `updateSelectedQuery`, `addQuery`, `deleteQuery`, `duplicateQuery`, `toggleQueryHide`, bulk operations, and
  `changeDataSource` (`:310-412, 456, 670`). Transformations are changed on
  `panel.state.$data instanceof SceneDataTransformer` (`:539-660, 811`). None of these go through the
  dashboard edit-action or `DashboardStateChangedEvent` pipeline.
- `README.md` describes the three `queryRunner.state.datasource` states: undefined, explicit, and
  `-- Mixed --`. It also says `resolveDatasourceRef` deliberately returns a ref instead of writing it, so the
  serializer does not "silently bake an explicit UID onto panels that were saved without one"
  (`PanelEditNext/README.md:28-46`).
- Card identities in the editor UI:
  - Queries and expressions use `refId`.
  - Transformations use `transformId = \`${config.id}-${index}\``, which depends on position
    (`QueryEditor/utils.ts:92-94`, `QueryEditor/hooks/useTransformations.ts:29`).
  - Card types are `QueryEditorType.Query | Expression | Transformation | Alert` (`PanelEditNext/constants.ts:19-24`).
  - `getEditorType` classifies cards (`QueryEditor/utils.ts:25-40`), using `isExpressionQuery` /
    `isExpressionReference`.
- DOM hooks for hit-testing: stacked-editor sections carry `data-stacked-editor-item-id` and
  `data-stacked-editor-item-type` (`QueryEditor/StackedEditor/StackedSection.tsx:25-31`). The sidebar cards
  (`QueryEditor/Sidebar/Cards/*`) have no comparable `data-*` key attribute.
- Selection state is React-local (`useState`) in `useSelectionState`: `activeQueryRefId`,
  `selectedQueryRefIds`, `activeTransformationId`, and others (`QueryEditor/hooks/useSelectionState.ts:87-160`).
  It reaches components through `QueryEditorContext` (`QueryEditor/QueryEditorContext.tsx:93-215`).
- In the v2 spec, a panel's `data` is `QueryGroupSpec { queries: PanelQueryKind[]; transformations:
  TransformationKind[]; queryOptions }`, and each `PanelQuerySpec` has `{ query, refId, hidden }`
  (`packages/grafana-schema/src/schema/dashboard/v2/types.spec.gen.ts:162-205`). A query or expression can be
  addressed by `(panelId, refId)`. A transformation has only a position and its `group` (the transformer id).

### Where query and expression picks could come from (facts only)

- `ElementRef` has no kind for them today, so the public contract would have to change.
- Possible DOM roots: the stacked-editor sections (`data-stacked-editor-item-*`), the sidebar cards (they
  would need a key attribute), and the panel preview (the existing `data-viz-panel-key`).
- Possible scene-side identity: `refId` on the canonical `SceneQueryRunner.state.queries`, and the index
  into `SceneDataTransformer.state.transformations`.

### What happens to a dashboard Composer session at panel-edit boundaries today

- Entering panel edit from the UI while in Composer: `openPanelEditor` returns early, because
  `canManuallyEditDashboard` is false in Composer mode (`panel-edit/openPanelEditor.ts:17-19`;
  `scene/dashboardModes.ts:49-51`).
- Entering through a URL (`?editPanel=`): `DashboardSceneUrlSync.updateFromUrl` calls
  `scene.openFullEditor()` when the scene is not full-editing, which is always the case in Composer
  (`scene/DashboardSceneUrlSync.ts:121-150`; `scene/types/dashboard.ts:99-102`). `openFullEditor` calls
  `exitComposerMode()` first, with the comment "A manual-edit entry point (edit panel URL, settings) leaves
  Composer first" (`scene/DashboardScene.tsx:905-916`). The mode subscription then closes the session
  (`:577-591`). Net effect: **the session ends**. The plugin sees `signal` abort and `closed` resolve `{}`.
- While panel edit is open, `canEnterComposer` refuses (`editPanel`), and `setDashboardMode` refuses every
  change (`scene/DashboardScene.tsx:815-825`).
- Leaving panel edit: nothing re-enters Composer. The ended session stays ended. The user or plugin would
  have to start a new one (new session, new regions, new anchors).

## 4. The v0 query coauthoring preview and whole-spec apply

Sources: `panel-edit/PanelEditNext/QueryEditor/coauthoring/CONTEXT.md`,
`queryPreview.ts`, `useQueryProposalTransaction.ts`, `internalCoauthoringContract.ts`, and
`supportsQueryCoauthoring.ts`.

- **Preview invariant** (`CONTEXT.md:37-39`): "Proposals must not enter the canonical
  `SceneQueryRunner.state.queries` until Accept." `startQueryPreview` clones the canonical runner, replaces
  only the selected query in the clone, and projects the clone's `PanelData` into the canonical runner's
  `data`. Saving, sharing, the query library and other serializers keep seeing the baseline query.
- Mechanics (`queryPreview.ts`):
  - It clones with `runQueriesMode: 'manual'` and attaches the clone as a `$behaviors` entry on the panel
    (`:170-205`).
  - It projects with `queryRunner.setState({ data })` (`:73-81`).
  - When disposed, it restores `baselineData` only if the canonical data is still what the preview last
    projected (`:116-129`).
  - **Any change to canonical `queries` that differs from the baseline disposes the preview**
    (`:283-287`).
  - A time-range change clears caches and runs (`:131-142`).
- Transaction (`useQueryProposalTransaction.ts`):
  - It keeps `baselineQueries`. When `queries` stop matching them, it clears the transaction and calls
    `adapter.dismiss()` (`:88-96`).
  - Accept is `updateQuery(accepted, baseline.refId)` followed by `runQueries()` (`:186-199`).
  - Unmounting the row (a `queryKey` change) clears and re-runs (`:77-86`).
  - `editorQuery`/`editorQueries` show the proposal in the editor UI only (`:208-214`).
- Ownership (`CONTEXT.md:7-17, 41-50`): the query row owns the transaction. There is at most one per row,
  and "Cross-row session coordination is intentionally outside this experiment." A genuine editor change or
  an explicit run cancels it.
- Scope: Prometheus only, through a private, unpublished prop `unstable_queryEditorCoauthoringV1`. The doc
  requires a reviewed `@grafana/data` interface before any second adapter is added (`CONTEXT.md:19-23`;
  `supportsQueryCoauthoring.ts:5-8`; `internalCoauthoringContract.ts:1-4`).
- Interaction with whole-spec apply:
  - `applyDashboardSpec` rebuilds the whole tree, sets `editPanel: undefined`, and re-opens panel edit
    through URL sync on the new tree (`actions/dashboard/applyDashboardSpec.ts:60-119`). Every
    `SceneQueryRunner`, `PanelEditor`, `PanelDataPaneNext` and query row is therefore replaced. React-local
    editor selection, any coauthoring transaction, and any preview clone attached to the old panel are lost
    with the discarded tree.
  - The re-open goes through `updateFromUrl({ editPanel })`. That calls `openFullEditor()` whenever the
    scene is not full-editing, which includes Composer mode (`DashboardSceneUrlSync.ts:144-150`), so a
    re-open from inside Composer would leave Composer the way it works today.
  - `readSpec` serializes canonical state, so during a preview it returns the baseline query, as the
    invariant intends. A write prepared from that read and applied while a preview is open would replace
    queries and so dispose the preview (`queryPreview.ts:283-287`).
- Revision gap. `DashboardComposerDocument` counts only `DashboardStateChangedEvent`
  (`DashboardComposerDocument.ts:81-88`). The sidebar publishes that event for edit actions it handles
  (`sidebar/DashboardSidebar.tsx:355, 461, 481`). Panel-edit query and transformation changes call
  `queryRunner.setState` directly, and panel-edit edit actions are performed with no sidebar involved
  (`PanelEditor.tsx:143-148`). By this reading, those changes would not advance the dashboard revision until
  `commitChanges` runs on exit. This is inferred from the code and was not tested.
- Undo. A Composer apply is one `dashboard.editSchema` action in the sidebar's undo stack.
  `DashboardComposerDocument.applySpec` calls `activateSidebar()` because "Edit actions only run while the
  sidebar is active" (`DashboardComposerDocument.ts:162-164`). Panel edit keeps the sidebar's undo inactive
  and records one "Panel changes" action on exit (`PanelEditor.tsx:206-218`). The two would interleave
  without coordination.

## Decision points (open)

1. **Target granularity.** Is panel edit (a) a state the dashboard document can be in, keeping the same
   session across the boundary, (b) a new `ComposerDocument` (for example a panel-edit document with its
   own `Spec` and revision), or (c) a new `ComposerResource`/`ComposerTarget` with a panel id? Today
   `ComposerTarget` only names a document.
2. **Session continuity.** Should entering or leaving panel edit keep the session (pins, regions, anchors)
   or end it? Today a URL entry ends it, and nothing restarts it on exit.
3. **Spec unit for apply.** Options are the whole dashboard v2 spec (`applyDashboardSpec` rebuilds the
   tree and drops and re-opens `PanelEditor`), a panel or `QueryGroupSpec` slice, or per-query proposals.
   This choice decides whether in-editor state survives an apply.
4. **New `ElementRef` kinds** for query, expression and transformation, and their identity. `refId` is
   stable within a panel. `transformId` depends on position (`${id}-${index}`). Is a transformation
   addressed by index or by something new?
5. **Pick surfaces and DOM key attributes.** Which surfaces are pickable: the stacked editor
   (`data-stacked-editor-item-*` already exists), sidebar cards (no key attribute today), the panel preview,
   Table View (a separate `VizPanel` outside the dashboard body)? `ComposerDocument` has only one
   `elementSelector`/`elementKeyAttribute` pair per document.
6. **Overlay host.** `ComposerOverlay` is mounted only inside `DashboardSidebarSplitter`, which is not
   rendered in panel edit. Where would it mount in `PanelEditorRendererNext`/`VizAndDataPaneNext`, and what
   does the region scroller and capture root become? Today they are hard-coded to the dashboard body scroller
   and `[data-dashboard-actions]`.
7. **Revision source in panel edit.** Direct `queryRunner.setState` edits bypass `DashboardStateChangedEvent`.
   What counts as a definition change, and what makes a read stale?
8. **Write gate and modes.** `setDashboardMode` refuses while `editPanel` is set, and `canManuallyEditDashboard`
   or `isFullDashboardEditing` are false in Composer. Does Composer layer over panel edit (manual editing
   and Assistant writing at once), or does panel edit become read-only like Composer over the dashboard?
9. **Undo model.** Panel edit has no undo and commits one action on exit. Composer applies are undoable
   `dashboard.editSchema` actions. How do they combine?
10. **Relationship to v0 coauthoring.** Should Composer reuse the row-scoped preview and transaction
    (Prometheus-only, private prop), coexist with it, or replace it? Who owns a proposal when both exist?
11. **v1 query editor.** `PanelEditor` can render either `PanelDataPane` (v1) or `PanelDataPaneNext` (v2),
    and the user can toggle between them mid-session. Is Composer v2-only?
12. **Public contract versioning.** Do new ref kinds or targets need `ComposerAPI.version` > 1, or
    `resources`-style opt-in, so that older plugins never receive refs they cannot handle?

## Constraints any design must respect

- **Preview invariant:** proposals stay out of canonical `SceneQueryRunner.state.queries` until Accept, so
  every serializer (`readSpec` included) sees the baseline (`CONTEXT.md:37-39`).
- Any canonical `queries` change that differs from the baseline disposes an open preview and dismisses the
  row's transaction (`queryPreview.ts:283-287`, `useQueryProposalTransaction.ts:88-96`).
- Coauthoring is row-scoped with one transaction per row. Cross-row coordination is explicitly out of scope
  (`CONTEXT.md:9, 50`).
- The private coauthoring prop must not be copied. A second adapter requires a reviewed `@grafana/data`
  interface first (`CONTEXT.md:21-23`).
- Whole-spec apply replaces the scene tree. An open `PanelEditor` is dropped and re-opened by URL sync
  against the new tree, and `commitChanges` deliberately does nothing in that case
  (`applyDashboardSpec.ts:60-119`; `PanelEditor.tsx:179-185`).
- Re-opening panel edit through URL sync calls `openFullEditor()`, which exits Composer mode
  (`DashboardSceneUrlSync.ts:144-150`; `DashboardScene.tsx:905-916`).
- A session writes only to the scene it was entered on, never through the global mutation-client stack
  (`DashboardComposerDocument.ts:49-56`; `composerApi.ts:1-8`).
- The apply gate must stay synchronous between its checks and the write (`DashboardComposerDocument.ts:151-157`).
  Stale reads are refused with `baseRevision` (`:204-209`).
- In Composer mode only Assistant writes, and only inside `withAssistantWrite` (`DashboardScene.tsx:421-440`).
- Leaving Composer never saves or discards dashboard changes (`DashboardScene.tsx:937-952`).
- Datasource resolution must not write a resolved ref into `queryRunner.state` (`PanelEditNext/README.md:46`).
  A whole-spec round-trip that serializes and rebuilds needs the same care so it does not bake in explicit
  datasource UIDs.
- Ad hoc table transformations are turned off on entering panel edit and restored on leaving it
  (`PanelEditor.tsx:105-121, 162-165`). The panel's runtime state in panel edit is therefore not identical to
  its dashboard-view state.
- Composer exists only while `GrafanaDashboardComposer` is on, plus dashboard modes. PanelEditNext needs
  `QueryEditorNext` or the user's preference. Coauthoring is behind its own experiment gating.
