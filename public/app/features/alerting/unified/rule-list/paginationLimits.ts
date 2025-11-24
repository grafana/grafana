import { shouldUseBackendFilters } from '../featureToggles';
import { RulesFilter } from '../search/rulesSearchParser';

import { hasDatasourceFilters } from './hooks/datasourceFilter';
import { hasClientSideFilters } from './hooks/grafanaFilter';
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

export function getGrafanaFilterLimits(filterState: RulesFilter) {
  const hasCompatibleBackendFilters = shouldUseBackendFilters();

  const frontendFiltersInUse = hasClientSideFilters(filterState);
  const onlyBackendFiltersInUse = frontendFiltersInUse === false;

  if (hasCompatibleBackendFilters && onlyBackendFiltersInUse) {
    return { ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS };
  }

  return { groupLimit: getSearchApiGroupPageSize(frontendFiltersInUse) };
}

export function getFilteredRulesLimits(filterState: RulesFilter): FetchGroupsLimitOptions {
  return {
    gmaLimit: getGrafanaFilterLimits(filterState),
    dmaLimit: { groupLimit: getApiGroupPageSize(hasDatasourceFilters(filterState)) },
  };
}
