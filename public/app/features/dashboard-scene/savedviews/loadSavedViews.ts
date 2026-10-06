import { locationService } from '@grafana/runtime';
import { getStatusFromError } from 'app/core/utils/errors';

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
 * logged and swallowed rather than blocking or breaking dashboard load -- but the boolean return
 * lets `SavedViewsPane` tell "still loading" apart from "failed" (see its own effect), so a
 * transient failure doesn't leave the pane showing a loading spinner forever with no way to retry.
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
  if (!defaultViewName || !isStillOnDashboard(uid)) {
    return;
  }

  // The URL may have gained an explicit ?viewFilter= while that lookup was in flight.
  if (typeof locationService.getSearchObject().viewFilter === 'string') {
    return;
  }

  let view;
  try {
    view = await savedDashboardViewsApi.get(defaultViewName);
  } catch (err) {
    // Only self-heal on a TERMINAL failure -- the view is genuinely gone (404) or no longer
    // accessible (403/401). A transient network error, timeout, or server-side 5xx doesn't mean
    // that; clearing the stored preference on one of those would cause silent, permanent
    // preference loss from what's actually a one-off blip.
    const status = getStatusFromError(err);
    if (status === 404 || status === 401 || status === 403) {
      setDefaultSavedView(uid, undefined).catch(() => {});
    }
    return;
  }

  // The dashboard this default was captured for isn't necessarily the one currently loading
  // anymore: if the viewer navigated away to a different dashboard while any of the above awaits
  // were in flight, writing viewFilter now would apply THIS dashboard's default onto THAT one.
  if (typeof locationService.getSearchObject().viewFilter === 'string' || !isStillOnDashboard(uid)) {
    return;
  }

  // Initialization, not a real user navigation -- replace rather than push, or the viewer's first
  // Back press would land on the no-viewFilter version of this same dashboard instead of wherever
  // they actually came from.
  locationService.partial({ viewFilter: view.metadata.name }, true);
}

/**
 * Best-effort staleness guard, not a full cancellation-token system: dashboard urls are
 * "/d/<uid>/...", so this is enough to catch the common case (a fast navigation to a different
 * dashboard while this function's own awaits are still in flight) without needing to thread a
 * cancellation signal through every caller.
 */
function isStillOnDashboard(uid: string): boolean {
  return locationService.getLocation().pathname.includes(`/d/${uid}`);
}
