import { useAlertingHomePageExtensions } from '../../plugins/useAlertingHomePageExtensions';
import { type RulesFilter, buildRoutingFilter } from '../../search/rulesSearchParser';

import { type AdvancedFilters } from './types';

export function formAdvancedFiltersToRuleFilter(
  values: AdvancedFilters,
  existingFreeFormWords: string[] = []
): RulesFilter {
  return {
    freeFormWords: existingFreeFormWords,
    ruleName: values.ruleName || undefined,
    namespace: values.namespace || undefined,
    groupName: values.groupName || undefined,
    dataSourceNames: values.dataSourceNames ?? [],
    labels: values.labels ?? [],
    dashboardUid: values.dashboardUid || undefined,
    ruleHealth: values.ruleHealth === '*' ? undefined : values.ruleHealth,
    ruleState: values.ruleState === '*' ? undefined : values.ruleState,
    ruleType: values.ruleType === '*' ? undefined : values.ruleType,
    plugins: values.plugins === 'show' ? undefined : 'hide',
    ruleSource: values.ruleSource ?? undefined,
    ...buildRoutingFilter(values.contactPoint || undefined, values.policy || undefined),
  };
}

export const emptyAdvancedFilters: AdvancedFilters = {
  namespace: null,
  groupName: null,
  ruleName: '',
  ruleType: '*',
  ruleState: '*',
  dataSourceNames: [],
  labels: [],
  ruleHealth: '*',
  dashboardUid: undefined,
  plugins: 'show',
  contactPoint: null,
  ruleSource: null,
  policy: null,
};

export function advancedFiltersToRulesFilter(values: AdvancedFilters, freeFormWords: string[] = []): RulesFilter {
  return {
    freeFormWords,
    ruleName: values.ruleName || undefined,
    namespace: values.namespace || undefined,
    groupName: values.groupName || undefined,
    ruleType: values.ruleType === '*' ? undefined : values.ruleType,
    ruleState: values.ruleState === '*' ? undefined : values.ruleState,
    dataSourceNames: values.dataSourceNames ?? [],
    labels: values.labels ?? [],
    ruleHealth: values.ruleHealth === '*' ? undefined : values.ruleHealth,
    dashboardUid: values.dashboardUid || undefined,
    plugins: values.plugins === 'show' ? undefined : 'hide',
    ruleSource: values.ruleSource ?? undefined,
    ...buildRoutingFilter(values.contactPoint || undefined, values.policy || undefined),
  };
}

export function searchQueryToDefaultValues(filterState: RulesFilter): AdvancedFilters {
  return {
    namespace: filterState.namespace ?? null,
    groupName: filterState.groupName ?? null,
    ruleName: filterState.ruleName ?? '',
    ruleType: filterState.ruleType ?? '*',
    ruleState: filterState.ruleState ?? '*',
    dataSourceNames: filterState.dataSourceNames,
    labels: filterState.labels,
    ruleHealth: filterState.ruleHealth ?? '*',
    dashboardUid: filterState.dashboardUid,
    plugins: filterState.plugins ?? 'show',
    contactPoint: filterState.contactPoint ?? null,
    ruleSource: filterState.ruleSource ?? null,
    policy: filterState.policy ?? null,
  };
}

export function usePluginsFilterStatus() {
  const { components } = useAlertingHomePageExtensions();
  return { pluginsFilterEnabled: components.length > 0 };
}
