import { type DataTransformerConfig } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { applyDashboardSpec } from '../../../actions/dashboard/applyDashboardSpec';
import { findVizPanelByKey } from '../../../utils/findVizPanel';
import { type DashboardScene } from '../../DashboardScene';

import { promoteAdHocChanges } from './promoteAdHocChanges';

const PROMOTION_SCOPE = 'panel-adhoc-changes';

/**
 * Applies a panel's ad hoc changes to the dashboard, then opens the save drawer so the user reviews and saves them like
 * any other dashboard change. The dashboard runs this when a panel publishes a `PromotePanelAdHocChangesEvent`.
 */
export function promotePanelAdHocChanges(dashboard: DashboardScene, panel: VizPanel) {
  const spec = promoteAdHocChanges(panel);
  if (!spec) {
    return;
  }

  const panelKey = panel.state.key;
  const adHocTransformations = panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER);
  const otherPanelsAdHocTransformations = collectAdHocTransformations(dashboard, panel);

  // Enter edit mode before changing anything, so discarding the edit restores the saved dashboard.
  // Edit mode can be refused (e.g. on mobile), and without it the save drawer does nothing, leaving the dashboard
  // changed with no way to restore the panel's ad hoc changes.
  const wasEditing = dashboard.state.isEditing;
  if (!wasEditing && !dashboard.onEnterEditMode('user', 'panel_menu')) {
    return;
  }
  // The edit is performed by the sidebar, which is not always mounted.
  dashboard.activateSidebar();

  // The rebuilt panel starts without ad hoc transformations, so the changes are not applied twice.
  applyDashboardSpec({
    scene: dashboard,
    spec,
    description: t('panel-adhoc-changes.undo-title', 'Save view changes'),
    scope: PROMOTION_SCOPE,
  });
  // add back the non promoted ad hoc transformations in other panels
  restoreAdHocTransformations(dashboard, otherPanelsAdHocTransformations);

  dashboard.openSaveDrawer({
    // Saving keeps the dashboard in edit mode, so return to view mode when that is where the user started.
    onSaveSuccess: wasEditing
      ? undefined
      : () => dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: false }),
    // Not saving takes the promoted changes back out of the dashboard and hands them back to the panel as
    // ad hoc changes, so the panel looks the same and can still save or remove them.
    onDismiss: () => {
      if (wasEditing) {
        undoPromotion(dashboard);
      } else {
        dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: true });
      }

      // Restoring the dashboard can rebuild the panels, so find the ones now in the dashboard.
      findVizPanelByKey(dashboard, panelKey)
        ?.getRuntimeTransformations()
        .set(TABLE_TRANSFORMATIONS_OWNER, adHocTransformations);
      restoreAdHocTransformations(dashboard, otherPanelsAdHocTransformations);
    },
  });
}

function collectAdHocTransformations(dashboard: DashboardScene, excluded: VizPanel) {
  const byPanelKey = new Map<string, DataTransformerConfig[]>();
  for (const obj of sceneGraph.findAllObjects(dashboard, (o) => o instanceof VizPanel && o !== excluded)) {
    if (!(obj instanceof VizPanel) || !obj.state.key) {
      continue;
    }
    const transformations = obj.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER);
    if (transformations.length > 0) {
      byPanelKey.set(obj.state.key, [...transformations]);
    }
  }
  return byPanelKey;
}

function restoreAdHocTransformations(dashboard: DashboardScene, byPanelKey: Map<string, DataTransformerConfig[]>) {
  for (const [key, transformations] of byPanelKey) {
    findVizPanelByKey(dashboard, key)?.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, transformations);
  }
}

function undoPromotion(dashboard: DashboardScene) {
  const { sidebar } = dashboard.state;
  if (sidebar.state.undoStack.at(-1)?.meta.scope === PROMOTION_SCOPE) {
    sidebar.undoAction();
  }
}
