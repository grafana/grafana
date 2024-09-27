import { Scope, ScopeFilterOperator, ScopeSpecFilter } from '@grafana/data';

import { QueryBuilderLabelFilter } from './querybuilder/shared/types';

const opMap: Record<ScopeFilterOperator, string> = {
  equals: '=',
  'not-equals': '!=',
  'regex-match': '=~',
  'regex-not-match': '!~',
  'one-of': '=|',
  'not-one-of': '!=|',
} as const;

export function scopesFiltersToPrometheusFilters(filters: ScopeSpecFilter[]): QueryBuilderLabelFilter[] {
  return filters.map((filter) => ({
    label: filter.key,
    value: filter.value,
    op: opMap[filter.operator],
  }));
}

export function scopesToPrometheusFilters(scopes: Scope[]): QueryBuilderLabelFilter[] {
  return (
    scopes?.reduce<QueryBuilderLabelFilter[]>((acc, scope) => {
      acc.push(...scopesFiltersToPrometheusFilters(scope.spec.filters));

      return acc;
    }, []) ?? []
  );
}
