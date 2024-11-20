import { merge } from 'ix/asynciterable/merge';
import { filter, flatMap, map } from 'ix/asynciterable/operators';
import { compact } from 'lodash';
import memoize from 'micro-memoize';
import { useCallback } from 'react';

import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { DataSourceRuleGroupIdentifier } from 'app/types/unified-alerting';
import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../../api/prometheusApi';
import { RulesFilter } from '../../search/rulesSearchParser';
import { labelsMatchMatchers } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getAllRulesSourceNames, getDatasourceAPIUid } from '../../utils/datasource';
import { parseMatcher } from '../../utils/matchers';
import { hashRule } from '../../utils/rule-id';
import { isAlertingRule } from '../../utils/rules';

export interface RuleWithOrigin {
  /**
   * Artificial frontend-only identifier for the rule.
   * It's used as a key for the rule in the rule list to prevent key duplication
   */
  ruleKey: string;
  rule: PromRuleDTO;
  groupIdentifier: DataSourceRuleGroupIdentifier;
}

const { useLazyGroupsQuery } = prometheusApi;

export function useFilteredRulesIteratorProvider() {
  const [fetchGroups] = useLazyGroupsQuery();
  const allRuleSourceNames = getAllRulesSourceNames();

  /**
   * This async generator will continue to yield rule groups and will keep fetching backend pages as long as the consumer
   * is iterating.
   */
  const fetchRuleSourceGroups = useCallback(
    async function* (ruleSourceName: string, maxGroups: number) {
      const ruleSourceUid = getDatasourceAPIUid(ruleSourceName);

      const response = await fetchGroups({
        ruleSource: { uid: ruleSourceUid },
        groupLimit: maxGroups,
      });

      if (response.data?.data) {
        yield* response.data.data.groups.map((group) => [ruleSourceName, group] as const);
      }

      let lastToken: string | undefined = undefined;
      if (response.data?.data?.groupNextToken) {
        lastToken = response.data.data.groupNextToken;
      }

      while (lastToken) {
        const response = await fetchGroups({
          ruleSource: { uid: ruleSourceUid },
          groupNextToken: lastToken,
          groupLimit: maxGroups,
        });

        if (response.data?.data) {
          yield* response.data.data.groups.map((group) => [ruleSourceName, group] as const);
        }

        lastToken = response.data?.data?.groupNextToken;
      }
    },
    [fetchGroups]
  );

  const getFilteredRulesIterator = (filterState: RulesFilter, groupLimit: number) => {
    const ruleSourcesToFetchFrom = filterState.dataSourceNames.length
      ? filterState.dataSourceNames
      : allRuleSourceNames;
    const [source, ...iterables] = ruleSourcesToFetchFrom.map((ds) => fetchRuleSourceGroups(ds, groupLimit));

    return merge(source, ...iterables).pipe(
      filter(([rulesSource, group]) => groupFilter(rulesSource, group, filterState)),
      flatMap(([rulesSource, group]) => group.rules.map((rule) => [rulesSource, group, rule] as const)),
      filter(([_, __, rule]) => ruleFilter(rule, filterState)),
      map(([rulesSource, group, rule]) => mapRuleToRuleWithOrigin(rulesSource, group, rule))
    );
  };

  return { getFilteredRulesIterator };
}

// TODO maybe we want infinitely large?
const getRulesSourceUidMemoized = memoize(getDatasourceAPIUid);

function mapRuleToRuleWithOrigin(rulesSourceName: string, group: PromRuleGroupDTO, rule: PromRuleDTO): RuleWithOrigin {
  const ruleKey = `${rulesSourceName}-${group.file}-${group.name}-${rule.name}-${rule.type}-${hashRule(rule)}`;

  return {
    ruleKey,
    rule,
    groupIdentifier: {
      rulesSource: { name: rulesSourceName, uid: getRulesSourceUidMemoized(rulesSourceName) },
      namespace: { name: group.file },
      groupName: group.name,
      groupOrigin: 'datasource',
    },
  };
}

/**
 * Returns a new group with only the rules that match the filter.
 * @returns A new group with filtered rules, or undefined if the group does not match the filter or all rules are filtered out.
 */
function groupFilter(rulesSourceName: string, group: PromRuleGroupDTO, filterState: RulesFilter): boolean {
  const { name, file } = group;

  // TODO Add fuzzy filtering or not
  if (filterState.namespace && !file.includes(filterState.namespace)) {
    return false;
  }

  if (filterState.groupName && !name.includes(filterState.groupName)) {
    return false;
  }

  return true;
}

function ruleFilter(rule: PromRuleDTO, filterState: RulesFilter) {
  const { name, labels = {}, health, type } = rule;

  if (filterState.freeFormWords.length > 0 && !filterState.freeFormWords.some((word) => name.includes(word))) {
    return false;
  }

  if (filterState.ruleName && !name.includes(filterState.ruleName)) {
    return false;
  }

  if (filterState.labels.length > 0) {
    const matchers = compact(filterState.labels.map(looseParseMatcher));
    const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(labels, matchers);
    if (!doRuleLabelsMatchQuery) {
      return false;
    }
  }

  if (filterState.ruleType && type !== filterState.ruleType) {
    return false;
  }

  if (filterState.ruleState) {
    if (!isAlertingRule(rule)) {
      return false;
    }
    if (rule.state !== filterState.ruleState) {
      return false;
    }
  }

  if (filterState.ruleHealth && health !== filterState.ruleHealth) {
    return false;
  }

  if (filterState.dashboardUid) {
    return rule.labels ? rule.labels[Annotation.dashboardUID] === filterState.dashboardUid : false;
  }

  return true;
}

function looseParseMatcher(matcherQuery: string): Matcher | undefined {
  try {
    return parseMatcher(matcherQuery);
  } catch {
    // Try to createa a matcher than matches all values for a given key
    return { name: matcherQuery, value: '', isRegex: true, isEqual: true };
  }
}
