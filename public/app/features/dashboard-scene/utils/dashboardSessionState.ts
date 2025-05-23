import { UrlQueryMap, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { DashboardScene } from '../scene/DashboardScene';

export const PRESERVED_SCENE_STATE_KEY = `grafana.dashboard.preservedUrlFiltersState`;

// TODO - deal with all this complexity, more details here https://github.com/grafana/grafana/pull/104780
export function restoreDashboardStateFromLocalStorage(dashboard: DashboardScene) {
  const preservedUrlState = window.sessionStorage.getItem(PRESERVED_SCENE_STATE_KEY);

  if (preservedUrlState) {
    const preservedQueryParams = new URLSearchParams(preservedUrlState);
    const currentQueryParams = locationService.getSearch();
    const cleanedQueryParams = new URLSearchParams();

    // iterate over preserved query params and append them to current query params if they don't already exist
    preservedQueryParams.forEach((value, key) => {
      // if somehow there are keys set with no values, we append new key-value pairs,
      // but need to clean empty ones after this loop so we don't lose any values
      if (!currentQueryParams.has(key) || currentQueryParams.get(key) === '') {
        currentQueryParams.append(key, value);
      }
    });

    // remove empty values
    currentQueryParams.forEach((value, key) => {
      if (value !== '') {
        cleanedQueryParams.append(key, value);
      }
    });

    for (const key of Array.from(cleanedQueryParams.keys())) {
      // preserve non-variable query params, i.e. time range
      if (!key.startsWith('var-')) {
        continue;
      }

      // remove params for variables that are not present on the target dashboard
      if (!dashboard.state.$variables?.getByName(key.replace('var-', ''))) {
        cleanedQueryParams.delete(key);
      }
    }

    const finalParams = cleanedQueryParams.toString();
    if (finalParams) {
      locationService.replace({ search: finalParams });
    }
  }
}

/**
 * Scenes behavior that will capture currently selected variables and time range and save them to local storage, so that they can be applied when the next dashboard is loaded.
 */
export function preserveDashboardSceneStateInLocalStorage(search: URLSearchParams, uid?: string) {
  if (!config.featureToggles.preserveDashboardStateWhenNavigating) {
    return;
  }

  // Skipping saving state for default home dashboard
  if (!uid) {
    return;
  }

  const queryParams: Record<string, string> = {};
  search.forEach((value, key) => {
    queryParams[key] = value;
  });

  const urlStates: UrlQueryMap = Object.fromEntries(
    Object.entries(queryParams).filter(
      ([key]) => key.startsWith('var-') || key === 'from' || key === 'to' || key === 'timezone'
    )
  );

  const nonEmptyUrlStates = Object.fromEntries(
    Object.entries(urlStates).filter(([key, value]) => !(Array.isArray(value) && value.length === 0))
  );

  // If there's anything to preserve, save it to local storage
  if (Object.keys(nonEmptyUrlStates).length > 0) {
    window.sessionStorage.setItem(PRESERVED_SCENE_STATE_KEY, urlUtil.renderUrl('', nonEmptyUrlStates));
  } else {
    window.sessionStorage.removeItem(PRESERVED_SCENE_STATE_KEY);
  }
}
