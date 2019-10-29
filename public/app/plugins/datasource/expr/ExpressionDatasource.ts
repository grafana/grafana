import { DataSourceApi, DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/ui';
import { ExpressionQuery, GELQueryType } from './types';
import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { Observable, from } from 'rxjs';
import { getBackendSrv, config } from '@grafana/runtime';
import { gelResponseToDataFrames } from './util';

/**
 * This is a singleton that is not actually instanciated
 */
export class ExpressionDatasourceApi extends DataSourceApi<ExpressionQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  getCollapsedText(query: ExpressionQuery) {
    return `Expression: ${query.type}`;
  }

  query(request: DataQueryRequest): Observable<DataQueryResponse> {
    const { targets, intervalMs, maxDataPoints, range } = request;

    const orgId = (window as any).grafanaBootData.user.orgId;
    const queries = targets.map(q => {
      if (q.datasource === ExpressionDatasourceID) {
        return {
          ...q,
          datasourceId: this.id,
          orgId,
        };
      }
      const ds = config.datasources[q.datasource || config.defaultDatasource];
      return {
        ...q,
        datasourceId: ds.id,
        intervalMs,
        maxDataPoints,
        orgId,
        // ?? alias: templateSrv.replace(q.alias || ''),
      };
    });

    return from(
      getBackendSrv()
        .post('/api/ds', {
          from: range.from.valueOf().toString(),
          to: range.to.valueOf().toString(),
          queries: queries,
        })
        .then(res => {
          return { data: gelResponseToDataFrames(res) };
        })
    );
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
