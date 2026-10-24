import { useEffect } from 'react';

import { t } from '@grafana/i18n';

import { applyDashboardSpec } from '../../../actions/dashboard/applyDashboardSpec';
import { type DashboardScene } from '../../DashboardScene';

import { promoteAdHocChanges } from './promoteAdHocChanges';
import { PromotePanelAdHocChangesEvent } from './utils';

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
        scope: 'panel-adhoc-changes',
      });

      dashboard.openSaveDrawer({
        // Saving keeps the dashboard in edit mode, so return to view mode when that is where the user started.
        onSaveSuccess: wasEditing
          ? undefined
          : () => dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: false }),
      });
    });

    return () => sub.unsubscribe();
  }, [dashboard]);
}
