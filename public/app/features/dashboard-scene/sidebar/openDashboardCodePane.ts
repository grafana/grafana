import { type DashboardSidebarLike } from './types';

export async function openDashboardCodePane(sidebar: DashboardSidebarLike) {
  const { DashboardCodePane } = await import(
    /* webpackChunkName: "dashboard-code-pane" */ './DashboardCodePane'
  );

  sidebar.openPane(new DashboardCodePane({}));
}
