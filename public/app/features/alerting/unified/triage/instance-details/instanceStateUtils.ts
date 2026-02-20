import { useMemo } from 'react';

import { DataFrame, Labels } from '@grafana/data';
import { useQueryRunner } from '@grafana/scenes-react';

import { DATASOURCE_UID, METRIC_NAME } from '../constants';

/** Escape a label value for use in a Prometheus selector (double-quoted). */
function escapePrometheusLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Builds a PromQL selector for GRAFANA_ALERTS that matches this instance
 * (grafana_rule_uid + instance labels). Used to query the current alert state.
 */
export function buildInstanceStateQueryExpr(ruleUID: string, instanceLabels: Labels): string {
  const parts: string[] = [`grafana_rule_uid="${escapePrometheusLabelValue(ruleUID)}"`];
  for (const [k, v] of Object.entries(instanceLabels)) {
    if (k && v != null && v !== '' && !k.startsWith('__')) {
      parts.push(`${k}="${escapePrometheusLabelValue(String(v))}"`);
    }
  }
  return `${METRIC_NAME}{${parts.join(',')}}`;
}

const GRAFANA_ALERTSTATE_LABEL = 'grafana_alertstate';

/**
 * Reads grafana_alertstate from the first series in the query result.
 * The backend writes it lowercase (nodata, error, alerting, pending, recovering).
 */
export function getInstanceStateFromMetricSeries(series: DataFrame[] | undefined): 'nodata' | 'error' | null {
  if (!series?.length) {
    return null;
  }
  const frame = series[0];
  const valueField = frame.fields.find((f) => f.type !== 'time');
  const stateLabel = valueField?.labels?.[GRAFANA_ALERTSTATE_LABEL];
  if (typeof stateLabel !== 'string') {
    return null;
  }
  const normalized = stateLabel.toLowerCase();
  return normalized === 'nodata' || normalized === 'error' ? normalized : null;
}

export type InstanceAlertState = 'nodata' | 'error' | null;

/**
 * Queries GRAFANA_ALERTS for the current instance state when state history Prometheus is configured.
 * Returns nodata/error when the instance is in that state, otherwise null.
 */
export function useInstanceAlertState(ruleUID: string, instanceLabels: Labels): InstanceAlertState {
  const query = useMemo(() => {
    if (!DATASOURCE_UID) {
      return null;
    }
    const expr = buildInstanceStateQueryExpr(ruleUID, instanceLabels);
    return { refId: 'state', expr, instant: true, datasource: { type: 'prometheus' as const, uid: DATASOURCE_UID } };
  }, [ruleUID, instanceLabels]);

  const runner = useQueryRunner({
    datasource: { uid: DATASOURCE_UID ?? '' },
    queries: query ? [query] : [],
  });
  const { data } = runner.useState();

  return useMemo(() => {
    if (!DATASOURCE_UID || !query || !data?.series) {
      return null;
    }
    return getInstanceStateFromMetricSeries(data.series);
  }, [query, data?.series]);
}
