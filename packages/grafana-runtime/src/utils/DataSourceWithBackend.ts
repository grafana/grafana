import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataQuery,
  DataSourceJsonData,
  ScopedVars,
} from '@grafana/data';
import { Observable, from, of } from 'rxjs';
import { config } from '..';
import { getBackendSrv } from '../services';
import { toDataQueryResponse } from './queryResponse';

const ExpressionDatasourceID = '__expr__';

/**
 * Describes the current health status of a data source plugin.
 *
 * @public
 */
export enum HealthStatus {
  Unknown = 'UNKNOWN',
  OK = 'OK',
  Error = 'ERROR',
}

/**
 * Describes the payload returned when checking the health of a data source
 * plugin.
 *
 * @public
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  details?: Record<string, any>;
}

/**
 * Extend this class to implement a data source plugin that is depending on the Grafana
 * backend API.
 *
 * @public
 */
export class DataSourceWithBackend<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<TOptions>) {
    super(instanceSettings);
  }

  /**
   * Ideally final -- any other implementation may not work as expected
   */
  query(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse> {
    const { intervalMs, maxDataPoints, range, requestId } = request;
    const orgId = config.bootData.user.orgId;
    let targets = request.targets;
    if (this.filterQuery) {
      targets = targets.filter(q => this.filterQuery!(q));
    }
    const queries = targets.map(q => {
      let datasourceId = this.id;
      if (q.datasource === ExpressionDatasourceID) {
        return {
          ...q,
          datasourceId,
          orgId,
        };
      }
      if (q.datasource) {
        const dsName = q.datasource === 'default' ? config.defaultDatasource : q.datasource;
        const ds = config.datasources[dsName];
        if (!ds) {
          throw new Error('Unknown Datasource: ' + q.datasource);
        }
        datasourceId = ds.id;
      }
      return {
        ...this.applyTemplateVariables(q, request.scopedVars),
        datasourceId,
        intervalMs,
        maxDataPoints,
        orgId,
      };
    });

    // Return early if no queries exist
    if (!queries.length) {
      return of({ data: [] });
    }

    const body: any = {
      queries,
    };
    if (range) {
      body.range = range;
      body.from = range.from.valueOf().toString();
      body.to = range.to.valueOf().toString();
    }

    const req: Promise<DataQueryResponse> = getBackendSrv()
      .datasourceRequest({
        url: '/api/ds/query',
        method: 'POST',
        data: body,
        requestId,
      })
      .then((rsp: any) => {
        const dqs = toDataQueryResponse(rsp);
        if (this.processResponse) {
          return this.processResponse(dqs);
        }
        return dqs;
      })
      .catch(err => {
        err.isHandled = true; // Avoid extra popup warning
        const dqs = toDataQueryResponse(err);
        if (this.processResponse) {
          return this.processResponse(dqs);
        }
        return dqs;
      });

    return from(req);
  }

  /**
   * Optionally augment the response before returning the results to the
   *
   * NOTE: this was added in 7.1 for azure, and will be removed in 7.2
   * when the entire response pipeline is Observable
   *
   * @internal
   */
  processResponse?(res: DataQueryResponse): Promise<DataQueryResponse>;

  /**
   * Override to skip executing a query
   *
   * @virtual
   */
  filterQuery?(query: TQuery): boolean;

  /**
   * Override to apply template variables.  The result is usually also `TQuery`, but sometimes this can
   * be used to modify the query structure before sending to the backend.
   *
   * NOTE: if you do modify the structure or use template variables, alerting queries may not work
   * as expected
   *
   * @virtual
   */
  applyTemplateVariables(query: TQuery, scopedVars: ScopedVars): Record<string, any> {
    return query;
  }

  /**
   * Make a GET request to the datasource resource path
   */
  async getResource(path: string, params?: any): Promise<any> {
    return getBackendSrv().get(`/api/datasources/${this.id}/resources/${path}`, params);
  }

  /**
   * Send a POST request to the datasource resource path
   */
  async postResource(path: string, body?: any): Promise<any> {
    return getBackendSrv().post(`/api/datasources/${this.id}/resources/${path}`, { ...body });
  }

  /**
   * Run the datasource healthcheck
   */
  async callHealthCheck(): Promise<HealthCheckResult> {
    return getBackendSrv()
      .get(`/api/datasources/${this.id}/health`)
      .then(v => {
        return v as HealthCheckResult;
      })
      .catch(err => {
        err.isHandled = true; // Avoid extra popup warning
        return err.data as HealthCheckResult;
      });
  }

  /**
   * Checks the plugin health
   */
  async testDatasource(): Promise<any> {
    return this.callHealthCheck().then(res => {
      if (res.status === HealthStatus.OK) {
        return {
          status: 'success',
          message: res.message,
        };
      }
      return {
        status: 'fail',
        message: res.message,
      };
    });
  }
}
