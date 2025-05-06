import { UrlQueryMap, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { UrlSyncManager } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

export const PRESERVED_SCENE_STATE_KEY = `grafana.dashboard.preservedUrlFiltersState`;

export function restoreDashboardStateFromLocalStorage(dashboard: DashboardScene) {
  if (!dashboard.state.version) {
    return;
  }

  const preservedUrlState = window.sessionStorage.getItem(PRESERVED_SCENE_STATE_KEY);

  if (preservedUrlState) {
    const preservedQueryParams = new URLSearchParams(preservedUrlState);
    const currentQueryParams = locationService.getSearch();

    // iterate over preserved query params and append them to current query params if they don't already exist
    preservedQueryParams.forEach((value, key) => {
      if (!currentQueryParams.has(key)) {
        currentQueryParams.append(key, value);
      }
    });

    for (const key of Array.from(currentQueryParams.keys())) {
      // preserve non-variable query params, i.e. time range
      if (!key.startsWith('var-')) {
        continue;
      }

      // remove params for variables that are not present on the target dashboard
      if (!dashboard.state.$variables?.getByName(key.replace('var-', ''))) {
        currentQueryParams.delete(key);
      }
    }

    const finalParams = currentQueryParams.toString();
    if (finalParams) {
      locationService.replace({ search: finalParams });
    }
  }
}

/**
 * Scenes behavior that will capture currently selected variables and time range and save them to local storage, so that they can be applied when the next dashboard is loaded.
 */
export function preserveDashboardSceneStateInLocalStorage(scene: DashboardScene) {
  if (!config.featureToggles.preserveDashboardStateWhenNavigating) {
    return;
  }

  return () => {
    // Skipping saving state for default home dashboard
    if (!scene.state.uid || !scene.state.version) {
      return;
    }

    const urlStates: UrlQueryMap = Object.fromEntries(
      Object.entries(new UrlSyncManager().getUrlState(scene)).filter(
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
  };
}
