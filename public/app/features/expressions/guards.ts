import { DataQuery } from '@grafana/data';
import { ExpressionDatasourceRef } from '@grafana/runtime';
import { ExpressionQuery, ExpressionQueryType } from './types';

export const isExpressionQuery = (dataQuery?: DataQuery): dataQuery is ExpressionQuery => {
  if (!dataQuery) {
    return false;
  }

  if (dataQuery.datasource?.type === ExpressionDatasourceRef.type) {
    return true;
  }

  if (dataQuery.datasource === ExpressionDatasourceRef.type) {
    return true;
  }

  const expression = dataQuery as ExpressionQuery;

  if (typeof expression.type !== 'string') {
    return false;
  }
  return Object.values(ExpressionQueryType).includes(expression.type);
};
