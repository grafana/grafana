import { locationService } from '@grafana/runtime';

import { type DashboardScene } from '../scene/DashboardScene';

import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { applySavedViewState } from './state';

export const VIEW_FILTER_URL_KEY = 'viewFilter';

/** `?viewFilter=<name>` names a SavedDashboardView by its own resource name (metadata.name),
 * fetched directly rather than requiring the full per-dashboard list to already be loaded. */
export function getViewFilterFromUrl(): string | undefined {
  const value = locationService.getSearchObject()[VIEW_FILTER_URL_KEY];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Applies the Saved View named by `?viewFilter=` onto the dashboard, if present, as a *default* —
 * callers that also apply explicit `var-*`/`from`/`to` URL params on top are what makes it a
 * default rather than an override (spec 4.6). Returns the applied view, or undefined if there was
 * no `viewFilter` param or it didn't resolve to a real view.
 *
 * Not wired into DashboardScene's load/activation yet: doing that safely means fetching before the
 * scene's own URL sync pass runs (so the ordering above holds), which belongs with the drawer UI
 * in the next PR — that UI needs the same per-dashboard fetch anyway. Call this directly until then.
 */
export async function applyViewFilterFromUrl(dashboard: DashboardScene): Promise<SavedDashboardView | undefined> {
  const name = getViewFilterFromUrl();
  if (!name) {
    return undefined;
  }

  const view = await savedDashboardViewsApi.get(name);
  applySavedViewState(dashboard, view.spec);
  return view;
}
