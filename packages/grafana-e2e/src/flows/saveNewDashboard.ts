import { Pages } from '../pages';
import { Flows } from './index';

export const saveNewDashboard = () => {
  Pages.Dashboard.toolbarItems('Save dashboard').click();

  const dashboardTitle = `e2e-${new Date().getTime()}`;
  Pages.SaveDashboardAsModal.newName().clear();
  Pages.SaveDashboardAsModal.newName().type(dashboardTitle);
  Pages.SaveDashboardAsModal.save().click();

  Flows.assertSuccessNotification();

  return dashboardTitle;
};
