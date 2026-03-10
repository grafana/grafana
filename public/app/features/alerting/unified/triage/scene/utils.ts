import { TimeRange } from '@grafana/data';
import { AdHocFiltersVariable, SceneDataQuery, SceneObject, sceneGraph } from '@grafana/scenes';
import { useVariableValue } from '@grafana/scenes-react';
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
  from: 'now-15m',
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

type AdHocFilterOperator = '=' | '!=' | '=~' | '!~' | '=|' | '!=|';

export function addOrReplaceFilter(
  sceneContext: SceneObject,
  key: string,
  operator: AdHocFilterOperator,
  value: string
) {
  const filtersVariable = sceneGraph.lookupVariable(VARIABLES.filters, sceneContext);
  if (filtersVariable instanceof AdHocFiltersVariable) {
    const currentFilters = filtersVariable.state.filters;
    const existingIndex = currentFilters.findIndex((f) => f.key === key);
    const newFilter = { key, operator, value };
    const updatedFilters =
      existingIndex >= 0
        ? currentFilters.map((f, i) => (i === existingIndex ? newFilter : f))
        : [...currentFilters, newFilter];
    filtersVariable.setState({ filters: updatedFilters });
  }
}
