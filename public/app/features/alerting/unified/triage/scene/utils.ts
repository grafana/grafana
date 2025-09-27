import { TimeRange } from '@grafana/data';
import { SceneDataQuery } from '@grafana/scenes';
import { useVariableValue, useVariableValues } from '@grafana/scenes-react';
import { DataSourceRef } from '@grafana/schema';

import { DATASOURCE_UID, VARIABLES } from '../constants';
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
  const [groupBy = []] = useVariableValues<string>(VARIABLES.groupBy);
  const [filters = ''] = useVariableValue<string>(VARIABLES.filters);

  const groupByFilter = stringifyGroupFilter(groupBy);
  const queryFilter = [groupByFilter, filters].filter((s) => Boolean(s)).join(',');

  return queryFilter;
}
