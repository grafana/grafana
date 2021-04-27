import { DataQuery } from '@grafana/data';
import { ExpressionDatasourceID } from './ExpressionDatasource';
import { ExpressionQuery } from './types';

export const isExpressionQuery = (dataQuery?: DataQuery): dataQuery is ExpressionQuery => {
  return dataQuery?.datasource === ExpressionDatasourceID;
};
