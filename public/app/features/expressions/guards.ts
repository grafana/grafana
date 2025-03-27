import { isExpressionReference } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { ExpressionQuery, ExpressionQueryType, ReducerType } from './types';

export const isExpressionQuery = (dataQuery?: DataQuery): dataQuery is ExpressionQuery => {
  if (!dataQuery) {
    return false;
  }

  if (isExpressionReference(dataQuery.datasource)) {
    return true;
  }

  const expression = dataQuery as ExpressionQuery;

  if (typeof expression.type !== 'string') {
    return false;
  }
  return Object.values(ExpressionQueryType).includes(expression.type);
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
