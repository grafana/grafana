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

/**
 * @returns True if the group matches the filter, false otherwise. Keeps rules intact
 */
export function groupFilter(
  group: PromRuleGroupDTO,
  filterState: Pick<RulesFilter, 'namespace' | 'groupName'>
): boolean {
  const { name, file } = group;
  const { namespace, groupName } = filterState;

  if (namespace && !fuzzyMatches(file, namespace)) {
    return false;
  }

  if (groupName && !fuzzyMatches(name, groupName)) {
    return false;
  }

  return true;
}

/**
 * @returns True if the rule matches the filter, false otherwise
 */
export function ruleFilter(rule: PromRuleDTO, filterState: RulesFilter) {
  const { name, labels = {}, health, type } = rule;

  if (filterState.freeFormWords.length > 0) {
    const nameMatches = fuzzyMatches(name, filterState.freeFormWords.join(' '));
    if (!nameMatches) {
      return false;
    }
  }

  if (filterState.ruleName && !fuzzyMatches(name, filterState.ruleName)) {
    return false;
  }

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

  if (filterState.ruleType && type !== filterState.ruleType) {
    return false;
  }

  if (filterState.ruleState) {
    if (!prometheusRuleType.alertingRule(rule)) {
      return false;
    }
    if (rule.state !== filterState.ruleState) {
      return false;
    }
  }

  if (filterState.ruleHealth && health !== filterState.ruleHealth) {
    return false;
  }

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
  // - gmaQueryDataSourceNames filter
  if ((filterState.gmaQueryDataSourceNames?.length || 0) > 0) {
    const isGrafanaRule = prometheusRuleType.grafana.rule(rule);
    if (isGrafanaRule) {
      try {
        const filterDatasourceUids = mapDataSourceNamesToUids(filterState.gmaQueryDataSourceNames || []);
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
