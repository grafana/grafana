import produce from 'immer';
import { compact } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { isPromAlertingRuleState, PromRuleType, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { getSearchFilterFromQuery, SearchFilterState, applySearchFilterToQuery } from '../search/searchEngine';
import { labelsMatchMatchers, matcherToMatcherField, parseMatcher, parseMatchers } from '../utils/alertmanager';
import { isCloudRulesSource } from '../utils/datasource';
import { isAlertingRule, isGrafanaRulerRule, isPromRuleType } from '../utils/rules';

import { useURLSearchParams } from './useURLSearchParams';

export function useRulesFilter() {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const searchQuery = queryParams.get('search') ?? '';

  const filterState = getSearchFilterFromQuery(searchQuery);

  const updateFilters = useCallback(
    (newFilter: SearchFilterState) => {
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

    const hasLegacyFilters = Object.values(legacyFilters).some((lf) => (Array.isArray(lf) ? lf.length > 0 : !!lf));
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

  return { filterState, searchQuery, setSearchQuery, updateFilters };
}

export const useFilteredRules = (namespaces: CombinedRuleNamespace[]) => {
  const { filterState } = useRulesFilter();
  return useMemo(() => filterRules(namespaces, filterState), [namespaces, filterState]);
};

export const filterRules = (
  namespaces: CombinedRuleNamespace[],
  ngFilters: SearchFilterState = { labels: [], freeFormWords: [] }
): CombinedRuleNamespace[] => {
  return (
    namespaces
      .filter((ns) => (ngFilters.namespace ? ns.name.toLowerCase().includes(ngFilters.namespace.toLowerCase()) : true))
      .filter(({ rulesSource }) =>
        ngFilters.dataSourceName && isCloudRulesSource(rulesSource)
          ? rulesSource.name === ngFilters.dataSourceName
          : true
      )
      // If a namespace and group have rules that match the rules filters then keep them.
      .reduce(reduceNamespaces(ngFilters), [] as CombinedRuleNamespace[])
  );
};

const reduceNamespaces = (ngFilters: SearchFilterState) => {
  return (namespaceAcc: CombinedRuleNamespace[], namespace: CombinedRuleNamespace) => {
    const groups = namespace.groups
      .filter((g) => (ngFilters.groupName ? g.name.toLowerCase().includes(ngFilters.groupName.toLowerCase()) : true))
      .reduce(reduceGroups(ngFilters), [] as CombinedRuleGroup[]);

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
const reduceGroups = (ngFilters: SearchFilterState) => {
  return (groupAcc: CombinedRuleGroup[], group: CombinedRuleGroup) => {
    const rules = group.rules.filter((rule) => {
      if (ngFilters.ruleType && ngFilters.ruleType !== rule.promRule?.type) {
        return false;
      }
      if (
        ngFilters.dataSourceName &&
        isGrafanaRulerRule(rule.rulerRule) &&
        !isQueryingDataSource(rule.rulerRule, ngFilters)
      ) {
        return false;
      }

      const ruleNameLc = rule.name?.toLocaleLowerCase();
      // Free Form Query is used to filter by rule name
      if (
        ngFilters.freeFormWords.length > 0 &&
        !ngFilters.freeFormWords.every((w) => ruleNameLc.includes(w.toLocaleLowerCase()))
      ) {
        return false;
      }

      if (ngFilters.ruleName && !rule.name?.toLocaleLowerCase().includes(ngFilters.ruleName.toLocaleLowerCase())) {
        return false;
      }
      // Query strings can match alert name, label keys, and label values
      if (ngFilters.labels.length > 0) {
        // const matchers = parseMatchers(filters.queryString);
        const matchers = compact(ngFilters.labels.map(looseParseMatcher));

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
        ngFilters.ruleState &&
        !(rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === ngFilters.ruleState)
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

const isQueryingDataSource = (rulerRule: RulerGrafanaRuleDTO, ngFilter: SearchFilterState): boolean => {
  if (!ngFilter.dataSourceName) {
    return true;
  }

  return !!rulerRule.grafana_alert.data.find((query) => {
    if (!query.datasourceUid) {
      return false;
    }
    const ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
    return ds?.name === ngFilter.dataSourceName;
  });
};
