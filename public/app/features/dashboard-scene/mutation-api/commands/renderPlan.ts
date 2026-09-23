/**
 * RENDER_PLAN command
 *
 * Renders a whole dashboard plan in one call: rows or tabs, each with query-less placeholder
 * panels, plus any stand-in variables. A plan preview renders once and is never edited, so
 * there is nothing to build up incrementally the way ADD_ROW/ADD_TAB/ADD_PANEL do.
 *
 * Never calls enterEditModeIfNeeded: the preview is a static, view-mode surface that must never
 * enter edit mode (see refuseWhilePlanning for the few actions still reachable without it).
 */
import type * as z from 'zod';

import { CustomVariable, SceneVariableSet, type SceneVariable, type VizPanel } from '@grafana/scenes';
import { defaultPanelSpec, type PanelKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardPlanningEvent } from '../../scene/planningEvents';
import { getPlanningPanelData, getPlanningVariableValues } from '../../scene/planningSampleData';
import { buildVizPanel } from '../../serialization/layoutSerializers/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils-panels';

import { payloads } from './schemas';
import { requiresEdit, type MutationCommand } from './types';

export type RenderPlanPayload = z.infer<typeof payloads.renderPlan>;

function buildPlanPanel(title: string, vizType: string, id: number): VizPanel {
  const base = defaultPanelSpec();
  const panelKind: PanelKind = {
    kind: 'Panel',
    spec: {
      ...base,
      id,
      title,
      vizConfig: { ...base.vizConfig, group: vizType },
    },
  };

  const vizPanel = buildVizPanel(panelKind, id, { withoutQueries: true });
  // buildVizPanel attaches a dropdown menu unconditionally. A preview panel must have none: a
  // plugin's View pane can mutate and persist panel options (e.g. timeseries legend toggles)
  // with no isPlanning() gate. Clearing menu removes PanelChrome's button entirely.
  vizPanel.setState({ key: getVizPanelKeyForPanelId(id), menu: undefined });

  // buildVizPanel's sample-vs-spec merge lets a real spec's options/fieldConfig win over the
  // sample, but this payload never has real ones, so the synthetic empty spec would clobber the
  // sample it just set. Re-apply it rather than change that merge for every other caller.
  const sample = getPlanningPanelData(title, vizType);
  vizPanel.setState({ options: sample.options, fieldConfig: sample.fieldConfig });

  return vizPanel;
}

export const renderPlanCommand: MutationCommand<RenderPlanPayload> = {
  name: 'RENDER_PLAN',
  description: payloads.renderPlan.description ?? '',
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
      let nextPanelId = 1;
      const buildSection = (section: RenderPlanPayload['sections'][number]) =>
        DefaultGridLayoutManager.fromVizPanels(
          section.panels.map((panel) => buildPlanPanel(panel.title, panel.vizType, nextPanelId++))
        );

      const body =
        payload.layout === 'tabs'
          ? new TabsLayoutManager({
              tabs: payload.sections.map(
                (section) => new TabItem({ title: section.title, layout: buildSection(section) })
              ),
            })
          : new RowsLayoutManager({
              rows: payload.sections.map(
                (section) => new RowItem({ title: section.title, layout: buildSection(section) })
              ),
            });

      const variables: SceneVariable[] = (payload.variables ?? []).map(
        (name) => new CustomVariable({ name, query: getPlanningVariableValues().join(',') })
      );

      const { planId } = payload;
      const notify = (action: 'build' | 'dismiss') => {
        if (scene.state.planning?.planId === planId) {
          appEvents.publish(new DashboardPlanningEvent({ planId, action }));
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
        title: payload.title,
        description: payload.description,
        body,
        $variables: new SceneVariableSet({ variables }),
        // exitEditModeConfirmed (via exitEditMode below) restores the pre-edit snapshot whenever
        // the scene is dirty, and isNew marks a fresh dashboard dirty on entry. Must be false
        // here or exiting below wipes the rendered plan.
        isDirty: false,
        planning: {
          planId,
          planTitle: payload.title,
          onBuild: () => notify('build'),
          onDismiss: () => notify('dismiss'),
        },
      });

      // DefaultGridLayoutManager hardcodes isDraggable/isResizable true; only editModeChanged
      // (fired on an edit-mode transition) ever sets them false, and the marker path has no such
      // transition. Go through editModeChanged rather than the flags directly: it cascades
      // through Rows/TabsLayoutManager to every inner grid.
      //
      // Redundant on the wasEditing path (exitEditModeConfirmed below already calls it) but harmless.
      body.editModeChanged?.(false);

      if (wasEditing) {
        // Installs the new content above, then exits edit mode without restoring the snapshot
        // onEnterEditMode captured (empty, for a fresh dashboard).
        //
        // Must stay adjacent to the setState above: exitEditMode reads scene.state.isDirty at
        // call time, and anything that flips it back to true first wipes the plan.
        scene.exitEditMode({ skipConfirm: true, restoreInitialState: false });
      }

      return { success: true, changes: [{ path: '/', previousValue: null, newValue: payload.title }] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
