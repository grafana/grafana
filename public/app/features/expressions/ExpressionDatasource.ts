import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
} from '@grafana/data';
import { ExpressionQuery, GELQueryType } from './types';
import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { Observable, from } from 'rxjs';
import { config } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';
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
    const req: Promise<DataQueryResponse> = getBackendSrv()
      .post('/api/tsdb/query/v2', {
        from: range.from.valueOf().toString(),
        to: range.to.valueOf().toString(),
        queries: queries,
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
