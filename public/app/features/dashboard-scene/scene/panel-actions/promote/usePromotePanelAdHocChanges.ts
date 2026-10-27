import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { applyDashboardSpec } from '../../../actions/dashboard/applyDashboardSpec';
import { findVizPanelByKey } from '../../../utils/findVizPanel';
import { type DashboardScene } from '../../DashboardScene';

import { promoteAdHocChanges } from './promoteAdHocChanges';
import { PromotePanelAdHocChangesEvent } from './utils';

const PROMOTION_SCOPE = 'panel-adhoc-changes';

/**
 * Applies a panel's ad hoc changes to the dashboard when the panel asks for it with a `PromotePanelAdHocChangesEvent`,
 * then opens the save drawer so the user reviews and saves them like any other dashboard change.
 */
export function usePromotePanelAdHocChanges(dashboard: DashboardScene | undefined) {
  useEffect(() => {
    if (!dashboard) {
      return;
    }

    const sub = dashboard.subscribeToEvent(PromotePanelAdHocChangesEvent, ({ payload: { panel } }) => {
      const spec = promoteAdHocChanges(panel);
      if (!spec) {
        return;
      }

      const panelKey = panel.state.key;
      const adHocTransformations = panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER);

      // Enter edit mode before changing anything, so discarding the edit restores the saved dashboard.
      const wasEditing = dashboard.state.isEditing;
      if (!wasEditing) {
        dashboard.onEnterEditMode('user', 'panel_menu');
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

          // Restoring the dashboard can rebuild the panel, so find the one now in the dashboard.
          findVizPanelByKey(dashboard, panelKey)
            ?.getRuntimeTransformations()
            .set(TABLE_TRANSFORMATIONS_OWNER, adHocTransformations);
        },
      });
    });

    return () => sub.unsubscribe();
  }, [dashboard]);
}

function undoPromotion(dashboard: DashboardScene) {
  const { sidebar } = dashboard.state;
  if (sidebar.state.undoStack.at(-1)?.meta.scope === PROMOTION_SCOPE) {
    sidebar.undoAction();
  }
}
