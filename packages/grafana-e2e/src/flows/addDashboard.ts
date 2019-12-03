import { Pages } from '../pages';
import { Flows } from './index';

export const addDashboard = (): string => {
  Pages.AddDashboard.visit();

  Pages.Dashboard.save().click();

  const dashboardTitle = `e2e - DashBoard - ${new Date().getTime()}`;
  Pages.SaveAsModal.newName().clear();
  Pages.SaveAsModal.newName().type(dashboardTitle);
  Pages.SaveAsModal.save().click();

  Flows.assertSuccessNotification();

  return dashboardTitle;
};
