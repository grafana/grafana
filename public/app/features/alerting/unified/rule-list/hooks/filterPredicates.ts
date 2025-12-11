import { attempt, compact, isString } from 'lodash';
import memoize from 'micro-memoize';

import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { RulesFilter } from '../../search/rulesSearchParser';
import { labelsMatchMatchers } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { fuzzyMatches } from '../../utils/fuzzySearch';
import { parseMatcher } from '../../utils/matchers';
import { isPluginProvidedRule, prometheusRuleType } from '../../utils/rules';
import { normalizeHealth } from '../components/util';

export type RuleFilterHandler = (rule: PromRuleDTO, filterState: RulesFilter) => boolean;
export type GroupFilterHandler = (
  group: PromRuleGroupDTO,
  filterState: Pick<RulesFilter, 'namespace' | 'groupName'>
) => boolean;

export type RuleFilterConfig = Record<
  Exclude<keyof RulesFilter, 'namespace' | 'groupName' | 'ruleSource'>,
  RuleFilterHandler | null
>;

export type GroupFilterConfig = Record<keyof Pick<RulesFilter, 'namespace' | 'groupName'>, GroupFilterHandler | null>;

/**
 * @returns True if the group matches the filter, false otherwise. Keeps rules intact
 */
export function groupMatches(
  group: PromRuleGroupDTO,
  filterState: Pick<RulesFilter, 'namespace' | 'groupName'>,
  filterConfig: GroupFilterConfig
): boolean {
  if (filterConfig.namespace && filterConfig.namespace(group, filterState) === false) {
    return false;
  }

  if (filterConfig.groupName && filterConfig.groupName(group, filterState) === false) {
    return false;
  }

  return true;
}

/**
 * @returns True if the rule matches the filter, false otherwise
 */
export function ruleMatches(rule: PromRuleDTO, filterState: RulesFilter, filterConfig: RuleFilterConfig) {
  if (filterConfig.freeFormWords && filterConfig.freeFormWords(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.ruleName && filterConfig.ruleName(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.labels && filterConfig.labels(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.ruleType && filterConfig.ruleType(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.ruleState && filterConfig.ruleState(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.ruleHealth && filterConfig.ruleHealth(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.contactPoint && filterConfig.contactPoint(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.dashboardUid && filterConfig.dashboardUid(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.plugins && filterConfig.plugins(rule, filterState) === false) {
    return false;
  }

  if (filterConfig.dataSourceNames && filterConfig.dataSourceNames(rule, filterState) === false) {
    return false;
  }

  return true;
}

export function namespaceFilter(
  group: PromRuleGroupDTO,
  filterState: Pick<RulesFilter, 'namespace' | 'groupName'>
): boolean {
  if (filterState.namespace && !fuzzyMatches(group.file, filterState.namespace)) {
    return false;
  }

  return true;
}

export function groupNameFilter(
  group: PromRuleGroupDTO,
  filterState: Pick<RulesFilter, 'namespace' | 'groupName'>
): boolean {
  if (filterState.groupName && !fuzzyMatches(group.name, filterState.groupName)) {
    return false;
  }

  return true;
}

export function freeFormFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.freeFormWords.length > 0) {
    const nameMatches = fuzzyMatches(rule.name, filterState.freeFormWords.join(' '));
    if (!nameMatches) {
      return false;
    }
  }

  return true;
}

export function ruleNameFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.ruleName && !fuzzyMatches(rule.name, filterState.ruleName)) {
    return false;
  }

  return true;
}

export function labelsFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.labels.length > 0) {
    const matchers = compact(filterState.labels.map(looseParseMatcher));
    const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(rule.labels || {}, matchers);

    // Also check alerts if they exist
    const doAlertsContainMatchingLabels =
      matchers.length > 0 &&
      prometheusRuleType.alertingRule(rule) &&
      rule.alerts &&
      rule.alerts.some((alert) => labelsMatchMatchers(alert.labels || {}, matchers));

    if (!doRuleLabelsMatchQuery && !doAlertsContainMatchingLabels) {
      return false;
    }
  }

  return true;
}

export function ruleTypeFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.ruleType && rule.type !== filterState.ruleType) {
    return false;
  }

  return true;
}

export function ruleStateFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.ruleState) {
    if (!prometheusRuleType.alertingRule(rule)) {
      return false;
    }
    if (rule.state !== filterState.ruleState) {
      return false;
    }
  }

  return true;
}

export function ruleHealthFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.ruleHealth && normalizeHealth(rule.health) !== filterState.ruleHealth) {
    return false;
  }

  return true;
}

export function contactPointFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.contactPoint) {
    if (!prometheusRuleType.grafana.alertingRule(rule)) {
      return false;
    }

    if (!rule.notificationSettings) {
      return false;
    }

    if (filterState.contactPoint !== rule.notificationSettings.receiver) {
      return false;
    }
  }

  return true;
}

export function dashboardUidFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.dashboardUid) {
    if (!prometheusRuleType.alertingRule(rule)) {
      return false;
    }

    const dashboardAnnotation = rule.annotations?.[Annotation.dashboardUID];
    if (dashboardAnnotation !== filterState.dashboardUid) {
      return false;
    }
  }

  return true;
}

export function pluginsFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  // Plugins filter - hide plugin-provided rules when set to 'hide'
  if (filterState.plugins === 'hide' && isPluginProvidedRule(rule)) {
    return false;
  }

  return true;
}

export function dataSourceNamesFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  // Note: We can't implement these filters from reduceGroups because they rely on rulerRule property
  // which is not available in PromRuleDTO:
  // - contactPoint filter
  // - dataSourceNames filter
  if (filterState.dataSourceNames.length > 0) {
    const isGrafanaRule = prometheusRuleType.grafana.rule(rule);
    if (isGrafanaRule) {
      try {
        const filterDatasourceUids = mapDataSourceNamesToUids(filterState.dataSourceNames);
        const queriedDatasourceUids = rule.queriedDatasourceUIDs || [];

        const queryIncludesDataSource = queriedDatasourceUids.some((uid) => filterDatasourceUids.includes(uid));
        if (!queryIncludesDataSource) {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
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

// Memoize the function to avoid calling getDatasourceAPIUid for the filter values multiple times
export const mapDataSourceNamesToUids = memoize(
  (names: string[]): string[] => {
    return names.map((name) => attempt(getDatasourceAPIUid, name)).filter(isString);
  },
  { maxSize: 1 }
);
