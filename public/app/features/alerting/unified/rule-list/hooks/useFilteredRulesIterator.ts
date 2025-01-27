import { AsyncIterableX, from } from 'ix/asynciterable/index';
import { merge } from 'ix/asynciterable/merge';
import { filter, flatMap, map } from 'ix/asynciterable/operators';
import { compact } from 'lodash';

import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import {
  DataSourceRuleGroupIdentifier,
  DataSourceRulesSourceIdentifier,
  GrafanaRuleGroupIdentifier,
} from 'app/types/unified-alerting';
import {
  GrafanaPromRuleDTO,
  GrafanaPromRuleGroupDTO,
  PromRuleDTO,
  PromRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { RulesFilter } from '../../search/rulesSearchParser';
import { labelsMatchMatchers } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid, getExternalRulesSources } from '../../utils/datasource';
import { parseMatcher } from '../../utils/matchers';
import { isAlertingRule } from '../../utils/rules';

import { useGrafanaGroupsGenerator, usePrometheusGroupsGenerator } from './prometheusGroupsGenerator';

export type RuleWithOrigin = PromRuleWithOrigin | GrafanaRuleWithOrigin;

export interface GrafanaRuleWithOrigin {
  rule: GrafanaPromRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  /**
   * The name of the namespace that contains the rule group
   * groupIdentifier contains the uid of the namespace, but not the user-friendly display name
   */
  namespaceName: string;
  origin: 'grafana';
}

export interface PromRuleWithOrigin {
  rule: PromRuleDTO;
  groupIdentifier: DataSourceRuleGroupIdentifier;
  origin: 'datasource';
}

export function useFilteredRulesIteratorProvider() {
  const allExternalRulesSources = getExternalRulesSources();

  const prometheusGroupsGenerator = usePrometheusGroupsGenerator();
  const grafanaGroupsGenerator = useGrafanaGroupsGenerator();

  const getFilteredRulesIterator = (filterState: RulesFilter, groupLimit: number): AsyncIterableX<RuleWithOrigin> => {
    const normalizedFilterState = normalizeFilterState(filterState);

    const ruleSourcesToFetchFrom = filterState.dataSourceNames.length
      ? filterState.dataSourceNames.map<DataSourceRulesSourceIdentifier>((ds) => ({
          name: ds,
          uid: getDatasourceAPIUid(ds),
          ruleSourceType: 'datasource',
        }))
      : allExternalRulesSources;

    const grafanaIterator = from(grafanaGroupsGenerator(groupLimit)).pipe(
      filter((group) => groupFilter(group, normalizedFilterState)),
      flatMap((group) => group.rules.map((rule) => [group, rule] as const)),
      filter(([_, rule]) => ruleFilter(rule, normalizedFilterState)),
      map(([group, rule]) => mapGrafanaRuleToRuleWithOrigin(group, rule))
    );

    const [source, ...iterables] = ruleSourcesToFetchFrom.map((ds) => {
      return from(prometheusGroupsGenerator(ds, groupLimit)).pipe(map((group) => [ds, group] as const));
    });

    const dataSourcesIterator = merge(source, ...iterables).pipe(
      filter(([_, group]) => groupFilter(group, normalizedFilterState)),
      flatMap(([rulesSource, group]) => group.rules.map((rule) => [rulesSource, group, rule] as const)),
      filter(([_, __, rule]) => ruleFilter(rule, filterState)),
      map(([rulesSource, group, rule]) => mapRuleToRuleWithOrigin(rulesSource, group, rule))
    );

    return merge(grafanaIterator, dataSourcesIterator);
  };

  return { getFilteredRulesIterator };
}

function mapRuleToRuleWithOrigin(
  rulesSource: DataSourceRulesSourceIdentifier,
  group: PromRuleGroupDTO,
  rule: PromRuleDTO
): PromRuleWithOrigin {
  return {
    rule,
    groupIdentifier: {
      rulesSource,
      namespace: { name: group.file },
      groupName: group.name,
      groupOrigin: 'datasource',
    },
    origin: 'datasource',
  };
}

function mapGrafanaRuleToRuleWithOrigin(
  group: GrafanaPromRuleGroupDTO,
  rule: GrafanaPromRuleDTO
): GrafanaRuleWithOrigin {
  return {
    rule,
    groupIdentifier: {
      namespace: { uid: group.folderUid },
      groupName: group.name,
      groupOrigin: 'grafana',
    },
    namespaceName: group.file,
    origin: 'grafana',
  };
}

/**
 * Returns a new group with only the rules that match the filter.
 * @returns A new group with filtered rules, or undefined if the group does not match the filter or all rules are filtered out.
 */
function groupFilter(group: PromRuleGroupDTO, filterState: RulesFilter): boolean {
  const { name, file } = group;

  // TODO Add fuzzy filtering or not
  if (filterState.namespace && !file.toLowerCase().includes(filterState.namespace)) {
    return false;
  }

  if (filterState.groupName && !name.toLowerCase().includes(filterState.groupName)) {
    return false;
  }

  return true;
}

function ruleFilter(rule: PromRuleDTO, filterState: RulesFilter) {
  const { name, labels = {}, health, type } = rule;

  const nameLower = name.toLowerCase();

  if (filterState.freeFormWords.length > 0 && !filterState.freeFormWords.some((word) => nameLower.includes(word))) {
    return false;
  }

  if (filterState.ruleName && !nameLower.includes(filterState.ruleName)) {
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

/**
 * Lowercase free form words, rule name, group name and namespace
 */
function normalizeFilterState(filterState: RulesFilter): RulesFilter {
  return {
    ...filterState,
    freeFormWords: filterState.freeFormWords.map((word) => word.toLowerCase()),
    ruleName: filterState.ruleName?.toLowerCase(),
    groupName: filterState.groupName?.toLowerCase(),
    namespace: filterState.namespace?.toLowerCase(),
  };
}

function looseParseMatcher(matcherQuery: string): Matcher | undefined {
  try {
    return parseMatcher(matcherQuery);
  } catch {
    // Try to createa a matcher than matches all values for a given key
    return { name: matcherQuery, value: '', isRegex: true, isEqual: true };
  }
}
