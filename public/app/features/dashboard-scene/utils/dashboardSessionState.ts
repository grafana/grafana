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
    // params that are not present in current query params, i.e. new params coming from a different dashboard
    const paramsToAppend = new URLSearchParams();

    // iterate over preserved query params and append them to the collection of params that need to be appended to the current query params
    preservedQueryParams.forEach((value, key) => {
      // if somehow there are keys set with no values, we append new key-value pairs,
      // but need to clean empty ones after this loop so we don't lose any values
      if (!currentQueryParams.has(key) || currentQueryParams.get(key) === '') {
        paramsToAppend.append(key, value);
      }
    });

    // remove empty values
    currentQueryParams.forEach((value, key) => {
      if (value !== '') {
        cleanedQueryParams.append(key, value);
      }
    });

    for (const [key, value] of paramsToAppend) {
      cleanedQueryParams.append(key, value);
    }

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
  // console.log('preserveDashboardSceneStateInLocalStorage', search.toString());

  // Skipping saving state for default home dashboard
  if (!uid) {
    return;
  }
  const queryParams: URLSearchParams = new URLSearchParams();

  let len = 0;
  for (const [key, value] of search) {
    // if hey starts with var- or is from, to or timezone it's fine, otherwise delete the entry from search
    if (key.startsWith('var-') || key === 'from' || key === 'to' || key === 'timezone') {
      // filter out empty array values
      if (Array.isArray(value) && value.length === 0) {
        continue;
      }
      queryParams.append(key, value);
      len++;
    }
  }

  if (len > 0) {
    window.sessionStorage.setItem(PRESERVED_SCENE_STATE_KEY, queryParams.toString());
  } else {
    window.sessionStorage.removeItem(PRESERVED_SCENE_STATE_KEY);
  }
}
