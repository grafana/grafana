import { e2e } from '../index';

export const saveNewDashboard = () => {
  e2e.pages.Dashboard.Toolbar.toolbarItems('Save dashboard').click();

  const dashboardTitle = `e2e-${Date.now()}`;
  e2e.pages.SaveDashboardAsModal.newName().clear();
  e2e.pages.SaveDashboardAsModal.newName().type(dashboardTitle);
  e2e.pages.SaveDashboardAsModal.save().click();

  e2e.flows.assertSuccessNotification();

  return dashboardTitle;
};
