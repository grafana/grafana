import { e2e } from '../index';

// @todo remove this, as it's a page change and not a flow
export const openDashboard = (dashboardUid: string) => {
  e2e.pages.Dashboard.visit(dashboardUid);
};
