import { TimeRange } from '@grafana/data';
import { SceneDataQuery } from '@grafana/scenes';
import { useVariableValue } from '@grafana/scenes-react';
import { DataSourceRef } from '@grafana/schema';

import { DATASOURCE_UID, METRIC_NAME, VARIABLES } from '../constants';
import { Domain } from '../types';

export function getDataQuery(expression: string, options?: Partial<SceneDataQuery>): SceneDataQuery {
  const datasourceRef: DataSourceRef = {
    type: 'prometheus',
    uid: DATASOURCE_UID,
  };

  const query: SceneDataQuery = {
    refId: 'query',
    expr: expression,
    instant: false,
    datasource: datasourceRef,
    ...options,
  };

  return query;
}

/**
 * Turns an array of "groupBy" keys into a Prometheus matcher such as key!="",key2!="" .
 * This way we can show only instances that have a label that was grouped on.
 */
export function stringifyGroupFilter(groupBy: string[]) {
  return groupBy.map((key) => `${key}!=""`).join(',');
}

export const defaultTimeRange = {
  from: 'now-4h',
  to: 'now',
} as const;

export function convertTimeRangeToDomain(timeRange: TimeRange): Domain {
  return [timeRange.from.toDate(), timeRange.to.toDate()];
}

/**
 * This hook will create a Prometheus label matcher string from the "groupBy" and "filters" variables
 */
export function useQueryFilter(): string {
  const [filters = ''] = useVariableValue<string>(VARIABLES.filters);
  return filters;
}

/**
 * Builds a PromQL expression that counts deduplicated alert instances over the selected time range.
 * Uses last_over_time to capture all instances active during the range, and `unless` to
 * remove pending instances that also had a corresponding firing series.
 * Firing takes priority over pending — instances that transitioned between states are
 * counted only once in their firing state.
 */
export function buildDeduplicatedExpr(countBy: string, filter: string): string {
  const firingFilter = filter ? `alertstate="firing",${filter}` : 'alertstate="firing"';
  const pendingFilter = filter ? `alertstate="pending",${filter}` : 'alertstate="pending"';
  return (
    `count by (${countBy}) (` +
    `last_over_time(${METRIC_NAME}{${firingFilter}}[$__range]) or ` +
    `(last_over_time(${METRIC_NAME}{${pendingFilter}}[$__range]) ` +
    `unless ignoring(alertstate, grafana_alertstate) ` +
    `last_over_time(${METRIC_NAME}{${firingFilter}}[$__range])))`
  );
}
