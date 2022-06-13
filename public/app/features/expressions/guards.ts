import { DataQuery } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';

import { ExpressionQuery, ExpressionQueryType } from './types';

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
