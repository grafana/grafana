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
import { toDataQueryResponse } from './queryResponse';

const ExpressionDatasourceID = '__expr__';

/**
 * Describes the current healt status of a data source plugin.
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
  query(request: DataQueryRequest): Observable<DataQueryResponse> {
    const { targets, intervalMs, maxDataPoints, range, requestId } = request;
    const orgId = config.bootData.user.orgId;
    const queries = targets.map(q => {
      if (q.datasource === ExpressionDatasourceID) {
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
        ...this.applyTemplateVariables(q),
        datasourceId: ds.id,
        intervalMs,
        maxDataPoints,
        orgId,
      };
    });

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
        return toDataQueryResponse(rsp);
      })
      .catch(err => {
        err.isHandled = true; // Avoid extra popup warning
        return toDataQueryResponse(err);
      });

    return from(req);
  }

  /**
   * Override to apply template variables
   *
   * @virtual
   */
  applyTemplateVariables(query: DataQuery) {
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
