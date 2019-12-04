import { Pages } from '../pages';

export const openDashboard = (dashboardName: string) => {
  Pages.Dashboards.visit();
  Pages.Dashboards.dashboards()
    .contains(dashboardName)
    .click();
};
