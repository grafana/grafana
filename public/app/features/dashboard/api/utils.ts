import { fromPairs, sortBy, toPairs } from 'lodash';

import { UrlQueryMap } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { getSelectedScopesNames } from 'app/features/scopes';

export function getScopes(sorted = false): string[] | undefined {
  const {
    featureToggles: { passScopeToDashboardApi },
  } = config;

  if (!passScopeToDashboardApi) {
    return undefined;
  }

  if (!sorted) {
    return getSelectedScopesNames();
  }

  return getSelectedScopesNames().sort();
}

export function getTimeRangeAndFilters(sorted = false): UrlQueryMap | undefined {
  const {
    featureToggles: { passTimeRangeToDashboardApi, passFiltersToDashboardApi },
  } = config;

  if (!passTimeRangeToDashboardApi && !passFiltersToDashboardApi) {
    return undefined;
  }

  const queryParams = Object.entries(locationService.getSearchObject()).reduce<UrlQueryMap>((acc, [key, value]) => {
    if (
      (passTimeRangeToDashboardApi && (key === 'from' || key === 'to' || key === 'timezone')) ||
      (passFiltersToDashboardApi && key.startsWith('var-'))
    ) {
      acc[key] = sorted && Array.isArray(value) ? value.sort() : value;
    }

    return acc;
  }, {});

  if (!sorted) {
    return queryParams;
  }

  return fromPairs(sortBy(toPairs(queryParams), ([key]) => key));
}
