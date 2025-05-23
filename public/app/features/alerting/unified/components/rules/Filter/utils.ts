import { RulesFilter } from '../../../search/rulesSearchParser';

import { AdvancedFilters } from './RulesFilter.v2';

export function formAdvancedFiltersToRuleFilter(values: AdvancedFilters): RulesFilter {
  return {
    freeFormWords: [],
    ...values,
    ruleHealth: values.ruleHealth === '*' ? undefined : values.ruleHealth,
    ruleState: values.ruleState === '*' ? undefined : values.ruleState,
    ruleType: values.ruleType === '*' ? undefined : values.ruleType,
    plugins: values.plugins === 'show' ? undefined : 'hide',
  };
}

export const emptyAdvancedFilters: AdvancedFilters = {
  namespace: undefined,
  groupName: undefined,
  ruleName: undefined,
  ruleType: '*',
  ruleState: '*', // "*" means any state
  dataSourceNames: [],
  labels: [],
  ruleHealth: '*',
  dashboardUid: undefined,
  // @TODO add support to hide / show only certain plugins
  plugins: 'show',
  contactPoint: undefined,
};

export function searchQueryToDefaultValues(filterState: RulesFilter): AdvancedFilters {
  return {
    namespace: filterState.namespace,
    groupName: filterState.groupName,
    ruleName: filterState.ruleName,
    ruleType: filterState.ruleType ?? '*',
    ruleState: filterState.ruleState ?? '*', // "*" means any state
    dataSourceNames: filterState.dataSourceNames,
    labels: filterState.labels,
    ruleHealth: filterState.ruleHealth ?? '*',
    dashboardUid: filterState.dashboardUid,
    // @TODO add support to hide / show only certain plugins
    plugins: filterState.plugins ?? 'show',
    contactPoint: filterState.contactPoint,
  };
}
