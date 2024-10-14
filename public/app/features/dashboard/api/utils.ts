import { fromPairs, sortBy, toPairs } from 'lodash';

import { UrlQueryMap } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { getSelectedScopesNames } from 'app/features/scopes';

export function getScopes(sorted = false): string[] | undefined {
  const {
    featureToggles: { passReloadParamsToDashboardApi },
  } = config;

  if (!passReloadParamsToDashboardApi) {
    return undefined;
  }

  if (!sorted) {
    return getSelectedScopesNames();
  }

  return getSelectedScopesNames().sort();
}

export function getTimeRangeAndFilters(sorted = false): UrlQueryMap | undefined {
  const {
    featureToggles: { passReloadParamsToDashboardApi },
  } = config;

  if (!passReloadParamsToDashboardApi) {
    return undefined;
  }

  const queryParams = Object.entries(locationService.getSearchObject()).reduce<UrlQueryMap>((acc, [key, value]) => {
    if (
      passReloadParamsToDashboardApi &&
      (key === 'from' || key === 'to' || key === 'timezone' || key.startsWith('var-'))
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
