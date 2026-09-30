import { isExpressionReference } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { type ExpressionQuery, ExpressionQueryType, type ReducerType } from './types';

export const isExpressionQuery = (dataQuery?: DataQuery): dataQuery is ExpressionQuery => {
  if (!dataQuery) {
    return false;
  }

  if (isExpressionReference(dataQuery.datasource)) {
    return true;
  }

  const expression: DataQuery & { type?: unknown } = dataQuery;

  if (typeof expression.type !== 'string') {
    return false;
  }
  return Object.values<string>(ExpressionQueryType).includes(expression.type);
};

export function isReducerType(value: string): value is ReducerType {
  return [
    'avg',
    'min',
    'max',
    'sum',
    'count',
    'last',
    'median',
    'diff',
    'diff_abs',
    'percent_diff',
    'percent_diff_abs',
    'count_non_null',
  ].includes(value);
}
