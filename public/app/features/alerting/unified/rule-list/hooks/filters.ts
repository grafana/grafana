import { attempt, compact, isString } from 'lodash';
import memoize from 'micro-memoize';

import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { RulesFilter } from '../../search/rulesSearchParser';
import { labelsMatchMatchers } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { parseMatcher } from '../../utils/matchers';
import { isPluginProvidedRule, prometheusRuleType } from '../../utils/rules';

/**
 * @returns True if the group matches the filter, false otherwise. Keeps rules intact
 */
export function groupFilter(group: PromRuleGroupDTO, filterState: RulesFilter): boolean {
  const { name, file } = group;

  // Add fuzzy search for namespace
  if (filterState.namespace && !file.toLowerCase().includes(filterState.namespace)) {
    return false;
  }

  // Add fuzzy search for group name
  if (filterState.groupName && !name.toLowerCase().includes(filterState.groupName)) {
    return false;
  }

  return true;
}

/**
 * @returns True if the rule matches the filter, false otherwise
 */
export function ruleFilter(rule: PromRuleDTO, filterState: RulesFilter) {
  const { name, labels = {}, health, type } = rule;

  const nameLower = name.toLowerCase();

  // Free form words filter (matches if any word is part of the rule name)
  if (filterState.freeFormWords.length > 0 && !filterState.freeFormWords.some((word) => nameLower.includes(word))) {
    return false;
  }

  // Rule name filter (exact match)
  if (filterState.ruleName && !nameLower.includes(filterState.ruleName)) {
    return false;
  }

  // Labels filter
  if (filterState.labels.length > 0) {
    const matchers = compact(filterState.labels.map(looseParseMatcher));
    const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(labels, matchers);

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

  // Rule type filter
  if (filterState.ruleType && type !== filterState.ruleType) {
    return false;
  }

  // Rule state filter (for alerting rules only)
  if (filterState.ruleState) {
    if (!prometheusRuleType.alertingRule(rule)) {
      return false;
    }
    if (rule.state !== filterState.ruleState) {
      return false;
    }
  }

  // Rule health filter
  if (filterState.ruleHealth && health !== filterState.ruleHealth) {
    return false;
  }

  // Dashboard UID filter
  if (filterState.dashboardUid) {
    if (!prometheusRuleType.alertingRule(rule)) {
      return false;
    }

    const dashboardAnnotation = rule.annotations?.[Annotation.dashboardUID];
    if (dashboardAnnotation !== filterState.dashboardUid) {
      return false;
    }
  }

  // Plugins filter - hide plugin-provided rules when set to 'hide'
  if (filterState.plugins === 'hide' && isPluginProvidedRule(rule)) {
    return false;
  }

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
const mapDataSourceNamesToUids = memoize(
  (names: string[]): string[] => {
    return names.map((name) => attempt(getDatasourceAPIUid, name)).filter(isString);
  },
  { maxSize: 1 }
);
