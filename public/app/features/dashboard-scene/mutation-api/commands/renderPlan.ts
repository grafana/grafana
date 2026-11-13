/**
 * RENDER_PLAN command
 *
 * Renders a whole dashboard plan in one call: rows or tabs (optionally with rows nested inside a
 * tab), each with query-less placeholder panels, plus any stand-in variables. A revision re-renders
 * the whole plan, so there is nothing to build up incrementally the way ADD_ROW/ADD_TAB/ADD_PANEL do.
 *
 * With phase "building" the plan's sample data does not render: the dashboard waits behind a loading
 * screen until the build's first write replaces it (see DashboardMutationClient), or END_PLANNING
 * ends it when the build writes nothing. Behind the screen it is empty, or, with plan editing on, a
 * skeleton of the plan: real panels with the plan's titles, visualizations and layout, and no
 * queries, for the build to fill in by element key.
 *
 * With plan editing on, the preview owns the plan (see EditablePlan): ids name its panels and
 * sections, a panel's gridPos places it, and Build makes the skeleton from the plan as the user
 * arranged it rather than from the payload, which is the plan as proposed.
 *
 * Never calls enterEditModeIfNeeded: the preview is a view-mode surface that must never enter edit
 * mode (see refuseWhilePlanning for the few actions still reachable without it). With plan editing
 * enabled its layout can still be arranged by hand (see canArrangeLayout).
 */
import * as z from 'zod/mini';

import { CustomVariable, SceneVariableSet, type SceneVariable, type VizPanel } from '@grafana/scenes';
import { defaultPanelSpec, type PanelKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';

import { dashboardPlanEditingEnabled } from '../../scene/dashboardModes';
import {
  assignPlanIds,
  getSectionKeyForPlanSection,
  readPlanLayout,
  type DashboardPlan,
  type DashboardPlanPanel,
  type DashboardPlanRow,
} from '../../scene/dashboardPlan';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardPlanningEvent } from '../../scene/planningEvents';
import { getPlanningPanelData, getPlanningVariableValues } from '../../scene/planningSampleData';
import { canArrangeLayout } from '../../scene/types/dashboard';
import { buildVizPanel } from '../../serialization/layoutSerializers/utils';
import { getGridItemKeyForPanelId, getVizPanelKeyForPanelId } from '../../utils/utils-panels';

import { payloads } from './schemas';
import { requiresEdit, type MutationCommand } from './types';

export type RenderPlanPayload = z.infer<typeof payloads.renderPlan>;

function buildPanelSpec(panel: DashboardPlanPanel, description?: string): PanelKind {
  const base = defaultPanelSpec();
  return {
    kind: 'Panel',
    spec: {
      ...base,
      id: panel.id,
      title: panel.title,
      ...(description ? { description } : {}),
      vizConfig: { ...base.vizConfig, group: panel.vizType },
    },
  };
}

function buildPlanPanel(panel: DashboardPlanPanel, showIntent: boolean): VizPanel {
  const vizPanel = buildVizPanel(buildPanelSpec(panel, showIntent ? panel.intent : undefined), panel.id, {
    withoutQueries: true,
  });
  // buildVizPanel attaches a dropdown menu unconditionally. A preview panel must have none: a
  // plugin's View pane can mutate and persist panel options (e.g. timeseries legend toggles)
  // with no isPlanning() gate. Clearing menu removes PanelChrome's button entirely.
  // buildVizPanel preserves a real spec's options/fieldConfig, but this payload never has real
  // ones: its synthetic empty spec would clobber the sample's visualization settings. Apply the
  // sample here rather than change that behavior for every other caller. Its synthetic $data
  // also stays in this lazy command instead of loading with the shared serializer.
  vizPanel.setState({
    ...getPlanningPanelData(panel.title, panel.vizType),
    key: getVizPanelKeyForPanelId(panel.id),
    menu: undefined,
  });

  return vizPanel;
}

/** A real panel for the build to fill in: the plan's title and visualization, no queries, no sample data. */
function buildSkeletonPanel(panel: DashboardPlanPanel): VizPanel {
  return buildVizPanel(buildPanelSpec(panel), panel.id);
}

function buildPlanGrid(
  panels: DashboardPlanPanel[],
  buildPanel: (panel: DashboardPlanPanel) => VizPanel,
  useGridPos: boolean
): DefaultGridLayoutManager {
  if (!useGridPos || panels.length === 0 || !panels.every((panel) => panel.gridPos)) {
    return DefaultGridLayoutManager.fromVizPanels(panels.map(buildPanel));
  }
  return DefaultGridLayoutManager.fromGridItems(
    panels.map(
      (panel) =>
        new DashboardGridItem({
          key: getGridItemKeyForPanelId(panel.id),
          x: panel.gridPos?.x,
          y: panel.gridPos?.y,
          width: panel.gridPos?.w,
          height: panel.gridPos?.h,
          itemHeight: panel.gridPos?.h,
          body: buildPanel(panel),
        })
    ),
    true,
    true
  );
}

function buildPlanBody(
  plan: DashboardPlan,
  buildPanel: (panel: DashboardPlanPanel) => VizPanel,
  editing: boolean
): RowsLayoutManager | TabsLayoutManager {
  const sectionState = (section: DashboardPlanRow) => ({
    ...(editing ? { key: getSectionKeyForPlanSection(section.id) } : {}),
    title: section.title,
    layout: buildPlanGrid(section.panels, buildPanel, editing),
  });

  if (plan.layout !== 'tabs') {
    return new RowsLayoutManager({ rows: plan.sections.map((section) => new RowItem(sectionState(section))) });
  }

  return new TabsLayoutManager({
    tabs: plan.sections.map((section) =>
      section.sections?.length
        ? new TabItem({
            ...sectionState(section),
            layout: new RowsLayoutManager({
              rows: section.sections.map((row) => new RowItem(sectionState(row))),
            }),
          })
        : new TabItem(sectionState(section))
    ),
  });
}

