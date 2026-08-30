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

function isNegativeOperator(operator: MatcherOperator): boolean {
  return operator === '!=' || operator === '!~';
}

/**
 * `cluster!=""` rules out no value, it only asks "does the series have a cluster label
 * set?". Any one of the label names can answer yes, so we treat it as an include.
 */
function excludesAValue(matcher: MatcherExpr): boolean {
  return isNegativeOperator(matcher.operator) && matcher.value !== '';
}

function renameMatchers(matchers: MatcherExpr[], name: string): MatcherExpr[] {
  return matchers.map((matcher) => ({ ...matcher, name }));
}

/**
 * Builds one or more metric selectors from the current ad-hoc filter string.
 *
 * A combined filter shows one key (`service`), but the series can carry the value under
 * any of a few label names (`service`, `service_name`), so every matcher on such a key
 * gets rewritten for each name:
 *
 * - Include (`=`, `=~`): one selector per label name, joined with `or`.
 * - Exclude (`!=`, `!~`): all names in a single selector. Separate `or` branches would
 *   let the excluded series back in, since Prometheus reads a missing label as empty —
 *   a series with `cluster="foo"` and no `cluster_name` passes `cluster_name!="foo"`.
 *
 * See `excludesAValue` for why `!=""` counts as an include.
 */
function buildMetricSelectors(filter: string, extraMatchers: MatcherExpr[] = []): string[] {
  const allMatchers = [...parseFilterMatchers(filter), ...extraMatchers];
  const combinedMatchers = Object.entries(COMBINED_FILTER_LABEL_KEYS)
    .map(([canonicalKey, labelKeys]) => {
      const matchers = allMatchers.filter((m) => m.name === canonicalKey);
      return {
        canonicalKey,
        labelKeys,
        matchers,
        branchedMatchers: matchers.filter((m) => !excludesAValue(m)),
        sharedMatchers: matchers.filter(excludesAValue),
      };
    })
    .filter((entry) => entry.matchers.length > 0);

  const combinedCanonicalKeys = new Set(combinedMatchers.map((entry) => entry.canonicalKey));
  const baseMatchers = allMatchers.filter((m) => !combinedCanonicalKeys.has(m.name));

  // Exclusions apply to every branch, so they live alongside the non-combined matchers.
  const expandedSharedMatchers = combinedMatchers.flatMap((entry) =>
    entry.labelKeys.flatMap((labelKey) => renameMatchers(entry.sharedMatchers, labelKey))
  );

  let branches: MatcherExpr[][] = [[...baseMatchers, ...expandedSharedMatchers]];
  for (const entry of combinedMatchers) {
    if (entry.branchedMatchers.length === 0) {
      continue;
    }
    branches = branches.flatMap((branch) =>
      entry.labelKeys.map((labelKey) => [...branch, ...renameMatchers(entry.branchedMatchers, labelKey)])
    );
  }

  return branches.map((branchMatchers) => `${METRIC_NAME}{${serializeMatchers(branchMatchers)}}`);
}

function orSelectors(selectors: string[]): string {
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
 * deduplicated over the selected time range (`$__range`).
 *
 * Uses `last_over_time` to capture all instances active during the range, then
 * `unless` to remove pending instances that also had a corresponding firing series.
 * Firing takes priority over pending — instances that transitioned between states are
 * counted only once in their firing state.
 */
function uniqueAlertInstancesExpr(filter: string): string {
  const firingSelectors = buildMetricSelectors(filter, [{ name: 'alertstate', operator: '=', value: 'firing' }]);
  const pendingSelectors = buildMetricSelectors(filter, [{ name: 'alertstate', operator: '=', value: 'pending' }]);
  const firingExpr = orSelectors(firingSelectors.map((selector) => `last_over_time(${selector}[$__range])`));
  const pendingExpr = orSelectors(pendingSelectors.map((selector) => `last_over_time(${selector}[$__range])`));

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
