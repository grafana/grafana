import { SceneDataQuery } from '@grafana/scenes';

import { METRIC_NAME } from '../constants';

import { getDataQuery } from './utils';

/** Time series for the summary bar chart: count by alertstate */
export function summaryChartQuery(filter: string): SceneDataQuery {
  return getDataQuery(`count by (alertstate) (${METRIC_NAME}{${filter}})`, {
    legendFormat: '{{alertstate}}',
  });
}

/** Range table query (A) for tree rows + deduplicated instant query (B) for badge counts */
export function getWorkbenchQueries(countBy: string, filter: string): [SceneDataQuery, SceneDataQuery] {
  return [
    getDataQuery(`count by (${countBy}) (${METRIC_NAME}{${filter}})`, {
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

/** Instance timeseries for a specific alert rule */
export function alertRuleInstancesQuery(ruleUID: string, filter: string): SceneDataQuery {
  const filters = filter ? `grafana_rule_uid="${ruleUID}",${filter}` : `grafana_rule_uid="${ruleUID}"`;
  return getDataQuery(
    `count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) (${METRIC_NAME}{${filters}})`,
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
  const firingFilter = filter ? `alertstate="firing",${filter}` : 'alertstate="firing"';
  const pendingFilter = filter ? `alertstate="pending",${filter}` : 'alertstate="pending"';
  return (
    `last_over_time(${METRIC_NAME}{${firingFilter}}[$__range]) or ` +
    `(last_over_time(${METRIC_NAME}{${pendingFilter}}[$__range]) ` +
    `unless ignoring(alertstate, grafana_alertstate) ` +
    `last_over_time(${METRIC_NAME}{${firingFilter}}[$__range]))`
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
