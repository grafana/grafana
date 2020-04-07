import { e2e } from '../index';

export const openDashboard = (dashboardUid: string) => {
  e2e.pages.Dashboard.visit(dashboardUid);
};
