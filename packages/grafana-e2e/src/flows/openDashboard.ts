import { Pages } from '../pages';

export const openDashboard = (dashboardTitle: string) => {
  Pages.Dashboards.visit();
  Pages.Dashboards.dashboards(dashboardTitle).click();
};
