import appEvents from 'app/core/app_events';
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';

export const removePanel = (dashboard: DashboardModel, panel: PanelModel, ask: boolean) => {
  // confirm deletion
  if (ask !== false) {
    const text2 = panel.alert ? 'Panel includes an alert rule, removing panel will also remove alert rule' : null;
    const confirmText = panel.alert ? 'YES' : null;

    appEvents.emit('confirm-modal', {
      title: 'Remove Panel',
      text: 'Are you sure you want to remove this panel?',
      text2: text2,
      icon: 'fa-trash',
      confirmText: confirmText,
      yesText: 'Remove',
      onConfirm: () => removePanel(dashboard, panel, false),
    });
    return;
  }
  dashboard.removePanel(panel);
};

export default {
  removePanel,
};
