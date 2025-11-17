import { attempt, compact, isString } from 'lodash';
import memoize from 'micro-memoize';

import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { GrafanaPromRulesOptions } from '../../api/prometheusApi';
import { shouldUseBackendFilters } from '../../featureToggles';
import { RulesFilter } from '../../search/rulesSearchParser';
import { labelsMatchMatchers } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { fuzzyMatches } from '../../utils/fuzzySearch';
import { parseMatcher } from '../../utils/matchers';
import { isPluginProvidedRule, prometheusRuleType } from '../../utils/rules';
import { normalizeHealth } from '../components/util';

type RuleFilterHandler = (rule: PromRuleDTO, filterState: RulesFilter) => boolean;
type GroupFilterHandler = (
  group: PromRuleGroupDTO,
  filterState: Pick<RulesFilter, 'namespace' | 'groupName'>
) => boolean;

type RuleFilterConfig = Record<
  Exclude<keyof RulesFilter, 'namespace' | 'groupName' | 'ruleSource'>,
  RuleFilterHandler | null
>;

type GroupFilterConfig = Record<keyof Pick<RulesFilter, 'namespace' | 'groupName'>, GroupFilterHandler | null>;

export function getGrafanaFilter(filterState: RulesFilter) {
  const normalizedFilterState = normalizeFilterState(filterState);
  const useBackendFilters = shouldUseBackendFilters();

  // Build title search for backend filtering
  const titleSearch = buildTitleSearch(normalizedFilterState);

  const backendFilter: GrafanaPromRulesOptions = {
    state: normalizedFilterState.ruleState ? [normalizedFilterState.ruleState] : [],
    health: normalizedFilterState.ruleHealth ? [normalizedFilterState.ruleHealth] : [],
    contactPoint: normalizedFilterState.contactPoint ?? undefined,
    title: useBackendFilters ? titleSearch : undefined,
    type: useBackendFilters ? normalizedFilterState.ruleType : undefined,
    dashboardUid: useBackendFilters ? normalizedFilterState.dashboardUid : undefined,
    searchGroupName: useBackendFilters ? normalizedFilterState.groupName : undefined,
  };

  const grafanaFilterProcessingConfig: RuleFilterConfig = {
    // When backend filtering is enabled, these filters are handled by the backend
    freeFormWords: useBackendFilters ? null : freeFormFilter,
    ruleName: useBackendFilters ? null : ruleNameFilter,
    ruleState: null,
    ruleType: useBackendFilters ? null : ruleTypeFilter,
    dataSourceNames: dataSourceNamesFilter,
    labels: labelsFilter,
    ruleHealth: null,
    dashboardUid: useBackendFilters ? null : dashboardUidFilter,
    plugins: pluginsFilter,
    contactPoint: null,
  };

  const grafanaGroupFilterConfig: GroupFilterConfig = {
    namespace: namespaceFilter,
    groupName: useBackendFilters ? null : groupNameFilter,
  };

  return {
    backendFilter,
    frontendFilter: {
      groupMatches: (group: PromRuleGroupDTO) => groupMatches(group, normalizedFilterState, grafanaGroupFilterConfig),
      ruleMatches: (rule: PromRuleDTO) => ruleMatches(rule, normalizedFilterState, grafanaFilterProcessingConfig),
    },
  };
}

export function getDatasourceFilter(filterState: RulesFilter) {
  const normalizedFilterState = normalizeFilterState(filterState);

  const dsRuleFilterConfig: RuleFilterConfig = {
    freeFormWords: freeFormFilter,
    ruleName: ruleNameFilter,
    ruleState: ruleStateFilter,
    ruleType: ruleTypeFilter,
    dataSourceNames: dataSourceNamesFilter,
    labels: labelsFilter,
    ruleHealth: ruleHealthFilter,
    dashboardUid: dashboardUidFilter,
    plugins: pluginsFilter,
    contactPoint: contactPointFilter,
  };

  const dsGroupFilterConfig: GroupFilterConfig = {
    namespace: namespaceFilter,
    groupName: groupNameFilter,
  };

  return {
    groupMatches: (group: PromRuleGroupDTO) => groupMatches(group, normalizedFilterState, dsGroupFilterConfig),
    ruleMatches: (rule: PromRuleDTO) => ruleMatches(rule, normalizedFilterState, dsRuleFilterConfig),
  };
}

/**
 * @returns True if the group matches the filter, false otherwise. Keeps rules intact
 */
function groupMatches(
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

function namespaceFilter(group: PromRuleGroupDTO, filterState: Pick<RulesFilter, 'namespace' | 'groupName'>): boolean {
  if (filterState.namespace && !fuzzyMatches(group.file, filterState.namespace)) {
    return false;
  }

  return true;
}

function groupNameFilter(group: PromRuleGroupDTO, filterState: Pick<RulesFilter, 'namespace' | 'groupName'>): boolean {
  if (filterState.groupName && !fuzzyMatches(group.name, filterState.groupName)) {
    return false;
  }

  return true;
}

/**
 * @returns True if the rule matches the filter, false otherwise
 */
function ruleMatches(rule: PromRuleDTO, filterState: RulesFilter, filterConfig: RuleFilterConfig) {
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

function freeFormFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.freeFormWords.length > 0) {
    const nameMatches = fuzzyMatches(rule.name, filterState.freeFormWords.join(' '));
    if (!nameMatches) {
      return false;
    }
  }

  return true;
}

function ruleNameFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.ruleName && !fuzzyMatches(rule.name, filterState.ruleName)) {
    return false;
  }

  return true;
}

function labelsFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
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

function ruleTypeFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.ruleType && rule.type !== filterState.ruleType) {
    return false;
  }

  return true;
}

function ruleStateFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
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

function ruleHealthFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  if (filterState.ruleHealth && normalizeHealth(rule.health) !== filterState.ruleHealth) {
    return false;
  }

  return true;
}

function contactPointFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
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

function dashboardUidFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
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

function pluginsFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
  // Plugins filter - hide plugin-provided rules when set to 'hide'
  if (filterState.plugins === 'hide' && isPluginProvidedRule(rule)) {
    return false;
  }

  return true;
}

function dataSourceNamesFilter(rule: PromRuleDTO, filterState: RulesFilter): boolean {
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

/**
 * Build title search parameter for backend filtering
 * Combines ruleName and freeFormWords into a single search string
 */
export function buildTitleSearch(filterState: RulesFilter): string | undefined {
  const titleParts: string[] = [];

  const ruleName = filterState.ruleName?.trim();
  if (ruleName) {
    titleParts.push(ruleName);
  }

  const freeFormSegment = filterState.freeFormWords
    .map((word) => word.trim())
    .filter(Boolean)
    .join(' ');

  if (freeFormSegment) {
    titleParts.push(freeFormSegment);
  }

  if (titleParts.length === 0) {
    return undefined;
  }

  return titleParts.join(' ');
}

/**
 * Normalize filter state for case-insensitive matching
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
