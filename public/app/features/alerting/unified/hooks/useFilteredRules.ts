import produce from 'immer';
import { compact, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { isPromAlertingRuleState, PromRuleType, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { applySearchFilterToQuery, getSearchFilterFromQuery, RulesFilter } from '../search/rulesSearchParser';
import { labelsMatchMatchers, matcherToMatcherField, parseMatcher, parseMatchers } from '../utils/alertmanager';
import { isCloudRulesSource } from '../utils/datasource';
import { getRuleHealth, isAlertingRule, isGrafanaRulerRule, isPromRuleType } from '../utils/rules';

import { useURLSearchParams } from './useURLSearchParams';

export function useRulesFilter() {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const searchQuery = queryParams.get('search') ?? '';

  const filterState = getSearchFilterFromQuery(searchQuery);
  const hasActiveFilters = Object.values(filterState).some((filter) => !isEmpty(filter));

  const updateFilters = useCallback(
    (newFilter: RulesFilter) => {
      const newSearchQuery = applySearchFilterToQuery(searchQuery, newFilter);
      updateQueryParams({ search: newSearchQuery });
    },
    [searchQuery, updateQueryParams]
  );

  const setSearchQuery = useCallback(
    (newSearchQuery: string | undefined) => {
      updateQueryParams({ search: newSearchQuery });
    },
    [updateQueryParams]
  );

  // Handle legacy filters
  useEffect(() => {
    const legacyFilters = {
      dataSource: queryParams.get('dataSource') ?? undefined,
      alertState: queryParams.get('alertState') ?? undefined,
      ruleType: queryParams.get('ruleType') ?? undefined,
      labels: parseMatchers(queryParams.get('queryString') ?? '').map(matcherToMatcherField),
    };

    const hasLegacyFilters = Object.values(legacyFilters).some((legacyFilter) => !isEmpty(legacyFilter));
    if (hasLegacyFilters) {
      updateQueryParams({ dataSource: undefined, alertState: undefined, ruleType: undefined, queryString: undefined });
      // Existing query filters takes precedence over legacy ones
      updateFilters(
        produce(filterState, (draft) => {
          draft.dataSourceName ??= legacyFilters.dataSource;
          if (legacyFilters.alertState && isPromAlertingRuleState(legacyFilters.alertState)) {
            draft.ruleState ??= legacyFilters.alertState;
          }
          if (legacyFilters.ruleType && isPromRuleType(legacyFilters.ruleType)) {
            draft.ruleType ??= legacyFilters.ruleType;
          }
          if (draft.labels.length === 0 && legacyFilters.labels.length > 0) {
            const legacyLabelsAsStrings = legacyFilters.labels.map(
              ({ name, operator, value }) => `${name}${operator}${value}`
            );
            draft.labels.push(...legacyLabelsAsStrings);
          }
        })
      );
    }
  }, [queryParams, updateFilters, filterState, updateQueryParams]);

  return { filterState, hasActiveFilters, searchQuery, setSearchQuery, updateFilters };
}

export const useFilteredRules = (namespaces: CombinedRuleNamespace[], filterState: RulesFilter) => {
  return useMemo(() => filterRules(namespaces, filterState), [namespaces, filterState]);
};

export const filterRules = (
  namespaces: CombinedRuleNamespace[],
  filterState: RulesFilter = { labels: [], freeFormWords: [] }
): CombinedRuleNamespace[] => {
  return (
    namespaces
      .filter((ns) =>
        filterState.namespace ? ns.name.toLowerCase().includes(filterState.namespace.toLowerCase()) : true
      )
      .filter(({ rulesSource }) =>
        filterState.dataSourceName && isCloudRulesSource(rulesSource)
          ? rulesSource.name === filterState.dataSourceName
          : true
      )
      // If a namespace and group have rules that match the rules filters then keep them.
      .reduce(reduceNamespaces(filterState), [] as CombinedRuleNamespace[])
  );
};

const reduceNamespaces = (filterStateFilters: RulesFilter) => {
  return (namespaceAcc: CombinedRuleNamespace[], namespace: CombinedRuleNamespace) => {
    const groups = namespace.groups
      .filter((g) =>
        filterStateFilters.groupName ? g.name.toLowerCase().includes(filterStateFilters.groupName.toLowerCase()) : true
      )
      .reduce(reduceGroups(filterStateFilters), [] as CombinedRuleGroup[]);

    if (groups.length) {
      namespaceAcc.push({
        ...namespace,
        groups,
      });
    }

    return namespaceAcc;
  };
};

// Reduces groups to only groups that have rules matching the filters
const reduceGroups = (filterState: RulesFilter) => {
  return (groupAcc: CombinedRuleGroup[], group: CombinedRuleGroup) => {
    const rules = group.rules.filter((rule) => {
      if (filterState.ruleType && filterState.ruleType !== rule.promRule?.type) {
        return false;
      }

      const doesNotQueryDs = isGrafanaRulerRule(rule.rulerRule) && !isQueryingDataSource(rule.rulerRule, filterState);
      if (filterState.dataSourceName && doesNotQueryDs) {
        return false;
      }

      const ruleNameLc = rule.name?.toLocaleLowerCase();
      // Free Form Query is used to filter by rule name
      if (
        filterState.freeFormWords.length > 0 &&
        !filterState.freeFormWords.every((w) => ruleNameLc.includes(w.toLocaleLowerCase()))
      ) {
        return false;
      }

      if (filterState.ruleName && !rule.name?.toLocaleLowerCase().includes(filterState.ruleName.toLocaleLowerCase())) {
        return false;
      }

      if (filterState.ruleHealth && rule.promRule) {
        const ruleHealth = getRuleHealth(rule.promRule.health);
        return filterState.ruleHealth === ruleHealth;
      }

      // Query strings can match alert name, label keys, and label values
      if (filterState.labels.length > 0) {
        // const matchers = parseMatchers(filters.queryString);
        const matchers = compact(filterState.labels.map(looseParseMatcher));

        const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(rule.labels, matchers);
        const doAlertsContainMatchingLabels =
          matchers.length > 0 &&
          rule.promRule &&
          rule.promRule.type === PromRuleType.Alerting &&
          rule.promRule.alerts &&
          rule.promRule.alerts.some((alert) => labelsMatchMatchers(alert.labels, matchers));

        if (!(doRuleLabelsMatchQuery || doAlertsContainMatchingLabels)) {
          return false;
        }
      }
      if (
        filterState.ruleState &&
        !(rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === filterState.ruleState)
      ) {
        return false;
      }
      return true;
    });
    // Add rules to the group that match the rule list filters
    if (rules.length) {
      groupAcc.push({
        ...group,
        rules,
      });
    }
    return groupAcc;
  };
};

function looseParseMatcher(matcherQuery: string): Matcher | undefined {
  try {
    return parseMatcher(matcherQuery);
  } catch {
    // Try to createa a matcher than matches all values for a given key
    return { name: matcherQuery, value: '', isRegex: true, isEqual: true };
  }
}

const isQueryingDataSource = (rulerRule: RulerGrafanaRuleDTO, filterState: RulesFilter): boolean => {
  if (!filterState.dataSourceName) {
    return true;
  }

  return !!rulerRule.grafana_alert.data.find((query) => {
    if (!query.datasourceUid) {
      return false;
    }
    const ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
    return ds?.name === filterState.dataSourceName;
  });
};
