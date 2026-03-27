import { useEffect, useRef } from 'react';

import { useAlertingHomePageExtensions } from '../../plugins/useAlertingHomePageExtensions';
import { RulesFilter } from '../../search/rulesSearchParser';

import { AdvancedFilters } from './types';

export function formAdvancedFiltersToRuleFilter(
  values: AdvancedFilters,
  existingFreeFormWords: string[] = []
): RulesFilter {
  return {
    freeFormWords: existingFreeFormWords,
    ...values,
    namespace: values.namespace || undefined,
    groupName: values.groupName || undefined,
    contactPoint: values.contactPoint || undefined,
    ruleHealth: values.ruleHealth === '*' ? undefined : values.ruleHealth,
    ruleState: values.ruleState === '*' ? undefined : values.ruleState,
    ruleType: values.ruleType === '*' ? undefined : values.ruleType,
    plugins: values.plugins === 'show' ? undefined : 'hide',
    ruleSource: values.ruleSource ?? undefined,
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
    contactPoint: values.contactPoint || undefined,
    ruleSource: values.ruleSource ?? undefined,
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
  };
}

export function usePortalContainer(zIndex: number): HTMLElement | undefined {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: String(zIndex),
    });

    document.body.appendChild(container);
    containerRef.current = container;

    return () => {
      container.remove();
    };
  }, [zIndex]);

  return containerRef.current || undefined;
}

export function usePluginsFilterStatus() {
  const { components } = useAlertingHomePageExtensions();
  return { pluginsFilterEnabled: components.length > 0 };
}
