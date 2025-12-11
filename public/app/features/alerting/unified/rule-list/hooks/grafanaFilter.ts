import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { GrafanaPromRulesOptions } from '../../api/prometheusApi';
import { shouldUseBackendFilters, shouldUseFullyCompatibleBackendFilters } from '../../featureToggles';
import { RulesFilter } from '../../search/rulesSearchParser';

import { buildTitleSearch, normalizeFilterState } from './filterNormalization';
import {
  GroupFilterConfig,
  RuleFilterConfig,
  dashboardUidFilter,
  dataSourceNamesFilter,
  freeFormFilter,
  groupMatches,
  groupNameFilter,
  labelsFilter,
  mapDataSourceNamesToUids,
  namespaceFilter,
  pluginsFilter,
  ruleMatches,
  ruleNameFilter,
  ruleTypeFilter,
} from './filterPredicates';

/**
 * Determines if client-side filtering is needed for Grafana-managed rules.
 */
export function hasGrafanaClientSideFilters(filterState: Partial<RulesFilter>): boolean {
  const { ruleFilterConfig, groupFilterConfig } = buildGrafanaFilterConfigs();

  // Check each rule filter: if the config has a non-null handler AND the filter state has a value, we need client-side filtering
  const hasActiveRuleFilters =
    (ruleFilterConfig.freeFormWords !== null && Boolean(filterState?.freeFormWords?.length)) ||
    (ruleFilterConfig.ruleName !== null && Boolean(filterState?.ruleName)) ||
    (ruleFilterConfig.ruleState !== null && Boolean(filterState?.ruleState)) ||
    (ruleFilterConfig.ruleType !== null && Boolean(filterState?.ruleType)) ||
    (ruleFilterConfig.dataSourceNames !== null && Boolean(filterState?.dataSourceNames?.length)) ||
    (ruleFilterConfig.labels !== null && Boolean(filterState?.labels?.length)) ||
    (ruleFilterConfig.ruleHealth !== null && Boolean(filterState?.ruleHealth)) ||
    (ruleFilterConfig.dashboardUid !== null && Boolean(filterState?.dashboardUid)) ||
    (ruleFilterConfig.plugins !== null && Boolean(filterState?.plugins)) ||
    (ruleFilterConfig.contactPoint !== null && Boolean(filterState?.contactPoint));

  // Check each group filter: if the config has a non-null handler AND the filter state has a value, we need client-side filtering
  const hasActiveGroupFilters =
    (groupFilterConfig.namespace !== null && Boolean(filterState?.namespace)) ||
    (groupFilterConfig.groupName !== null && Boolean(filterState?.groupName));

  return hasActiveRuleFilters || hasActiveGroupFilters;
}

/**
 * Builds a combined filter configuration for Grafana-managed alert rules.
 *
 * Constructs both backend and frontend filter objects based on the provided filter state.
 * The backend filter is used for server-side filtering when `shouldUseBackendFilters()` is enabled,
 * while the frontend filter provides client-side matching functions for rules and groups.
 */
export function getGrafanaFilter(filterState: Partial<RulesFilter>) {
  const normalizedFilterState = normalizeFilterState(filterState);

  const { ruleFilterConfig, groupFilterConfig } = buildGrafanaFilterConfigs();

  // Build title search for backend filtering
  const titleSearch = buildTitleSearch(normalizedFilterState);

  // Check if data source names were provided but none are valid.
  let hasInvalidDataSourceNames = false;
  let datasourceUids: string[] | undefined = undefined;

  // Only map datasources if data source filter should be applied on backend (when ruleFilterConfig.dataSourceNames is null).
  if (ruleFilterConfig.dataSourceNames === null && normalizedFilterState.dataSourceNames.length > 0) {
    datasourceUids = mapDataSourceNamesToUids(normalizedFilterState.dataSourceNames);
    // If names were provided but no valid UIDs were found, all names are invalid.
    hasInvalidDataSourceNames = datasourceUids.length === 0;
  }

  const backendFilter: GrafanaPromRulesOptions = {
    state: normalizedFilterState.ruleState ? [normalizedFilterState.ruleState] : [],
    health: normalizedFilterState.ruleHealth ? [normalizedFilterState.ruleHealth] : [],
    contactPoint: normalizedFilterState.contactPoint ?? undefined,
    // If FE filter is defined, don't include the backend filter
    title: ruleFilterConfig.ruleName ? undefined : titleSearch,
    type: ruleFilterConfig.ruleType ? undefined : normalizedFilterState.ruleType,
    dashboardUid: ruleFilterConfig.dashboardUid ? undefined : normalizedFilterState.dashboardUid,
    searchGroupName: groupFilterConfig.groupName ? undefined : normalizedFilterState.groupName,
    datasources: ruleFilterConfig.dataSourceNames ? undefined : datasourceUids,
  };

  return {
    backendFilter,
    frontendFilter: {
      groupMatches: (group: PromRuleGroupDTO) => groupMatches(group, normalizedFilterState, groupFilterConfig),
      ruleMatches: (rule: PromRuleDTO) => ruleMatches(rule, normalizedFilterState, ruleFilterConfig),
    },
    hasInvalidDataSourceNames,
  };
}

/**
 * Builds filter configurations for Grafana rules and groups.
 *
 * Determines which filters are applied on the backend vs. client-side based on
 * the `shouldUseBackendFilters()` flag. When backend filtering is enabled, certain
 * filters are set to null to prevent duplicate filtering.
 */
function buildGrafanaFilterConfigs() {
  const useBackendFilters = shouldUseBackendFilters();
  const useFullyCompatibleBackendFilters = shouldUseFullyCompatibleBackendFilters();

  const ruleFilterConfig: RuleFilterConfig = {
    // When backend filtering is enabled, these filters are handled by the backend
    freeFormWords: useBackendFilters ? null : freeFormFilter,
    ruleName: useBackendFilters ? null : ruleNameFilter,
    ruleState: null,
    ruleType: useBackendFilters || useFullyCompatibleBackendFilters ? null : ruleTypeFilter,
    dataSourceNames: useBackendFilters || useFullyCompatibleBackendFilters ? null : dataSourceNamesFilter,
    labels: labelsFilter,
    ruleHealth: null,
    dashboardUid: useBackendFilters || useFullyCompatibleBackendFilters ? null : dashboardUidFilter,
    plugins: pluginsFilter,
    contactPoint: null,
  };

  const groupFilterConfig: GroupFilterConfig = {
    namespace: namespaceFilter,
    groupName: useBackendFilters ? null : groupNameFilter,
  };

  return { ruleFilterConfig, groupFilterConfig };
}
