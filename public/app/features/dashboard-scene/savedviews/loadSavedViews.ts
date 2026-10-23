import { type DashboardScene } from '../scene/DashboardScene';

import { savedDashboardViewsApi } from './api';

/**
 * Fetches the dashboard's saved views into `dashboard.state.savedViews`.
 *
 * Awaited during scene load only for ?viewFilter= links, since URL sync resolves that param
 * synchronously; otherwise the pane fetches lazily on open. Failures are logged, not thrown, and
 * the boolean return lets the pane show a retry instead of loading forever.
 */
export async function loadSavedViews(dashboard: DashboardScene): Promise<boolean> {
  const uid = dashboard.state.uid;
  if (!uid) {
    return true;
  }

  try {
    const savedViews = await savedDashboardViewsApi.listForDashboard(uid);
    dashboard.setState({ savedViews });
    return true;
  } catch (err) {
    console.error('Failed to load saved views for dashboard', uid, err);
    return false;
  }
}
