import { e2e } from '../../index';

export const saveDashboard = () => {
  e2e.components.NavToolbar.editDashboard.saveButton().click();

  e2e.components.Drawer.DashboardSaveDrawer.saveButton().click();
  e2e.flows.assertSuccessNotification();
};
