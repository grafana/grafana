# Dashboard scene

## Scope and code map

This directory (`public/app/features/dashboard-scene/`) implements Grafana's
dashboard viewing and editing experience using `@grafana/scenes`. It contains the dashboard scene model, layouts, editing UI, and
conversion between scene objects and saved dashboard JSON. The root-level
[AGENTS.md](../../../../AGENTS.md) also applies here.

### Current user experience

The `dashboardNewLayouts` feature toggle is `true` by default. The
`dashboardNewLayouts=true` code path represents the current user experience and is
the maintained implementation. Follow this path when investigating, implementing,
or testing dashboard behavior. Code paths used only when `dashboardNewLayouts` is
`false` are not maintained. Do not extend false-only paths; inspect them only when
needed to understand a regression or compatibility behavior.

### Boundaries

- **`@grafana/scenes`** is an external dependency that supplies the scene framework,
  including `SceneObjectBase`, `VizPanel`, query runners, time ranges, and variables.
  This directory composes and extends those building blocks for dashboards.
- **[../dashboard/](../dashboard/)** contains shared services, API clients, and UI
  used by the current scene experience alongside the older dashboard implementation.
  Follow dependencies from the `dashboardNewLayouts=true` path into this directory
  only as needed for the task. Directory location alone does not determine whether
  code is maintained; skip code used exclusively by the disabled path.
- **Compatibility wrappers** in
  [utils/DashboardModelCompatibilityWrapper.ts](utils/DashboardModelCompatibilityWrapper.ts)
  and [utils/PanelModelCompatibilityWrapper.ts](utils/PanelModelCompatibilityWrapper.ts)
  adapt scene objects for consumers of the older dashboard and panel model APIs
  within the current experience. Check these when a change affects consumers reached
  from the `dashboardNewLayouts=true` path.

### Where to start

Paths below are relative to this directory. Start with the area responsible for the
behavior being changed, then follow its callers and collaborators.

| Area                           | Responsibility and entry points                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page loading and routing       | [pages/DashboardScenePage.tsx](pages/DashboardScenePage.tsx) mounts the dashboard page; [DashboardScenePageStateManager.ts](pages/DashboardScenePageStateManager.ts) loads dashboards and manages page state.                                                                                                                                                                                                                                    |
| Dashboard model and rendering  | [scene/DashboardScene.tsx](scene/DashboardScene.tsx) is the root dashboard scene model; [DashboardSceneRenderer.tsx](scene/DashboardSceneRenderer.tsx) renders it. [DashboardSceneUrlSync.ts](scene/DashboardSceneUrlSync.ts) handles dashboard URL state.                                                                                                                                                                                       |
| Layouts                        | [scene/types/DashboardLayoutManager.ts](scene/types/DashboardLayoutManager.ts) defines the shared contract. Implementations live in [scene/layout-default/](scene/layout-default/), [scene/layout-auto-grid/](scene/layout-auto-grid/), [scene/layout-rows/](scene/layout-rows/), and [scene/layout-tabs/](scene/layout-tabs/); shared operations live in [scene/layouts-shared/](scene/layouts-shared/).                                        |
| Editing                        | [actions/](actions/) contains editing actions. [sidebar/](sidebar/), [panel-edit/](panel-edit/), and [settings/](settings/) contain the editing interfaces. [mutation-api/](mutation-api/) exposes programmatic scene modifications.                                                                                                                                                                                                             |
| Loading and serializing models | [serialization/](serialization/) converts saved V1 and V2 dashboard models to scenes and back. Start with [DashboardSceneSerializer.ts](serialization/DashboardSceneSerializer.ts) and [V1 loading](serialization/transformSaveModelToScene.ts), [V2 loading](serialization/transformSaveModelSchemaV2ToScene.ts), [V1 saving](serialization/transformSceneToSaveModel.ts), and [V2 saving](serialization/transformSceneToSaveModelSchemaV2.ts). |
| Change tracking and saving     | [saving/DashboardSceneChangeTracker.ts](saving/DashboardSceneChangeTracker.ts) detects persisted changes; [saving/](saving/) also contains save hooks, forms, and save orchestration.                                                                                                                                                                                                                                                            |
| Scene lookup and compatibility | [utils/](utils/) contains scene graph and panel lookup helpers, identifier helpers, and compatibility wrappers. Check existing helpers before adding traversal logic.                                                                                                                                                                                                                                                                            |

