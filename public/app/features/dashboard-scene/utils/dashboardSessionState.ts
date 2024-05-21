import { UrlQueryMap, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import store from 'app/core/store';

import { DashboardScene } from '../scene/DashboardScene';

export function getPreservedSceneURLStateKey() {
  return `grafana.dashboard.preservedUrlFiltersState[${window.name}]`;
}

export function restoreDashboardStateFromLocalStorage(dashboard: DashboardScene) {
  const preservedUrlState = store.get(getPreservedSceneURLStateKey());
  if (preservedUrlState) {
    const preservedUrlStateJSON = preservedUrlState ? JSON.parse(preservedUrlState) : {};

    let preservedQueryParams: UrlQueryMap = {};

    for (const [key, value] of Object.entries(preservedUrlStateJSON)) {
      // restore non-variable query params
      if (!key.startsWith('var-')) {
        preservedQueryParams[key] = value as any;
        continue;
      }
      // restore variable query params if a variable exists in the target dashboard
      if (dashboard.state.$variables?.getByName(key.replace('var-', ''))) {
        preservedQueryParams[key] = value as any;
      }
    }

    const currentQueryParams = locationService.getLocation().search;
    let nextQueryParams = currentQueryParams;
    if (currentQueryParams) {
      nextQueryParams += '&' + urlUtil.renderUrl('', preservedQueryParams).slice(1);
    } else {
      nextQueryParams = urlUtil.renderUrl('', preservedQueryParams);
    }

    const deduplicatedQueryParams = deduplicateQueryParams(nextQueryParams);

    if (deduplicatedQueryParams) {
      locationService.replace({
        search: deduplicatedQueryParams,
      });
    }
  }
}

/**
 * Behavior that will capture currently selected variables and time range and save them to local storage, so that they can be applied when the next dashboard is loaded.
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
      store.set(getPreservedSceneURLStateKey(), JSON.stringify(nonEmptyUrlStates));
    } else {
      store.delete(getPreservedSceneURLStateKey());
    }
  };
}

function deduplicateQueryParams(queryParams: string): string {
  const seen: { [key: string]: Set<string> } = {};
  const params = new URLSearchParams(queryParams);
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

  return deduplicatedParams.toString();
}
