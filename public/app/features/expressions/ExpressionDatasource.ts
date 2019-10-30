import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
} from '@grafana/ui';
import { ExpressionQuery, GELQueryType } from './types';
import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { Observable, from } from 'rxjs';
import { config } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { gelResponseToDataFrames } from './util';

/**
 * This is a singleton instance that just pretends to be a DataSource
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

    let expressionCount = 0;
    const orgId = (window as any).grafanaBootData.user.orgId;
    const queries = targets.map(q => {
      if (q.datasource === ExpressionDatasourceID) {
        expressionCount++;
        return {
          ...q,
          datasourceId: this.id,
          orgId,
        };
      }
      const dsName = q.datasource && q.datasource !== 'default' ? q.datasource : config.defaultDatasource;
      const ds = config.datasources[dsName];
      if (!ds) {
        throw new Error('Unknown Datasource: ' + q.datasource);
      }
      return {
        ...q,
        datasourceId: ds.id,
        intervalMs,
        maxDataPoints,
        orgId,
      };
    });
    const req: Promise<DataQueryResponse> = getBackendSrv()
      .post('/api/ds/query', {
        from: range.from.valueOf().toString(),
        to: range.to.valueOf().toString(),
        queries: queries,
        intervalMs,
        maxDataPoints,
        range,
        expressionCount,
      })
      .then((rsp: any) => {
        return { data: gelResponseToDataFrames(rsp) } as DataQueryResponse;
      });
    return from(req);
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
expressionDatasource.meta = {
  id: ExpressionDatasourceID,
} as DataSourcePluginMeta;
expressionDatasource.components = {
  QueryEditor: ExpressionQueryEditor,
};
