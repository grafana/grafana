import { e2e } from '../index';

export const openDashboard = (uid: string) => {
  e2e.pages.Dashboard.visit(uid);
};