export const renderPlanCommand: MutationCommand<RenderPlanPayload> = {
  name: 'RENDER_PLAN',
  description: z.globalRegistry.get(payloads.renderPlan)?.description ?? '',
  payloadSchema: payloads.renderPlan,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, { scene }) => {
    if (!scene.isActive) {
      return { success: false, error: 'The preview dashboard is no longer open.', changes: [] };
    }

    // Saved dashboards and real panels must never be replaced by a preview. A blank new
    // editor can already be dirty from auto-entering edit mode; core owns that transition
    // rather than requiring the caller to manipulate the scene's dirty/editing flags.
    // An already-planning scene may be re-rendered with a revised plan.
    const alreadyPlanning = scene.state.planning !== undefined;
    const hasExistingContent = !alreadyPlanning && scene.state.body.getVizPanels().length > 0;
    const isBlankNewEditor = !scene.state.uid && !hasExistingContent && scene.state.isEditing;
    if (scene.state.uid || (scene.state.isDirty && !isBlankNewEditor) || hasExistingContent) {
      return {
        success: false,
        error: 'RENDER_PLAN can only render into a blank, unsaved dashboard, to avoid overwriting existing content.',
        changes: [],
      };
    }

    try {
      const editing = dashboardPlanEditingEnabled();
      const { planId, phase, ...proposed } = payload;
      const isBuilding = phase === 'building';
      const previous = scene.state.planning;
      const arranged = previous?.phase === 'preview' && previous.planId === planId ? previous.editable : undefined;
      // Build makes the dashboard from the plan the user arranged, which only the preview has.
      const plan = editing && isBuilding && arranged ? arranged.plan : assignPlanIds(proposed);

      const body = isBuilding
        ? editing
          ? buildPlanBody(plan, buildSkeletonPanel, editing)
          : DefaultGridLayoutManager.createEmpty()
        : buildPlanBody(plan, (panel) => buildPlanPanel(panel, editing), editing);

      const variables: SceneVariable[] = (isBuilding ? [] : (plan.variables ?? [])).map(
        (name) => new CustomVariable({ name, query: getPlanningVariableValues().join(',') })
      );

      const notify = (action: 'build' | 'dismiss') => {
        const { planning } = scene.state;
        if (planning?.planId === planId) {
          const editable = planning.phase === 'preview' ? planning.editable : undefined;
          appEvents.publish(new DashboardPlanningEvent({ planId, action, ...editable }));
        }
      };

      // A fresh /dashboard/new scene enters edit mode unconditionally on activation (DashboardScene's
      // isNew branch) unless the URL carries editSource=plan-preview. The mutation API is public,
      // so a caller can still reach /dashboard/new without that marker -- this command must
      // guarantee view mode itself rather than depend on the caller's URL.
      const wasEditing = scene.state.isEditing;

      if (wasEditing) {
        // Stop the change tracker before the bulk setState below, or its diff (worker-async in
        // the browser, synchronous in tests) can flip isDirty back to true before exitEditMode
        // below reads it.
        scene.pauseTrackingChanges();
      }

      if (scene.state.sidebar.state.openPane?.getId() === 'add') {
        scene.state.sidebar.closePane();
      }

      scene.setState({
        title: plan.title,
        description: plan.description,
        body,
        $variables: new SceneVariableSet({ variables }),
        // exitEditModeConfirmed (via exitEditMode below) restores the pre-edit snapshot whenever
        // the scene is dirty, and isNew marks a fresh dashboard dirty on entry. Must be false
        // here or exiting below wipes the rendered plan.
        isDirty: false,
        planning: isBuilding
          ? { phase: 'building', planId, planTitle: plan.title }
          : {
              phase: 'preview',
              planId,
              planTitle: plan.title,
              onBuild: () => notify('build'),
              onDismiss: () => notify('dismiss'),
              // The layout as rendered, so the plan has every panel's position even where the
              // payload left it to automatic packing.
              ...(editing ? { editable: { plan: readPlanLayout(body, plan), revision: 0 } } : {}),
            },
      });

      if (wasEditing) {
        // Installs the new content above, then exits edit mode without restoring the snapshot
        // onEnterEditMode captured (empty, for a fresh dashboard).
        //
        // Must stay adjacent to the setState above: exitEditMode reads scene.state.isDirty at
        // call time, and anything that flips it back to true first wipes the plan.
        scene.exitEditMode({ skipConfirm: true, restoreInitialState: false });
      }

      // Arranging the preview records undo entries, which act on the panels this render replaced.
      scene.state.sidebar.clearHistory();

      // DefaultGridLayoutManager hardcodes isDraggable/isResizable true; only editModeChanged
      // (fired on an edit-mode transition) sets them, and the marker path has no such transition.
      // Go through editModeChanged rather than the flags directly: it cascades through
      // Rows/TabsLayoutManager to every inner grid. Must run after exitEditMode, which turns
      // dragging off again.
      body.editModeChanged?.(canArrangeLayout(scene.state));

      // With editing on, the caller learns the ids the plan was given and, on Build, the plan the
      // skeleton was made from, which it needs to fill each panel by its element key.
      const rendered = scene.state.planning?.phase === 'preview' ? scene.state.planning.editable : { plan };
      return {
        success: true,
        ...(editing ? { data: rendered } : {}),
        changes: [{ path: '/', previousValue: null, newValue: plan.title }],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
