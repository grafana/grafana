import { useMemo } from 'react';

import { type DataFrame, type Labels } from '@grafana/data';
import { useQueryRunner } from '@grafana/scenes-react';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

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

// Maps the lowercase grafana_alertstate label values to GrafanaAlertState title-case enum values.
const ALERTSTATE_LABEL_TO_GRAFANA_STATE: Record<string, GrafanaAlertState> = {
  alerting: GrafanaAlertState.Alerting,
  pending: GrafanaAlertState.Pending,
  normal: GrafanaAlertState.Normal,
  recovering: GrafanaAlertState.Recovering,
  nodata: GrafanaAlertState.NoData,
  error: GrafanaAlertState.Error,
};

/**
 * Reads grafana_alertstate from the first series in the query result and maps it to GrafanaAlertState.
 * The backend writes it lowercase (alerting, pending, normal, recovering, nodata, error).
 */
export function getInstanceStateFromMetricSeries(series: DataFrame[] | undefined): GrafanaAlertState | null {
  if (!series?.length) {
    return null;
  }
  const frame = series[0];
  const valueField = frame.fields.find((f) => f.type !== 'time');
  const stateLabel = valueField?.labels?.[GRAFANA_ALERTSTATE_LABEL];
  if (typeof stateLabel !== 'string') {
    return null;
  }
  return ALERTSTATE_LABEL_TO_GRAFANA_STATE[stateLabel.toLowerCase()] ?? null;
}

/**
 * Queries GRAFANA_ALERTS for the current instance state when state history Prometheus is configured.
 * Returns the full GrafanaAlertState (Alerting, Pending, Normal, NoData, Error, Recovering), or null
 * if the datasource is not configured or the state cannot be determined.
 */
export function useInstanceAlertState(ruleUID: string, instanceLabels: Labels): GrafanaAlertState | null {
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
