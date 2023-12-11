import produce from 'immer';
import { chain, compact, isEmpty } from 'lodash';
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
      const promRuleDefition = rule.promRule;

      // this will track what properties we're checking predicates for
      // all predicates must be "true" to include the rule in the result set
      // (this will result in an AND operation for our matchers)
      const matchesFilterFor = chain(filterState)
        // ⚠️ keep this list of properties we filter for here up-to-date ⚠️
        // We are ignoring predicates we've matched before we get here
        .pick(['ruleName', 'freeFormWords', 'ruleType', 'dataSourceName', 'ruleHealth', 'labels', 'ruleState'])
        .omitBy(isEmpty)
        .mapValues(() => false)
        .value();

      const ruleNameLc = rule.name?.toLocaleLowerCase();
      // Free Form Query is used to filter by rule name
      if ('freeFormWords' in matchesFilterFor) {
        const hasMatch = filterState.freeFormWords.every((w) => ruleNameLc.includes(w.toLocaleLowerCase()));
        if (hasMatch) {
          matchesFilterFor.freeFormWords = true;
        }
      }

      if ('ruleName' in matchesFilterFor && filterState.ruleName) {
        const hasMatch = rule.name?.toLocaleLowerCase().includes(filterState.ruleName.toLocaleLowerCase());
        if (hasMatch) {
          matchesFilterFor.ruleName = true;
        }
      }

      if ('ruleType' in matchesFilterFor && filterState.ruleType === promRuleDefition?.type) {
        matchesFilterFor.ruleType = true;
      }

      if ('dataSourceName' in matchesFilterFor) {
        if (isGrafanaRulerRule(rule.rulerRule)) {
          const doesNotQueryDs = isQueryingDataSource(rule.rulerRule, filterState);

          if (doesNotQueryDs) {
            matchesFilterFor.dataSourceName = true;
          }
        } else {
          matchesFilterFor.dataSourceName = true;
        }
      }

      if ('ruleHealth' in filterState && promRuleDefition) {
        const ruleHealth = getRuleHealth(promRuleDefition.health);
        const match = filterState.ruleHealth === ruleHealth;

        if (match) {
          matchesFilterFor.ruleHealth = true;
        }
      }

      // Query strings can match alert name, label keys, and label values
      if ('labels' in matchesFilterFor) {
        const matchers = compact(filterState.labels.map(looseParseMatcher));

        // check if the label we query for exists in _either_ the rule definition or in any of its alerts
        const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(rule.labels, matchers);
        const doAlertsContainMatchingLabels =
          matchers.length > 0 &&
          promRuleDefition &&
          promRuleDefition.type === PromRuleType.Alerting &&
          promRuleDefition.alerts &&
          promRuleDefition.alerts.some((alert) => labelsMatchMatchers(alert.labels, matchers));

        if (doRuleLabelsMatchQuery || doAlertsContainMatchingLabels) {
          matchesFilterFor.labels = true;
        }
      }

      if ('ruleState' in matchesFilterFor) {
        const promRule = rule.promRule;
        const hasPromRuleDefinition = promRule && isAlertingRule(promRule);

        const ruleStateMatches = hasPromRuleDefinition && promRule.state === filterState.ruleState;

        if (ruleStateMatches) {
          matchesFilterFor.ruleState = true;
        }
      }

      return Object.values(matchesFilterFor).every((match) => match === true);
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
