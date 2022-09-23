import { merge, Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataQuery,
  DataSourceJsonData,
  ScopedVars,
  makeClassES5Compatible,
  DataFrame,
  parseLiveChannelAddress,
  getDataSourceRef,
  DataSourceRef,
  dataFrameToJSON,
} from '@grafana/data';

import { config } from '../config';
import {
  getBackendSrv,
  getDataSourceSrv,
  getGrafanaLiveSrv,
  StreamingFrameOptions,
  StreamingFrameAction,
} from '../services';

import { BackendDataSourceResponse, toDataQueryResponse } from './queryResponse';

/**
 * @internal
 */
export const ExpressionDatasourceRef = Object.freeze({
  type: '__expr__',
  uid: '__expr__',
  name: 'Expression',
});

/**
 * @internal
 */
export function isExpressionReference(ref?: DataSourceRef | string | null): boolean {
  if (!ref) {
    return false;
  }
  const v = (ref as any).type ?? ref;
  return v === ExpressionDatasourceRef.type || v === '-100'; // -100 was a legacy accident that should be removed
}

export class HealthCheckError extends Error {
  details: HealthCheckResultDetails;

  constructor(message: string, details: HealthCheckResultDetails) {
    super(message);
    this.details = details;
    this.name = 'HealthCheckError';
  }
}

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
 * Describes the details in the payload returned when checking the health of a data source
 * plugin.
 *
 * If the 'message' key exists, this will be displayed in the error message in DataSourceSettingsPage
 * If the 'verboseMessage' key exists, this will be displayed in the expandable details in the error message in DataSourceSettingsPage
 *
 * @public
 */
export type HealthCheckResultDetails = Record<string, any> | undefined;

/**
 * Describes the payload returned when checking the health of a data source
 * plugin.
 *
 * @public
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  details: HealthCheckResultDetails;
}

/**
 * Extend this class to implement a data source plugin that is depending on the Grafana
 * backend API.
 *
 * @public
 */
class DataSourceWithBackend<
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
    const { intervalMs, maxDataPoints, range, requestId, hideFromInspector = false } = request;
    let targets = request.targets;

    if (this.filterQuery) {
      targets = targets.filter((q) => this.filterQuery!(q));
    }

    const queries = targets.map((q) => {
      let datasource = this.getRef();
      let datasourceId = this.id;

      if (isExpressionReference(q.datasource)) {
        return {
          ...q,
          datasource: ExpressionDatasourceRef,
        };
      }

      if (q.datasource) {
        const ds = getDataSourceSrv().getInstanceSettings(q.datasource, request.scopedVars);

        if (!ds) {
          throw new Error(`Unknown Datasource: ${JSON.stringify(q.datasource)}`);
        }

        datasource = ds.rawRef ?? getDataSourceRef(ds);
        datasourceId = ds.id;
      }

      return {
        ...this.applyTemplateVariables(q, request.scopedVars),
        datasource,
        datasourceId, // deprecated!
        intervalMs,
        maxDataPoints,
      };
    });

    // Return early if no queries exist
    if (!queries.length) {
      return of({ data: [] });
    }

    const body: any = { queries };

    if (range) {
      body.range = range;
      body.from = range.from.valueOf().toString();
      body.to = range.to.valueOf().toString();
    }

    if (config.featureToggles.queryOverLive) {
      return getGrafanaLiveSrv().getQueryData({
        request,
        body,
      });
    }

    return getBackendSrv()
      .fetch<BackendDataSourceResponse>({
        url: '/api/ds/query',
        method: 'POST',
        data: body,
        requestId,
        hideFromInspector,
      })
      .pipe(
        switchMap((raw) => {
          const rsp = toDataQueryResponse(raw, queries as DataQuery[]);
          // Check if any response should subscribe to a live stream
          if (rsp.data?.length && rsp.data.find((f: DataFrame) => f.meta?.channel)) {
            return toStreamingDataResponse(rsp, request, this.streamOptionsProvider);
          }
          return of(rsp);
        }),
        catchError((err) => {
          return of(toDataQueryResponse(err));
        })
      );
  }

  /**
   * Apply template variables for explore
   */
  interpolateVariablesInQueries(queries: TQuery[], scopedVars: ScopedVars | {}): TQuery[] {
    return queries.map((q) => this.applyTemplateVariables(q, scopedVars) as TQuery);
  }

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
   * Optionally override the streaming behavior
   */
  streamOptionsProvider: StreamOptionsProvider<TQuery> = standardStreamOptionsProvider;

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
      .request({ method: 'GET', url: `/api/datasources/${this.id}/health`, showErrorAlert: false })
      .then((v) => {
        return v as HealthCheckResult;
      })
      .catch((err) => {
        return err.data as HealthCheckResult;
      });
  }

  /**
   * Checks the plugin health
   * see public/app/features/datasources/state/actions.ts for what needs to be returned here
   */
  async testDatasource(): Promise<any> {
    return this.callHealthCheck().then((res) => {
      if (res.status === HealthStatus.OK) {
        return {
          status: 'success',
          message: res.message,
        };
      }

      throw new HealthCheckError(res.message, res.details);
    });
  }
}

/**
 * @internal exported for tests
 */
export function toStreamingDataResponse<TQuery extends DataQuery = DataQuery>(
  rsp: DataQueryResponse,
  req: DataQueryRequest<TQuery>,
  getter: (req: DataQueryRequest<TQuery>, frame: DataFrame) => Partial<StreamingFrameOptions>
): Observable<DataQueryResponse> {
  const live = getGrafanaLiveSrv();
  if (!live) {
    return of(rsp); // add warning?
  }

  const staticdata: DataFrame[] = [];
  const streams: Array<Observable<DataQueryResponse>> = [];
  for (const f of rsp.data) {
    const addr = parseLiveChannelAddress(f.meta?.channel);
    if (addr) {
      const frame = f as DataFrame;
      streams.push(
        live.getDataStream({
          addr,
          buffer: getter(req, frame),
          frame: dataFrameToJSON(f),
        })
      );
    } else {
      staticdata.push(f);
    }
  }
  if (staticdata.length) {
    streams.push(of({ ...rsp, data: staticdata }));
  }
  if (streams.length === 1) {
    return streams[0]; // avoid merge wrapper
  }
  return merge(...streams);
}

/**
 * This allows data sources to customize the streaming connection query
 *
 * @public
 */
export type StreamOptionsProvider<TQuery extends DataQuery = DataQuery> = (
  request: DataQueryRequest<TQuery>,
  frame: DataFrame
) => Partial<StreamingFrameOptions>;

/**
 * @public
 */
export const standardStreamOptionsProvider: StreamOptionsProvider = (request: DataQueryRequest, frame: DataFrame) => {
  const opts: Partial<StreamingFrameOptions> = {
    maxLength: request.maxDataPoints ?? 500,
    action: StreamingFrameAction.Append,
  };

  // For recent queries, clamp to the current time range
  if (request.rangeRaw?.to === 'now') {
    opts.maxDelta = request.range.to.valueOf() - request.range.from.valueOf();
  }
  return opts;
};

//@ts-ignore
DataSourceWithBackend = makeClassES5Compatible(DataSourceWithBackend);

export { DataSourceWithBackend };
