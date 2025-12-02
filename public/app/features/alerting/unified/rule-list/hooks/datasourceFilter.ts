import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { RulesFilter } from '../../search/rulesSearchParser';

import { normalizeFilterState } from './filterNormalization';
import {
  GroupFilterConfig,
  RuleFilterConfig,
  contactPointFilter,
  dashboardUidFilter,
  dataSourceNamesFilter,
  freeFormFilter,
  groupMatches,
  groupNameFilter,
  labelsFilter,
  namespaceFilter,
  pluginsFilter,
  ruleHealthFilter,
  ruleMatches,
  ruleNameFilter,
  ruleStateFilter,
  ruleTypeFilter,
} from './filterPredicates';

/**
 * Determines if client-side filtering is needed for data source-managed rules.
 */
export function hasDatasourceClientSideFilters(filterState: Partial<RulesFilter>): boolean {
  // Check if any filter that applies to datasource rules is active
  return (
    (filterState.freeFormWords && filterState.freeFormWords.length > 0) ||
    Boolean(filterState.ruleName) ||
    Boolean(filterState.ruleState) ||
    Boolean(filterState.ruleType) ||
    (filterState.dataSourceNames && filterState.dataSourceNames.length > 0) ||
    (filterState.labels && filterState.labels.length > 0) ||
    Boolean(filterState.ruleHealth) ||
    Boolean(filterState.dashboardUid) ||
    Boolean(filterState.plugins) ||
    Boolean(filterState.contactPoint) ||
    Boolean(filterState.namespace) ||
    Boolean(filterState.groupName)
  );
}

/**
 * Builds filter configurations for data source-managed alert rules.
 *
 * Constructs filter objects for both rules and groups that are managed by data sources.
 * All filters are applied on the client-side for data source rules.
 */
export function getDatasourceFilter(filterState: RulesFilter) {
  const normalizedFilterState = normalizeFilterState(filterState);

  const dsRuleFilterConfig: RuleFilterConfig = {
    freeFormWords: freeFormFilter,
    ruleName: ruleNameFilter,
    ruleState: ruleStateFilter,
    ruleType: ruleTypeFilter,
    dataSourceNames: dataSourceNamesFilter,
    labels: labelsFilter,
    ruleHealth: ruleHealthFilter,
    dashboardUid: dashboardUidFilter,
    plugins: pluginsFilter,
    contactPoint: contactPointFilter,
  };

  const dsGroupFilterConfig: GroupFilterConfig = {
    namespace: namespaceFilter,
    groupName: groupNameFilter,
  };

  return {
    groupMatches: (group: PromRuleGroupDTO) => groupMatches(group, normalizedFilterState, dsGroupFilterConfig),
    ruleMatches: (rule: PromRuleDTO) => ruleMatches(rule, normalizedFilterState, dsRuleFilterConfig),
  };
}
