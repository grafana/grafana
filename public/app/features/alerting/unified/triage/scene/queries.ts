import { type SceneDataQuery } from '@grafana/scenes';

import { parsePromQLStyleMatcherLooseSafe, quoteWithEscape } from '../../utils/matchers';
import { COMBINED_FILTER_LABEL_KEYS, METRIC_NAME } from '../constants';

import { getDataQuery } from './utils';

type MatcherOperator = '=' | '!=' | '=~' | '!~';

interface MatcherExpr {
  name: string;
  operator: MatcherOperator;
  value: string;
}

function toMatcherOperator({ isRegex, isEqual }: { isRegex: boolean; isEqual: boolean }): MatcherOperator {
  if (isRegex) {
    return isEqual ? '=~' : '!~';
  }
  return isEqual ? '=' : '!=';
}

function parseFilterMatchers(filter: string): MatcherExpr[] {
  if (!filter.trim()) {
    return [];
  }

  return parsePromQLStyleMatcherLooseSafe(filter).map((matcher) => ({
    name: matcher.name,
    operator: toMatcherOperator(matcher),
    value: matcher.value,
  }));
}

function serializeMatchers(matchers: MatcherExpr[]): string {
  return matchers.map((m) => `${m.name}${m.operator}${quoteWithEscape(m.value)}`).join(',');
}

/**
 * Exported for use in direct Prometheus queries (e.g. predefined time range stats hook).
 *
 * Builds one or more metric selectors from the current ad-hoc filter string.
 *
 * Combined filters use a single user-facing key (for example `service`) while
 * alert series may have one of several backing label keys (`service`, `service_name`).
 * We expand those matchers into OR selectors so filtering is consistent.
 */
export function buildMetricSelectors(filter: string, extraMatchers: MatcherExpr[] = []): string[] {
  const allMatchers = [...parseFilterMatchers(filter), ...extraMatchers];
  const combinedMatchers = Object.entries(COMBINED_FILTER_LABEL_KEYS)
    .map(([canonicalKey, labelKeys]) => ({
      canonicalKey,
      labelKeys,
      matchers: allMatchers.filter((m) => m.name === canonicalKey),
    }))
    .filter((entry) => entry.matchers.length > 0);

  const combinedCanonicalKeys = new Set(combinedMatchers.map((entry) => entry.canonicalKey));
  const baseMatchers = allMatchers.filter((m) => !combinedCanonicalKeys.has(m.name));

  let branches: MatcherExpr[][] = [baseMatchers];
  for (const entry of combinedMatchers) {
    branches = branches.flatMap((branch) =>
      entry.labelKeys.map((labelKey) => [
        ...branch,
        ...entry.matchers.map((matcher) => ({
          ...matcher,
          name: labelKey,
        })),
      ])
    );
  }

  return branches.map((branchMatchers) => `${METRIC_NAME}{${serializeMatchers(branchMatchers)}}`);
}

export function orSelectors(selectors: string[]): string {
  if (selectors.length === 1) {
    return selectors[0];
  }
  return `(${selectors.join(' or ')})`;
}

/** Time series for the summary bar chart: count by alertstate */
export function summaryChartQuery(filter: string): SceneDataQuery {
  return getDataQuery(`count by (alertstate) (${orSelectors(buildMetricSelectors(filter))})`, {
    legendFormat: '{{alertstate}}',
  });
}

/** Range table query (A) for tree rows + deduplicated instant query (B) for badge counts */
export function getWorkbenchQueries(countBy: string, filter: string): [SceneDataQuery, SceneDataQuery] {
  return [
    getDataQuery(`count by (${countBy}) (${orSelectors(buildMetricSelectors(filter))})`, {
      refId: 'A',
      format: 'table',
    }),
    getDataQuery(getAlertsSummariesQuery(countBy, filter), {
      refId: 'B',
      instant: true,
      range: false,
      format: 'table',
    }),
  ];
}

/** Deduplicated instant count by alertstate for summary instance counts */
export function summaryInstanceCountQuery(filter: string): SceneDataQuery {
  return getDataQuery(getAlertsSummariesQuery('alertstate', filter), { instant: true, format: 'table' });
}

/** Deduplicated instant count by rule fields + alertstate for summary rule counts */
export function summaryRuleCountQuery(filter: string): SceneDataQuery {
  return getDataQuery(getAlertsSummariesQuery('alertname, grafana_folder, grafana_rule_uid, alertstate', filter), {
    instant: true,
    format: 'table',
  });
}

/** Instance timeseries for a specific alert rule, optionally scoped to parent group labels. */
export function alertRuleInstancesQuery(
  ruleUID: string,
  filter: string,
  groupLabels: Record<string, string> = {}
): SceneDataQuery {
  const groupMatchers: MatcherExpr[] = Object.entries(groupLabels).map(([name, value]) => ({
    name,
    operator: '=' as const,
    value,
  }));

  const selectors = buildMetricSelectors(filter, [
    { name: 'grafana_rule_uid', operator: '=', value: ruleUID },
    ...groupMatchers,
  ]);

  return getDataQuery(
    `count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) (${orSelectors(selectors)})`,
    { format: 'timeseries', legendFormat: '{{alertstate}}' }
  );
}

/**
 * Returns a PromQL expression that produces one entry per unique alert instance,
 * deduplicated over the given range.
 *
 * Uses `last_over_time` to capture all instances active during the range, then
 * `unless` to remove pending instances that also had a corresponding firing series.
 * Firing takes priority over pending — instances that transitioned between states are
 * counted only once in their firing state.
 *
 * @param range - The PromQL range duration string, e.g. `$__range` (scene variable) or a
 *                literal like `4h` for direct Prometheus queries outside the scene runner.
 */
export function uniqueAlertInstancesExpr(filter: string, range = '$__range'): string {
  const firingSelectors = buildMetricSelectors(filter, [{ name: 'alertstate', operator: '=', value: 'firing' }]);
  const pendingSelectors = buildMetricSelectors(filter, [{ name: 'alertstate', operator: '=', value: 'pending' }]);
  const firingExpr = orSelectors(firingSelectors.map((selector) => `last_over_time(${selector}[${range}])`));
  const pendingExpr = orSelectors(pendingSelectors.map((selector) => `last_over_time(${selector}[${range}])`));

  return (
    `${firingExpr} or ` + `(${pendingExpr} ` + `unless ignoring(alertstate, grafana_alertstate) ` + `${firingExpr})`
  );
}

function getAlertsSummariesQuery(countBy: string, filter: string): string {
  return `count by (${countBy}) (${uniqueAlertInstancesExpr(filter)})`;
}

/** Instant table query returning one row per unique alert instance (for label breakdown). */
export function uniqueAlertInstancesQuery(filter: string): SceneDataQuery {
  return getDataQuery(uniqueAlertInstancesExpr(filter), {
    instant: true,
    range: false,
    format: 'table',
  });
}
