import { merge } from 'ix/asynciterable/merge';
import { filter, flatMap, map } from 'ix/asynciterable/operators';
import { compact } from 'lodash';

import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { DataSourceRuleGroupIdentifier, ExternalRulesSourceIdentifier } from 'app/types/unified-alerting';
import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { RulesFilter } from '../../search/rulesSearchParser';
import { labelsMatchMatchers } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid, getExternalRulesSources } from '../../utils/datasource';
import { parseMatcher } from '../../utils/matchers';
import { isAlertingRule } from '../../utils/rules';

import { useRuleGroupsGenerator } from './prometheusGroupsGenerator';

export interface RuleWithOrigin {
  rule: PromRuleDTO;
  groupIdentifier: DataSourceRuleGroupIdentifier;
}

export function useFilteredRulesIteratorProvider() {
  const allExternalRulesSources = getExternalRulesSources();

  const { prometheusGroupsGenerator } = useRuleGroupsGenerator();

  const getFilteredRulesIterator = (filterState: RulesFilter, groupLimit: number) => {
    const ruleSourcesToFetchFrom = filterState.dataSourceNames.length
      ? filterState.dataSourceNames.map<ExternalRulesSourceIdentifier>((ds) => ({
          name: ds,
          uid: getDatasourceAPIUid(ds),
          ruleSourceType: 'external',
        }))
      : allExternalRulesSources;

    // This split into the first one and the rest is only for compatibility with the merge function from ix
    const [source, ...iterables] = ruleSourcesToFetchFrom.map((ds) => prometheusGroupsGenerator(ds, groupLimit));

    return merge(source, ...iterables).pipe(
      filter(([_, group]) => groupFilter(group, filterState)),
      flatMap(([rulesSource, group]) => group.rules.map((rule) => [rulesSource, group, rule] as const)),
      filter(([_, __, rule]) => ruleFilter(rule, filterState)),
      map(([rulesSource, group, rule]) => mapRuleToRuleWithOrigin(rulesSource, group, rule))
    );
  };

  return { getFilteredRulesIterator };
}

function mapRuleToRuleWithOrigin(
  rulesSource: ExternalRulesSourceIdentifier,
  group: PromRuleGroupDTO,
  rule: PromRuleDTO
): RuleWithOrigin {
  return {
    rule,
    groupIdentifier: {
      rulesSource,
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
function groupFilter(group: PromRuleGroupDTO, filterState: RulesFilter): boolean {
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
