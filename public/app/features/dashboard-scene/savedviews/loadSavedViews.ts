import { type DashboardScene } from '../scene/DashboardScene';

import { savedDashboardViewsApi } from './api';

/**
 * Fetches the dashboard's Saved Views and attaches them to `dashboard.state.savedViews`.
 *
 * Called from two places, for two different reasons:
 * - Eagerly, awaited inside the state manager's `loadScene`, but ONLY when the URL already has
 *   `?viewFilter=<name>` — that's the one case where the fetch must complete BEFORE the scene is
 *   handed off to be mounted: `DashboardSceneUrlSync` looks up `?viewFilter=` against
 *   `state.savedViews` synchronously, during the scene tree's one synchronous URL-sync pass, so
 *   populating it any later would be too late for that lookup to work on a cold load (see the
 *   implementation spec, section 4.6). Gating on the URL param means dashboards loaded without one
 *   — the vast majority — never pay for this fetch at load time at all.
 * - Lazily, from `SavedViewsPane`'s own mount, for the "browse/manage views without a
 *   `?viewFilter=` link" case — matching this sidebar's existing lazy-pane-content convention
 *   (Filters, Code, Add panes all fetch/build their content on open, not on dashboard load).
 *
 * Saved Views are additive UI, not required to view or edit the dashboard, so a failure here is
 * logged and swallowed rather than blocking or breaking dashboard load.
 */
export async function loadSavedViews(dashboard: DashboardScene): Promise<void> {
  const uid = dashboard.state.uid;
  if (!uid) {
    return;
  }

  try {
    const savedViews = await savedDashboardViewsApi.listForDashboard(uid);
    dashboard.setState({ savedViews });
  } catch (err) {
    console.error('Failed to load saved views for dashboard', uid, err);
  }
}
