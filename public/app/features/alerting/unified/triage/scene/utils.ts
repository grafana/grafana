import { uniqueId } from 'lodash';

import { TimeRange } from '@grafana/data';
import { SceneDataQuery, SceneQueryRunner } from '@grafana/scenes';
import { useVariableValue, useVariableValues } from '@grafana/scenes-react';
import { DataSourceRef } from '@grafana/schema';

import { Domain } from '../types';

import { VARIABLES } from './constants';

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
  const [groupBy = []] = useVariableValues<string>(VARIABLES.groupBy);
  const [filters = ''] = useVariableValue<string>(VARIABLES.filters);

  const groupByFilter = stringifyGroupFilter(groupBy);
  const queryFilter = [groupByFilter, filters].filter((s) => Boolean(s)).join(',');

  return queryFilter;
}
