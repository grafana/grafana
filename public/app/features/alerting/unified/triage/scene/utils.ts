import { uniqueId } from 'lodash';

import { TimeRange } from '@grafana/data';
import { SceneDataQuery, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { Domain } from '../types';

export const DS_UID = 'gdev-prometheus';
export const METRIC_NAME = 'GRAFANA_ALERTS';
export const DEFAULT_FIELDS = ['alertname', 'grafana_folder', 'grafana_rule_uid', 'alertstate'];

// @TODO figure out how we can grab the datasource ref from the Grafana config
export function getQueryRunner(expression: string, options?: Partial<SceneDataQuery>): SceneQueryRunner {
  return new SceneQueryRunner({
    key: uniqueId('triage-request-'),
    queries: [getDataQuery(expression, options)],
  });
}

export function getDataQuery(expression: string, options?: Partial<SceneDataQuery>): SceneDataQuery {
  const datasourceRef: DataSourceRef = {
    type: 'prometheus',
    uid: DS_UID,
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
