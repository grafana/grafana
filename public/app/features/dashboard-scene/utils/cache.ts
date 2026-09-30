export async function clearDashboardsPageCache(dashboardUids: string[]): Promise<void> {
  const { getDashboardScenePageStateManager } = await import('../pages/DashboardScenePageStateManager');
  const pageStateManager = getDashboardScenePageStateManager();

  pageStateManager.clearDashboardCache();

  for (const uid of dashboardUids) {
    pageStateManager.removeSceneCache(uid);
  }
}
