import uFuzzy from '@leeoniya/ufuzzy';
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

  const filterState = useMemo(() => getSearchFilterFromQuery(searchQuery), [searchQuery]);
  const hasActiveFilters = useMemo(() => Object.values(filterState).some((filter) => !isEmpty(filter)), [filterState]);

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

// Options details can be found here https://github.com/leeoniya/uFuzzy#options
// The following configuration complies with Damerau-Levenshtein distance
// https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
const ufuzzy = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
});

export const filterRules = (
  namespaces: CombinedRuleNamespace[],
  filterState: RulesFilter = { labels: [], freeFormWords: [] }
): CombinedRuleNamespace[] => {
  let filteredNamespaces = namespaces;

  const dataSourceFilter = filterState.dataSourceName;
  if (dataSourceFilter) {
    filteredNamespaces = filteredNamespaces.filter(({ rulesSource }) =>
      isCloudRulesSource(rulesSource) ? rulesSource.name === dataSourceFilter : true
    );
  }

  const namespaceFilter = filterState.namespace;
  if (namespaceFilter) {
    const namespaceHaystack = filteredNamespaces.map((ns) => ns.name);

    const [idxs, info, order] = ufuzzy.search(namespaceHaystack, namespaceFilter);
    if (info && order) {
      filteredNamespaces = order.map((idx) => filteredNamespaces[info.idx[idx]]);
    } else if (idxs) {
      filteredNamespaces = idxs.map((idx) => filteredNamespaces[idx]);
    }
  }

  // If a namespace and group have rules that match the rules filters then keep them.
  return filteredNamespaces.reduce(reduceNamespaces(filterState), [] as CombinedRuleNamespace[]);
};

const reduceNamespaces = (filterState: RulesFilter) => {
  return (namespaceAcc: CombinedRuleNamespace[], namespace: CombinedRuleNamespace) => {
    const groupNameFilter = filterState.groupName;
    let filteredGroups = namespace.groups;

    if (groupNameFilter) {
      const groupsHaystack = filteredGroups.map((g) => g.name);
      const [idxs, info, order] = ufuzzy.search(groupsHaystack, groupNameFilter);
      if (info && order) {
        filteredGroups = order.map((idx) => filteredGroups[info.idx[idx]]);
      } else if (idxs) {
        filteredGroups = idxs.map((idx) => filteredGroups[idx]);
      }
    }

    filteredGroups = filteredGroups.reduce(reduceGroups(filterState), [] as CombinedRuleGroup[]);

    if (filteredGroups.length) {
      namespaceAcc.push({
        ...namespace,
        groups: filteredGroups,
      });
    }

    return namespaceAcc;
  };
};

// Reduces groups to only groups that have rules matching the filters
const reduceGroups = (filterState: RulesFilter) => {
  const ruleNameQuery = filterState.ruleName ?? filterState.freeFormWords.join(' ');

  return (groupAcc: CombinedRuleGroup[], group: CombinedRuleGroup) => {
    let filteredRules = group.rules;

    if (ruleNameQuery) {
      const rulesHaystack = filteredRules.map((r) => r.name);
      const [idxs, info, order] = ufuzzy.search(rulesHaystack, ruleNameQuery);
      if (info && order) {
        filteredRules = order.map((idx) => filteredRules[info.idx[idx]]);
      } else if (idxs) {
        filteredRules = idxs.map((idx) => filteredRules[idx]);
      }
    }

    filteredRules = filteredRules.filter((rule) => {
      if (filterState.ruleType && filterState.ruleType !== rule.promRule?.type) {
        return false;
      }

      const doesNotQueryDs = isGrafanaRulerRule(rule.rulerRule) && !isQueryingDataSource(rule.rulerRule, filterState);
      if (filterState.dataSourceName && doesNotQueryDs) {
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
    if (filteredRules.length) {
      groupAcc.push({
        ...group,
        rules: filteredRules,
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
