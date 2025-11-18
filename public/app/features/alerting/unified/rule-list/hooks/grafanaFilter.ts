import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { GrafanaPromRulesOptions } from '../../api/prometheusApi';
import { shouldUseBackendFilters } from '../../featureToggles';
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
  namespaceFilter,
  pluginsFilter,
  ruleMatches,
  ruleNameFilter,
  ruleTypeFilter,
} from './filterPredicates';

/**
 * Determines if client-side filtering is needed for Grafana-managed rules.
 */
export function hasClientSideFilters(filterState: RulesFilter): boolean {
  const { ruleFilterConfig, groupFilterConfig } = buildGrafanaFilterConfigs();

  // Check each rule filter: if the config has a non-null handler AND the filter state has a value, we need client-side filtering
  const hasActiveRuleFilters =
    (ruleFilterConfig.freeFormWords !== null && filterState.freeFormWords.length > 0) ||
    (ruleFilterConfig.ruleName !== null && Boolean(filterState.ruleName)) ||
    (ruleFilterConfig.ruleState !== null && Boolean(filterState.ruleState)) ||
    (ruleFilterConfig.ruleType !== null && Boolean(filterState.ruleType)) ||
    (ruleFilterConfig.dataSourceNames !== null && filterState.dataSourceNames.length > 0) ||
    (ruleFilterConfig.labels !== null && filterState.labels.length > 0) ||
    (ruleFilterConfig.ruleHealth !== null && Boolean(filterState.ruleHealth)) ||
    (ruleFilterConfig.dashboardUid !== null && Boolean(filterState.dashboardUid)) ||
    (ruleFilterConfig.plugins !== null && Boolean(filterState.plugins)) ||
    (ruleFilterConfig.contactPoint !== null && Boolean(filterState.contactPoint));

  // Check each group filter: if the config has a non-null handler AND the filter state has a value, we need client-side filtering
  const hasActiveGroupFilters =
    (groupFilterConfig.namespace !== null && Boolean(filterState.namespace)) ||
    (groupFilterConfig.groupName !== null && Boolean(filterState.groupName));

  return hasActiveRuleFilters || hasActiveGroupFilters;
}

/**
 * Builds a combined filter configuration for Grafana-managed alert rules.
 *
 * Constructs both backend and frontend filter objects based on the provided filter state.
 * The backend filter is used for server-side filtering when `shouldUseBackendFilters()` is enabled,
 * while the frontend filter provides client-side matching functions for rules and groups.
 */
export function getGrafanaFilter(filterState: RulesFilter) {
  const normalizedFilterState = normalizeFilterState(filterState);
  const useBackendFilters = shouldUseBackendFilters();

  // Build title search for backend filtering
  const titleSearch = buildTitleSearch(normalizedFilterState);

  const backendFilter: GrafanaPromRulesOptions = {
    state: normalizedFilterState.ruleState ? [normalizedFilterState.ruleState] : [],
    health: normalizedFilterState.ruleHealth ? [normalizedFilterState.ruleHealth] : [],
    contactPoint: normalizedFilterState.contactPoint ?? undefined,
    title: useBackendFilters ? titleSearch : undefined,
    type: useBackendFilters ? normalizedFilterState.ruleType : undefined,
    dashboardUid: useBackendFilters ? normalizedFilterState.dashboardUid : undefined,
    searchGroupName: useBackendFilters ? normalizedFilterState.groupName : undefined,
  };

  const { ruleFilterConfig: grafanaFilterProcessingConfig, groupFilterConfig: grafanaGroupFilterConfig } =
    buildGrafanaFilterConfigs();

  return {
    backendFilter,
    frontendFilter: {
      groupMatches: (group: PromRuleGroupDTO) => groupMatches(group, normalizedFilterState, grafanaGroupFilterConfig),
      ruleMatches: (rule: PromRuleDTO) => ruleMatches(rule, normalizedFilterState, grafanaFilterProcessingConfig),
    },
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

  const ruleFilterConfig: RuleFilterConfig = {
    // When backend filtering is enabled, these filters are handled by the backend
    freeFormWords: useBackendFilters ? null : freeFormFilter,
    ruleName: useBackendFilters ? null : ruleNameFilter,
    ruleState: null,
    ruleType: useBackendFilters ? null : ruleTypeFilter,
    dataSourceNames: dataSourceNamesFilter,
    labels: labelsFilter,
    ruleHealth: null,
    dashboardUid: useBackendFilters ? null : dashboardUidFilter,
    plugins: pluginsFilter,
    contactPoint: null,
  };

  const groupFilterConfig: GroupFilterConfig = {
    namespace: namespaceFilter,
    groupName: useBackendFilters ? null : groupNameFilter,
  };

  return { ruleFilterConfig, groupFilterConfig };
}
