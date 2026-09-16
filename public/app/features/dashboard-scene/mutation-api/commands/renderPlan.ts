/**
 * RENDER_PLAN command
 *
 * Renders a whole dashboard plan in one call: rows or tabs, each with its query-less
 * placeholder panels, plus any stand-in variables. This is the same shape every dashboard
 * load already builds a tree in one pass (deserializeRowsLayout/deserializeTabsLayout) --
 * a plan preview renders once and is never edited, so there is nothing to build up
 * incrementally the way ADD_ROW/ADD_TAB/ADD_PANEL are for a real, editable dashboard.
 *
 * Deliberately does not call enterEditModeIfNeeded: the preview is a static, view-mode
 * surface that never enters edit mode (see the sibling commands' own guard,
 * refuseWhilePlanning, for the handful of actions that are reachable without it).
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
  vizPanel.setState({ key: getVizPanelKeyForPanelId(id) });

  // buildVizPanel's own sample-vs-spec merge lets a real spec's options/fieldConfig win over the
  // sample (see layoutSerializers/utils.ts) -- correct when a caller supplies real ones, but this
  // command never does (its payload has no options/fieldConfig field at all), so the synthetic
  // spec's empty options/fieldConfig would otherwise clobber the sample it just set. Re-apply it
  // explicitly rather than widen that shared merge for a caller that will never have real values.
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

    // RENDER_PLAN replaces the whole body, and END_PLANNING (its counterpart) clears
    // unconditionally -- correct only because the assistant's own path always starts from a
    // fresh, blank /dashboard/new (verified from source: it navigates there itself before ever
    // calling RENDER_PLAN). Nothing in the mutation API enforces that for any other caller, and
    // without this check a dirty or already-populated dashboard would have its real content
    // silently overwritten -- with the isDirty: false set further down immediately suppressing
    // the unsaved-changes warning that would otherwise have caught it.
    //
    // This is also what makes the deliberate absence of per-panel identity tracking (there is no
    // planningSession.ts; see the design notes on why) sound rather than merely convenient:
    // "discard means clear the dashboard" is only true if the dashboard was blank to begin with.
    // This precondition is what makes that true by construction, rather than assumed.
    //
    // A saved-but-empty dashboard is refused too, not only a populated one: END_PLANNING clearing
    // it unconditionally would leave a real, empty dashboard the user could then save over their
    // own work. Only an unsaved, blank, non-dirty scene is safe, and that is the only case the
    // assistant's path ever produces on first render -- so this guard is never expected to trip
    // there. It is not dead code: it is what makes skipping identity tracking correct.
    //
    // Exception: a scene that is already a plan preview (state.planning set) may always be
    // re-rendered, content and all -- the assistant calls RENDER_PLAN again on the same preview
    // to replace an in-progress plan, and by construction nothing but a prior RENDER_PLAN could
    // have put content there, so overwriting it is exactly as safe as the first render was.
    const alreadyPlanning = scene.state.planning !== undefined;
    const hasExistingContent = !alreadyPlanning && scene.state.body.getVizPanels().length > 0;
    if (scene.state.uid || scene.state.isDirty || hasExistingContent) {
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

      // A fresh /dashboard/new scene enters edit mode unconditionally on activation, before this
      // handler ever runs (DashboardScene's own isNew branch). The assistant's own preview flow
      // now tells that branch to skip the auto-edit entirely via a URL marker
      // (editSource=plan-preview) -- but the mutation API is public, so another caller can
      // still reach /dashboard/new without that marker and call RENDER_PLAN directly. This
      // command has to guarantee view mode itself rather than depend on the caller's URL.
      const wasEditing = scene.state.isEditing;

      if (wasEditing) {
        // Stop the change tracker before the bulk setState below so it cannot react mid-install
        // and re-dirty the scene -- the same pattern JsonModelEditView already uses around its
        // own bulk state replace. Without this, the tracker's own diff (worker-async in the
        // browser, but synchronous in tests, where it would otherwise race this same tick) could
        // flip isDirty back to true before exitEditMode below reads it.
        scene.pauseTrackingChanges();
      }

      scene.setState({
        title: payload.title,
        description: payload.description,
        body,
        $variables: new SceneVariableSet({ variables }),
        // Belt-and-braces alongside pauseTrackingChanges above: exitEditModeConfirmed (called by
        // exitEditMode below) restores the pre-edit snapshot whenever the scene is dirty,
        // regardless of what the caller asks, and the isNew branch marks a fresh dashboard dirty
        // on entry. A rendered plan preview is not an unsaved user edit -- there is nothing here
        // for the user to be warned about losing -- so clear it before exiting.
        isDirty: false,
        planning: {
          planId,
          planTitle: payload.title,
          panelCount: payload.sections.reduce((count, section) => count + section.panels.length, 0),
          onBuild: () => notify('build'),
          onDismiss: () => notify('dismiss'),
        },
      });

      // DefaultGridLayoutManager.fromVizPanels/createEmpty construct their SceneGridLayout with
      // isDraggable/isResizable hardcoded true; the only place either ever flips false is
      // editModeChanged, which runs on an edit-mode *transition*. On the marker path (wasEditing
      // false) there is no transition to fire it, so without this call the new body would stay
      // draggable/resizable despite the scene never entering edit mode -- correct-looking panel
      // menus (which read isEditing) over a grid that still behaves like edit mode.
      //
      // Go through editModeChanged rather than setting the two flags ourselves: it is the sync
      // point edit mode already uses for everything in this family, and it cascades through
      // TabsLayoutManager/RowsLayoutManager to their inner grids, so it picks up any other state
      // in the same family for free instead of fixing only the two symptoms found so far.
      //
      // Called on both paths, not only the marker one: on the wasEditing path below,
      // exitEditModeConfirmed already calls this itself as its last step (on what is by then this
      // same new body), so this call is redundant there rather than wrong. Confirmed empirically,
      // not just by reading exitEditModeConfirmed: temporarily removing this line left the
      // "on the fallback path" test in renderPlan.test.ts passing and only the "on the marker
      // path" test failing.
      body.editModeChanged?.(false);

      if (wasEditing) {
        // Same pattern DashboardScene.onRestore already uses: install the new content via
        // setState above, then exit edit mode without restoring the snapshot onEnterEditMode
        // captured (which, for a fresh dashboard, predates the plan and is empty).
        //
        // Keep this call directly adjacent to the setState above. pauseTrackingChanges stops the
        // change tracker itself from racing this, but exitEditMode still reads
        // scene.state.isDirty at call time -- anything else that could flip it in between (an
        // await, another command, a re-entrant setState) would reopen the same failure mode:
        // exitEditModeConfirmed restoring the pre-plan (empty) snapshot instead of leaving the
        // rendered plan in place. The symptom would be "the preview is empty," with nothing here
        // to point at why.
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
