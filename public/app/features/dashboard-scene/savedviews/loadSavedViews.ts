import { locationService } from '@grafana/runtime';

import { type DashboardScene } from '../scene/DashboardScene';

import { savedDashboardViewsApi } from './api';
import { getDefaultSavedView, setDefaultSavedView } from './defaultView';

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
 *   — the vast majority — never pay for this fetch at load time at all. `applyDefaultSavedViewToUrl`
 *   (below) runs immediately before this check in `loadScene`, so a stored per-user default also
 *   satisfies this gate once it writes `viewFilter` into the URL.
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

/**
 * Writes `?viewFilter=<default>` into the URL, before the scene mounts, when the viewer has a
 * per-user default saved view for this dashboard (spec 2.1.1 stretch: "each user can mark one
 * view as their default... applied automatically on open") and the URL doesn't already name one.
 *
 * Deliberately writes the URL rather than applying the view's state directly: on mount, the
 * scene's own url-sync pass always treats the current URL as authoritative for $timeRange and
 * every variable, so anything applied here beforehand would just be reverted moments later by
 * that pass reconciling against a URL that doesn't yet reflect it. Writing `viewFilter` into the
 * URL first makes a default indistinguishable, timing-wise, from a real `?viewFilter=` link, and
 * lets the already-correct, already-tested explicit-viewFilter handling in
 * `DashboardSceneUrlSync.updateFromUrl` do the rest.
 */
export async function applyDefaultSavedViewToUrl(dashboard: DashboardScene): Promise<void> {
  if (typeof locationService.getSearchObject().viewFilter === 'string') {
    return;
  }

  const uid = dashboard.state.uid;
  if (!uid) {
    return;
  }

  const defaultViewName = await getDefaultSavedView(uid);
  if (!defaultViewName) {
    return;
  }

  // The URL may have gained an explicit ?viewFilter= while that lookup was in flight.
  if (typeof locationService.getSearchObject().viewFilter === 'string') {
    return;
  }

  try {
    await savedDashboardViewsApi.get(defaultViewName);
  } catch {
    // The stored default points at a view that's gone (deleted) or no longer accessible
    // (permissions changed) -- self-heal so this dashboard doesn't keep paying for a fetch that
    // will never succeed, and so a dead name never lands in the URL.
    setDefaultSavedView(uid, undefined).catch(() => {});
    return;
  }

  if (typeof locationService.getSearchObject().viewFilter === 'string') {
    return;
  }

  locationService.partial({ viewFilter: defaultViewName });
}