## Layouts and scene graph rules

- Work through the [DashboardLayoutManager contract](scene/types/DashboardLayoutManager.ts).
  Panels can be nested inside rows and tabs; avoid assuming a flat grid.
- Use existing helpers in [dashboardSceneGraph.ts](utils/dashboardSceneGraph.ts)
  for panel lookup and identifier allocation.
- Preserve identifiers when moving elements. Allocate fresh identifiers when
  duplicating them, and distinguish repeat clones from their source elements.

## Editing, saving, and compatibility

- Follow existing [editing actions](actions/) so changes participate in undo/redo.
  [makeEditAction.ts](actions/utils/makeEditAction.ts) shows a simple property change.
- For new persisted settings, check both [serialization](serialization/) and
  [DashboardSceneChangeTracker.ts](saving/DashboardSceneChangeTracker.ts): the setting
  must survive reload and mark the dashboard as changed.
- With `dashboardNewLayouts` on, dashboards save as V2. Dashboards stored as V1 still
  load through [V1 loading](serialization/transformSaveModelToScene.ts), then switch
  to the V2 serializer (`targetVersion: 'v2'` in
  [DashboardScenePageStateManager.ts](pages/DashboardScenePageStateManager.ts)).
  Reports, snapshots, and templates keep the V1 serializer, and
  [SaveProvisionedDashboardForm.tsx](saving/SaveProvisionedDashboardForm.tsx) exports
  V1 for file provisioning. A new persisted setting usually needs all four
  transforms: V1 and V2 loading and saving.
- Keep temporary runtime state out of normal saves; preserve the separate snapshot
  handling for repeated elements.

## Testing and verification

For component, hook, and Scene-class unit tests, use the
[dashboard-scene-add-unit-tests skill](../../../../.agents/skills/dashboard-scene-add-unit-tests/SKILL.md)
for testing conventions and verification.

For persisted dashboard settings or schema conversion, extend tests in
[serialization/](serialization/) and, when change detection is affected,
[saving/](saving/). Check the affected load/save paths and round trips for each
supported schema involved.

For browser behavior such as dragging, resizing, navigation, or complete editing
flows, extend specs in
[e2e-playwright/dashboard-new-layouts/](../../../../e2e-playwright/dashboard-new-layouts/).
Read the
[suite's AGENTS.md](../../../../e2e-playwright/dashboard-new-layouts/AGENTS.md)
and use the [add-e2e-tests skill](../../../../.agents/skills/add-e2e-tests/SKILL.md).

## Common pitfalls and reference examples

<!-- Maintainers: Add recurring mistakes observed in this area, why they cause problems,
and a link to a local example of the correct approach. Keep general rules and testing
conventions in their existing guides and skills. -->

### A remounted component deactivates its scene object

`activate()` on a scene object is ref-counted. When a scene object's component
unmounts and nothing else keeps it active, Scenes deactivates the object and clears
its subscriptions. A component remounts when the same element renders under a
different parent, for example `isFull ? <A>{viz}</A> : <B>{viz}</B>`. In panel edit,
the options pane outlives the preview, so a preview remount can stop panel options
from responding without any error.

If a layout change can move a scene object's component to a new parent, keep the
object active from its owner for the owner's lifetime. Check the owner even when your
change does not touch it. See the activation handler in
[PanelEditor.tsx](panel-edit/PanelEditor.tsx) and its remount test in
[PanelEditor.test.ts](panel-edit/PanelEditor.test.ts).
