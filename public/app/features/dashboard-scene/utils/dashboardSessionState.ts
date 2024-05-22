import { UrlQueryMap, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { UrlSyncManager } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

export function getPreservedSceneURLStateKey() {
  return `grafana.dashboard.preservedUrlFiltersState`;
}

export function restoreDashboardStateFromLocalStorage(dashboard: DashboardScene) {
  const preservedUrlState = window.sessionStorage.getItem(getPreservedSceneURLStateKey());

  if (preservedUrlState) {
    const preservedQueryParams = new URLSearchParams(preservedUrlState);
    const currentQueryParams = locationService.getSearch();

    // iterate over current query params and append them to preserved query params
    currentQueryParams.forEach((value, key) => {
      preservedQueryParams.append(key, value);
    });

    // remove duplicate query params
    const deduplicatedQueryParams = deduplicateQueryParams(preservedQueryParams);

    // iterate over deduplicatedQueryParams.keys() and log them
    for (const key of Array.from(deduplicatedQueryParams.keys())) {
      // preserve non-variable query params, i.e. time range
      if (!key.startsWith('var-')) {
        continue;
      }

      // remove params for variables that are not present on the target dashboard
      if (!dashboard.state.$variables?.getByName(key.replace('var-', ''))) {
        deduplicatedQueryParams.delete(key);
      }
    }

    const finalParams = deduplicatedQueryParams.toString();
    if (finalParams) {
      locationService.replace({
        search: finalParams,
      });
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
    if (!scene.state.uid) {
      return;
    }
    const variables = scene.state.$variables?.state.variables;
    const timeRange = scene.state.$timeRange;

    console.log(new UrlSyncManager().getUrlState(scene));
    let urlStates: UrlQueryMap = variables
      ? variables.reduce((acc, v) => {
          const urlState = v.urlSync?.getUrlState();
          return {
            ...acc,
            ...urlState,
          };
        }, {})
      : {};

    if (timeRange) {
      urlStates = {
        ...urlStates,
        ...timeRange.urlSync?.getUrlState(),
      };
    }

    const nonEmptyUrlStates = Object.fromEntries(
      Object.entries(urlStates).filter(([key, value]) => !(Array.isArray(value) && value.length === 0))
    );

    // If there's anything to preserve, save it to local storage
    if (Object.keys(nonEmptyUrlStates).length > 0) {
      window.sessionStorage.setItem(getPreservedSceneURLStateKey(), urlUtil.renderUrl('', nonEmptyUrlStates));
    } else {
      window.sessionStorage.removeItem(getPreservedSceneURLStateKey());
    }
  };
}

function deduplicateQueryParams(params: URLSearchParams): URLSearchParams {
  const seen: { [key: string]: Set<string> } = {};
  // Iterate over the query params and store unique values
  params.forEach((value, key) => {
    if (!seen[key]) {
      seen[key] = new Set();
    }
    seen[key].add(value);
  });

  // Construct a new URLSearchParams object with deduplicated parameters
  const deduplicatedParams = new URLSearchParams();
  for (const key in seen) {
    seen[key].forEach((value) => {
      deduplicatedParams.append(key, value);
    });
  }

  return deduplicatedParams;
}
