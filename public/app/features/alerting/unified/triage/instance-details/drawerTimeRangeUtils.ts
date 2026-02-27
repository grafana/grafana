import { maxBy } from 'lodash';

import type { TimeRange } from '@grafana/data';
import type { AlertQuery, GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { isAlertQueryOfAlertData } from '../../rule-editor/formProcessing';

/**
 * Returns the maximum evaluation window (seconds) required by the rule's data queries.
 * Only considers queries that have relativeTimeRange; returns 0 if none.
 */
export function getMaxQueryEvaluationWindowSeconds(rule: GrafanaRuleDefinition): number {
  if (!rule?.data?.length) {
    return 0;
  }
  const dataQueries = rule.data.filter((q: AlertQuery) => isAlertQueryOfAlertData(q));
  const queryWithMaxFrom = maxBy(dataQueries, (q) =>
    typeof q.relativeTimeRange?.from === 'number' ? q.relativeTimeRange.from : -Infinity
  );
  return queryWithMaxFrom && typeof queryWithMaxFrom.relativeTimeRange?.from === 'number'
    ? queryWithMaxFrom.relativeTimeRange.from
    : 0;
}

/**
 * True when the drawer's selected time range is shorter than the rule's query evaluation window,
 * in which case the graph may not show data.
 */
export function isDrawerRangeShorterThanQuery(rule: GrafanaRuleDefinition, timeRange: TimeRange): boolean {
  const requiredSeconds = getMaxQueryEvaluationWindowSeconds(rule);
  if (requiredSeconds <= 0) {
    return false;
  }
  const drawerDurationSeconds = (timeRange.to.valueOf() - timeRange.from.valueOf()) / 1000;
  return drawerDurationSeconds < requiredSeconds;
}
