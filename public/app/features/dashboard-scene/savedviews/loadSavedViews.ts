import { locationService } from '@grafana/runtime';
import { getStatusFromError } from 'app/core/utils/errors';

import { type DashboardScene } from '../scene/DashboardScene';

import { savedDashboardViewsApi } from './api';
import { getDefaultSavedView, setDefaultSavedView } from './defaultView';

/**
 * Fetches the dashboard's saved views into `dashboard.state.savedViews`.
 *
 * Awaited during scene load only for ?viewFilter= links (including one written by a stored default),
 * since URL sync resolves that param synchronously; otherwise the pane fetches lazily on open.
 * Failures are logged, not thrown, and the boolean return lets the pane show a retry instead of
 * loading forever.
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
 * Writes the viewer's default view into `?viewFilter=` before the scene mounts, when the URL names
 * none. Writing the URL rather than applying state matters: URL sync would revert state applied
 * before mount, while a `?viewFilter=` param goes through the normal link handling.
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
    // Only clear the default when the view is gone or inaccessible, not on transient errors.
    const status = getStatusFromError(err);
    if (status === 404 || status === 401 || status === 403) {
      setDefaultSavedView(uid, undefined).catch(() => {});
    }
    return;
  }

  // The viewer may have navigated to another dashboard while this was awaiting.
  if (typeof locationService.getSearchObject().viewFilter === 'string' || !isStillOnDashboard(uid)) {
    return;
  }

  // Replace, not push, so Back doesn't land on this same dashboard without the view.
  locationService.partial({ viewFilter: view.metadata.name }, true);
}

/**
 * Best-effort staleness check against the "/d/<uid>/..." URL, rather than full cancellation.
 */
function isStillOnDashboard(uid: string): boolean {
  // Exact segment match: a substring check would treat /d/web-prod/... as still being on `web`.
  const segments = locationService.getLocation().pathname.split('/');
  const index = segments.indexOf('d');
  return index !== -1 && segments[index + 1] === uid;
}
