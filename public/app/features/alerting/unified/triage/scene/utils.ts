import { TimeRange } from '@grafana/data';
import { PrometheusDatasource } from '@grafana/prometheus';
import { AdHocFiltersVariable, SceneDataQuery, SceneObject, sceneGraph } from '@grafana/scenes';
import { useSceneContext, useVariableValue } from '@grafana/scenes-react';
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

/**
 * Type guard that narrows an unknown value to `PrometheusDatasource`.
 * The parameter is typed as `unknown` rather than `DataSourceApi` because
 * `PrometheusDatasource` is not structurally assignable to the base class
 * (generic variance in `components`/`annotations` causes a TS2677 error).
 * Using `unknown` is safe here: `instanceof` performs the runtime check and
 * TypeScript narrows the type correctly at every call site.
 */
export function isPrometheusDatasource(ds: unknown): ds is PrometheusDatasource {
  return ds instanceof PrometheusDatasource;
}

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

export function removeFilter(sceneContext: SceneObject, key: string) {
  const filtersVariable = sceneGraph.lookupVariable(VARIABLES.filters, sceneContext);
  if (filtersVariable instanceof AdHocFiltersVariable) {
    const updatedFilters = filtersVariable.state.filters.filter((f) => f.key !== key);
    filtersVariable.setState({ filters: updatedFilters });
  }
}

/**
 * Returns the structured filters array from the AdHocFiltersVariable, reactively.
 */
function useAdHocFilters() {
  const sceneContext = useSceneContext();
  const filtersVariable = sceneGraph.lookupVariable(VARIABLES.filters, sceneContext);
  if (!(filtersVariable instanceof AdHocFiltersVariable)) {
    return [];
  }
  // .useState() subscribes to state changes and triggers re-renders
  return filtersVariable.useState().filters;
}

/**
 * Returns the current exact-match (=) value of a filter by key, or undefined if not set or not an exact match.
 */
export function useFilterValue(key: string): string | undefined {
  const filters = useAdHocFilters();
  const filter = filters.find((f) => f.key === key && f.operator === '=');
  return filter?.value;
}

/**
 * Returns true if the key has an "any value" regex filter (key=~".+").
 */
export function useIsAnyFilter(key: string): boolean {
  const filters = useAdHocFilters();
  return filters.some((f) => f.key === key && f.operator === '=~');
}

/**
 * Returns the set of label keys that currently have an exact-match (=) filter set.
 */
export function useExactFilterKeys(): Set<string> {
  const filters = useAdHocFilters();
  return new Set(filters.filter((f) => f.operator === '=').map((f) => f.key));
}
