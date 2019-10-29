import { DataSourceApi, DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/ui';
import { ExpressionQuery, GELQueryType } from './types';
import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { Observable, of } from 'rxjs';

/**
 * This is a singleton that should not actually be instanciated
 */
export class ExpressionDatasourceApi extends DataSourceApi<ExpressionQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  getCollapsedText(query: ExpressionQuery) {
    return `Expression: ${query.type}`;
  }

  query(options: DataQueryRequest<ExpressionQuery>): Observable<DataQueryResponse> {
    const data: DataQueryResponse = { data: [] };
    return of(data); // observable
  }

  testDatasource() {
    return Promise.resolve({});
  }

  newQuery(): ExpressionQuery {
    return {
      refId: '--', // Replaced with query
      type: GELQueryType.math,
      datasource: ExpressionDatasourceID,
    };
  }
}

export const ExpressionDatasourceID = '__expr__';
export const expressionDatasource = new ExpressionDatasourceApi({
  id: -100,
  name: ExpressionDatasourceID,
} as DataSourceInstanceSettings);

expressionDatasource.components = {
  QueryEditor: ExpressionQueryEditor,
};
