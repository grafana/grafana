import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataQuery,
  DataSourceJsonData,
} from '@grafana/data';
import { Observable, from } from 'rxjs';
import { config } from '..';
import { getBackendSrv } from '../services';

// Ideally internal (exported for consistency)
const ExpressionDatasourceID = '__expr__';

export class DataSourceWithBackend<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<TOptions>) {
    super(instanceSettings);
  }

  /**
   * Ideally final -- any other implementation would be wrong!
   */
  query(request: DataQueryRequest): Observable<DataQueryResponse> {
    const { targets, intervalMs, maxDataPoints, range } = request;

    let expressionCount = 0;
    const orgId = config.bootData.user.orgId;
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

    const body: any = {
      expressionCount,
      queries,
    };
    if (range) {
      body.range = range;
      body.from = range.from.valueOf().toString();
      body.to = range.to.valueOf().toString();
    }

    const req: Promise<DataQueryResponse> = getBackendSrv()
      .post('/api/ds/query', body)
      .then((rsp: any) => {
        return this.toDataQueryResponse(rsp);
      });
    return from(req);
  }

  /**
   * This makes the arrow library loading async.
   */
  async toDataQueryResponse(rsp: any): Promise<DataQueryResponse> {
    const { resultsToDataFrames } = await import(
      /* webpackChunkName: "apache-arrow-util" */ '@grafana/data/src/dataframe/ArrowDataFrame'
    );
    return { data: resultsToDataFrames(rsp) };
  }

  /**
   * Make a GET request to the datasource resource path
   */
  async getResource(path: string, params?: any): Promise<Record<string, any>> {
    return getBackendSrv().get(`/api/datasources/${this.id}/resources/${path}`, params);
  }

  /**
   * Send a POST request to the datasource resource path
   */
  async postResource(path: string, body?: any): Promise<Record<string, any>> {
    return getBackendSrv().post(`/api/datasources/${this.id}/resources/${path}`, { ...body });
  }

  testDatasource() {
    // TODO, this will call the backend healthcheck endpoint
    return Promise.resolve({});
  }
}
