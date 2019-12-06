import { e2e } from '../index';

export const openDashboard = (dashboardTitle: string) => {
  e2e.pages.Dashboards.visit();
  e2e.pages.Dashboards.dashboards(dashboardTitle).click();
};
