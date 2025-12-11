import { shouldUseBackendFilters, shouldUseFullyCompatibleBackendFilters } from '../featureToggles';
import { RulesFilter } from '../search/rulesSearchParser';

import { hasDatasourceClientSideFilters } from './hooks/datasourceFilter';
import { hasGrafanaClientSideFilters } from './hooks/grafanaFilter';
import { FetchGroupsLimitOptions } from './hooks/prometheusGroupsGenerator';

export const FRONTEND_LIST_PAGE_SIZE = 100;

export const FILTERED_GROUPS_LARGE_API_PAGE_SIZE = 2000;
export const FILTERED_GROUPS_SMALL_API_PAGE_SIZE = 100;

export const DEFAULT_GROUPS_API_PAGE_SIZE = 40;
export const FRONTED_GROUPED_PAGE_SIZE = DEFAULT_GROUPS_API_PAGE_SIZE;

export const RULE_LIMIT_WITH_BACKEND_FILTERS = 100;

export function getApiGroupPageSize(hasFilters: boolean) {
  return hasFilters ? FILTERED_GROUPS_LARGE_API_PAGE_SIZE : DEFAULT_GROUPS_API_PAGE_SIZE;
}

export function getSearchApiGroupPageSize(hasFrontendFilters: boolean) {
  return hasFrontendFilters ? FILTERED_GROUPS_LARGE_API_PAGE_SIZE : FILTERED_GROUPS_SMALL_API_PAGE_SIZE;
}

export function getFilteredRulesLimits(filterState: RulesFilter): FetchGroupsLimitOptions {
  return {
    grafanaManagedLimit: getGrafanaFilterLimits(filterState),
    datasourceManagedLimit: {
      groupLimit: hasDatasourceClientSideFilters(filterState)
        ? FILTERED_GROUPS_LARGE_API_PAGE_SIZE
        : FILTERED_GROUPS_SMALL_API_PAGE_SIZE,
    },
  };
}

function getGrafanaFilterLimits(filterState: RulesFilter) {
  const backendFiltersEnabled = shouldUseFullyCompatibleBackendFilters() || shouldUseBackendFilters();

  const frontendFiltersInUse = hasGrafanaClientSideFilters(filterState);
  const onlyBackendFiltersInUse = frontendFiltersInUse === false;

  if (backendFiltersEnabled && onlyBackendFiltersInUse) {
    return { ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS };
  }

  return { groupLimit: getSearchApiGroupPageSize(frontendFiltersInUse) };
}
