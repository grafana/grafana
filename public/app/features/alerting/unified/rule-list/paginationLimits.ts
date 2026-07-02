import { type RulesFilter } from '../search/rulesSearchParser';

import { hasDatasourceClientSideFilters } from './hooks/datasourceFilter';
import { hasGrafanaClientSideFilters } from './hooks/grafanaFilter';
import { type FetchGroupsLimitOptions } from './hooks/prometheusGroupsGenerator';

export const FRONTEND_LIST_PAGE_SIZE = 100;

export const FILTERED_GROUPS_LARGE_API_PAGE_SIZE = 2000;
export const FILTERED_GROUPS_SMALL_API_PAGE_SIZE = 100;

const DEFAULT_GROUPS_API_PAGE_SIZE = 40;
export const FRONTED_GROUPED_PAGE_SIZE = DEFAULT_GROUPS_API_PAGE_SIZE;

export const RULE_LIMIT_WITH_BACKEND_FILTERS = 100;

export function getApiGroupPageSize(hasFilters: boolean) {
  return hasFilters ? FILTERED_GROUPS_LARGE_API_PAGE_SIZE : DEFAULT_GROUPS_API_PAGE_SIZE;
}

function getSearchApiGroupPageSize(hasFrontendFilters: boolean) {
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
  if (!hasGrafanaClientSideFilters(filterState)) {
    return { ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS };
  }

  return { groupLimit: getSearchApiGroupPageSize(true) };
}
