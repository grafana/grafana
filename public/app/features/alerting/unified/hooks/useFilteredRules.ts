import uFuzzy from '@leeoniya/ufuzzy';
import { produce } from 'immer';
import { chain, compact, isEmpty } from 'lodash';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { CombinedRuleGroup, CombinedRuleNamespace, Rule } from 'app/types/unified-alerting';
import { PromRuleType, RulerGrafanaRuleDTO, isPromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { logError } from '../Analytics';
import { RulesFilter, applySearchFilterToQuery, getSearchFilterFromQuery } from '../search/rulesSearchParser';
import { labelsMatchMatchers, matcherToMatcherField } from '../utils/alertmanager';
import { Annotation } from '../utils/constants';
import { isCloudRulesSource } from '../utils/datasource';
import { parseMatcher, parsePromQLStyleMatcherLoose } from '../utils/matchers';
import {
  getRuleHealth,
  isAlertingRule,
  isGrafanaRulerRule,
  isPluginProvidedRule,
  isPromRuleType,
} from '../utils/rules';

import { calculateGroupTotals, calculateRuleFilteredTotals, calculateRuleTotals } from './useCombinedRuleNamespaces';
import { useURLSearchParams } from './useURLSearchParams';

// if the search term is longer than MAX_NEEDLE_SIZE we disable Levenshtein distance
const MAX_NEEDLE_SIZE = 25;
const INFO_THRESHOLD = Infinity;

const SEARCH_FAILED_ERR = new Error('Failed to search rules');

/**
 * Escape query strings so that regex characters don't interfere
 * with uFuzzy search methods.
 *
 * The fuzzy searching will take the query and generate a regex - but if the query
 * contains a regex itself, then it can easily end up being split in a bad place
 * and end up creating an invalid expression
 */
const escapeQueryRegex = (query: string) => {
  // see https://stackoverflow.com/a/6969486
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export function useRulesFilter() {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const searchQuery = queryParams.get('search') ?? '';

  const filterState = useMemo<RulesFilter>(() => {
    return getSearchFilterFromQuery(searchQuery);
  }, [searchQuery]);
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
      labels: parsePromQLStyleMatcherLoose(queryParams.get('queryString') ?? '').map(matcherToMatcherField),
    };

    const hasLegacyFilters = Object.values(legacyFilters).some((legacyFilter) => !isEmpty(legacyFilter));
    if (hasLegacyFilters) {
      updateQueryParams({ dataSource: undefined, alertState: undefined, ruleType: undefined, queryString: undefined });
      // Existing query filters takes precedence over legacy ones
      updateFilters(
        produce(filterState, (draft) => {
          draft.dataSourceNames ??= legacyFilters.dataSource ? [legacyFilters.dataSource] : [];
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
  const deferredNamespaces = useDeferredValue(namespaces);
  const deferredFilterState = useDeferredValue(filterState);

  return useMemo(() => {
    const filteredRules = filterRules(deferredNamespaces, deferredFilterState);

    // Totals recalculation is a workaround for the lack of server-side filtering
    filteredRules.forEach((namespace) => {
      namespace.groups.forEach((group) => {
        group.rules.forEach((rule) => {
          if (isAlertingRule(rule.promRule)) {
            rule.instanceTotals = calculateRuleTotals(rule.promRule);
            rule.filteredInstanceTotals = calculateRuleFilteredTotals(rule.promRule);
          }
        });

        group.totals = calculateGroupTotals({
          rules: group.rules.map((r) => r.promRule).filter((r): r is Rule => !!r),
        });
      });
    });

    return filteredRules;
  }, [deferredNamespaces, deferredFilterState]);
};

export const filterRules = (
  namespaces: CombinedRuleNamespace[],
  filterState: RulesFilter = { dataSourceNames: [], labels: [], freeFormWords: [] }
): CombinedRuleNamespace[] => {
  let filteredNamespaces = namespaces;

  const dataSourceFilter = filterState.dataSourceNames;
  if (dataSourceFilter.length) {
    filteredNamespaces = filteredNamespaces.filter(({ rulesSource }) =>
      isCloudRulesSource(rulesSource) ? dataSourceFilter.includes(rulesSource.name) : true
    );
  }

  const namespaceFilter = filterState.namespace;

  if (namespaceFilter) {
    const namespaceHaystack = filteredNamespaces.map((ns) => ns.name);

    const escapedQuery = escapeQueryRegex(namespaceFilter);

    const ufuzzy = getSearchInstance(namespaceFilter);
    const [idxs, info, order] = ufuzzy.search(
      namespaceHaystack,
      escapedQuery,
      getOutOfOrderLimit(namespaceFilter),
      INFO_THRESHOLD
    );
    if (info && order) {
      filteredNamespaces = order.map((idx) => filteredNamespaces[info.idx[idx]]);
    } else if (idxs) {
      filteredNamespaces = idxs.map((idx) => filteredNamespaces[idx]);
    }
  }

  // If a namespace and group have rules that match the rules filters then keep them.
  const filteredRuleNamespaces: CombinedRuleNamespace[] = [];

  try {
    const matches = filteredNamespaces.reduce<CombinedRuleNamespace[]>(reduceNamespaces(filterState), []);
    matches.forEach((match) => {
      filteredRuleNamespaces.push(match);
    });
  } catch {
    logError(SEARCH_FAILED_ERR, {
      search: JSON.stringify(filterState),
    });
  }

  return filteredRuleNamespaces;
};

const reduceNamespaces = (filterState: RulesFilter) => {
  return (namespaceAcc: CombinedRuleNamespace[], namespace: CombinedRuleNamespace) => {
    const groupNameFilter = filterState.groupName;
    let filteredGroups = namespace.groups;

    if (groupNameFilter) {
      const groupsHaystack = filteredGroups.map((g) => g.name);
      const ufuzzy = getSearchInstance(groupNameFilter);

      const escapedQuery = escapeQueryRegex(groupNameFilter);
      const [idxs, info, order] = ufuzzy.search(
        groupsHaystack,
        escapedQuery,
        getOutOfOrderLimit(groupNameFilter),
        INFO_THRESHOLD
      );
      if (info && order) {
        filteredGroups = order.map((idx) => filteredGroups[info.idx[idx]]);
      } else if (idxs) {
        filteredGroups = idxs.map((idx) => filteredGroups[idx]);
      }
    }

    filteredGroups = filteredGroups.reduce<CombinedRuleGroup[]>(reduceGroups(filterState), []);

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
      const ufuzzy = getSearchInstance(ruleNameQuery);
      const escapedQuery = escapeQueryRegex(ruleNameQuery);

      const [idxs, info, order] = ufuzzy.search(
        rulesHaystack,
        escapedQuery,
        getOutOfOrderLimit(ruleNameQuery),
        INFO_THRESHOLD
      );
      if (info && order) {
        filteredRules = order.map((idx) => filteredRules[info.idx[idx]]);
      } else if (idxs) {
        filteredRules = idxs.map((idx) => filteredRules[idx]);
      }
    }

    filteredRules = filteredRules.filter((rule) => {
      const promRuleDefition = rule.promRule;

      // this will track what properties we're checking predicates for
      // all predicates must be "true" to include the rule in the result set
      // (this will result in an AND operation for our matchers)
      const matchesFilterFor = chain(filterState)
        // ⚠️ keep this list of properties we filter for here up-to-date ⚠️
        // We are ignoring predicates we've matched before we get here (like "freeFormWords")
        .pick([
          'ruleType',
          'dataSourceNames',
          'ruleHealth',
          'labels',
          'ruleState',
          'dashboardUid',
          'plugins',
          'contactPoint',
        ])
        .omitBy(isEmpty)
        .mapValues(() => false)
        .value();

      if ('ruleType' in matchesFilterFor && filterState.ruleType === promRuleDefition?.type) {
        matchesFilterFor.ruleType = true;
      }

      if ('plugins' in matchesFilterFor && filterState.plugins === 'hide') {
        matchesFilterFor.plugins = rule.rulerRule && !isPluginProvidedRule(rule.rulerRule);
      }

      if ('contactPoint' in matchesFilterFor) {
        const contactPoint = filterState.contactPoint;
        const hasContactPoint =
          isGrafanaRulerRule(rule.rulerRule) &&
          rule.rulerRule.grafana_alert.notification_settings?.receiver === contactPoint;

        if (hasContactPoint) {
          matchesFilterFor.contactPoint = true;
        }
      }

      if ('dataSourceNames' in matchesFilterFor) {
        if (isGrafanaRulerRule(rule.rulerRule)) {
          const doesNotQueryDs = isQueryingDataSource(rule.rulerRule, filterState);

          if (doesNotQueryDs) {
            matchesFilterFor.dataSourceNames = true;
          }
        } else {
          matchesFilterFor.dataSourceNames = true;
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

      if (
        'dashboardUid' in matchesFilterFor &&
        rule.annotations[Annotation.dashboardUID] === filterState.dashboardUid
      ) {
        matchesFilterFor.dashboardUid = true;
      }

      return Object.values(matchesFilterFor).every((match) => match === true);
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

// apply an outOfOrder limit which helps to limit the number of permutations to search for
// and prevents the browser from hanging
function getOutOfOrderLimit(searchTerm: string) {
  const ufuzzy = getSearchInstance(searchTerm);

  const termCount = ufuzzy.split(searchTerm).length;
  return termCount < 5 ? 4 : 0;
}

function looseParseMatcher(matcherQuery: string): Matcher | undefined {
  try {
    return parseMatcher(matcherQuery);
  } catch {
    // Try to createa a matcher than matches all values for a given key
    return { name: matcherQuery, value: '', isRegex: true, isEqual: true };
  }
}

// determine which search instance to use, very long search terms should match without checking for Levenshtein distance
function getSearchInstance(searchTerm: string): uFuzzy {
  const searchTermExeedsMaxNeedleSize = searchTerm.length > MAX_NEEDLE_SIZE;

  // Options details can be found here https://github.com/leeoniya/uFuzzy#options
  // The following configuration complies with Damerau-Levenshtein distance
  // https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
  return new uFuzzy({
    // we will disable Levenshtein distance for very long search terms – this will help with performance
    // as it will avoid creating a very complex regular expression
    intraMode: searchTermExeedsMaxNeedleSize ? 0 : 1,
    // split search terms only on whitespace, this will significantly reduce the amount of regex permutations to test
    // and is important for performance with large amount of rules and large needle
    interSplit: '\\s+',
  });
}

const isQueryingDataSource = (rulerRule: RulerGrafanaRuleDTO, filterState: RulesFilter): boolean => {
  if (!filterState.dataSourceNames?.length) {
    return true;
  }

  return !!rulerRule.grafana_alert.data.find((query) => {
    if (!query.datasourceUid) {
      return false;
    }
    const ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
    return ds?.name && filterState?.dataSourceNames?.includes(ds.name);
  });
};
