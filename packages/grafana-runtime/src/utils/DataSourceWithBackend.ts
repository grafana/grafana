import { lastValueFrom, merge, Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import {
  DataFrame,
  dataFrameToJSON,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceRef,
  getDataSourceRef,
  makeClassES5Compatible,
  parseLiveChannelAddress,
  ScopedVars,
} from '@grafana/data';

import { config } from '../config';
import {
  BackendSrvRequest,
  FetchResponse,
  getBackendSrv,
  getDataSourceSrv,
  getGrafanaLiveSrv,
  StreamingFrameAction,
  StreamingFrameOptions,
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
  const v = typeof ref === 'string' ? ref : ref.type;
  return v === ExpressionDatasourceRef.type || v === ExpressionDatasourceRef.name || v === '-100'; // -100 was a legacy accident that should be removed
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

// Internal for now
enum PluginRequestHeaders {
  PluginID = 'X-Plugin-Id', // can be used for routing
  DatasourceUID = 'X-Datasource-Uid', // can be used for routing/ load balancing
  DashboardUID = 'X-Dashboard-Uid', // mainly useful for debuging slow queries
  PanelID = 'X-Panel-Id', // mainly useful for debuging slow queries
  QueryGroupID = 'X-Query-Group-Id', // mainly useful to find related queries with query chunking
  FromExpression = 'X-Grafana-From-Expr', // used by datasources to identify expression queries
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
export type HealthCheckResultDetails = Record<string, unknown> | undefined;

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
    const { intervalMs, maxDataPoints, queryCachingTTL, range, requestId, hideFromInspector = false } = request;
    let targets = request.targets;

    if (this.filterQuery) {
      targets = targets.filter((q) => this.filterQuery!(q));
    }

    let hasExpr = false;
    const pluginIDs = new Set<string>();
    const dsUIDs = new Set<string>();
    const queries = targets.map((q) => {
      let datasource = this.getRef();
      let datasourceId = this.id;
      let shouldApplyTemplateVariables = true;

      if (isExpressionReference(q.datasource)) {
        hasExpr = true;
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

        const dsRef = ds.rawRef ?? getDataSourceRef(ds);
        const dsId = ds.id;
        if (dsRef.uid !== datasource.uid || datasourceId !== dsId) {
          datasource = dsRef;
          datasourceId = dsId;
          // If the query is using a different datasource, we would need to retrieve the datasource
          // instance (async) and apply the template variables but it seems it's not necessary for now.
          shouldApplyTemplateVariables = false;
        }
      }
      if (datasource.type?.length) {
        pluginIDs.add(datasource.type);
      }
      if (datasource.uid?.length) {
        dsUIDs.add(datasource.uid);
      }
      return {
        ...(shouldApplyTemplateVariables ? this.applyTemplateVariables(q, request.scopedVars) : q),
        datasource,
        datasourceId, // deprecated!
        intervalMs,
        maxDataPoints,
        queryCachingTTL,
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

    const headers: Record<string, string> = {};
    headers[PluginRequestHeaders.PluginID] = Array.from(pluginIDs).join(', ');
    headers[PluginRequestHeaders.DatasourceUID] = Array.from(dsUIDs).join(', ');

    let queryStrObj: Record<string, string> = {};

    let url = '/api/ds/query';

    if (hasExpr) {
      headers[PluginRequestHeaders.FromExpression] = 'true';
      queryStrObj.expression = 'true';
    }

    if (requestId) {
      queryStrObj.requestId = requestId;
    }

    let queryStr = new URLSearchParams(queryStrObj).toString();

    if (queryStr.length > 0) {
      url += '?' + queryStr;
    }

    if (request.dashboardUID) {
      headers[PluginRequestHeaders.DashboardUID] = request.dashboardUID;
    }
    if (request.panelId) {
      headers[PluginRequestHeaders.PanelID] = `${request.panelId}`;
    }
    if (request.queryGroupId) {
      headers[PluginRequestHeaders.QueryGroupID] = `${request.queryGroupId}`;
    }
    return getBackendSrv()
      .fetch<BackendDataSourceResponse>({
        url,
        method: 'POST',
        data: body,
        requestId,
        hideFromInspector,
        headers,
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

  /** Get request headers with plugin ID+UID set */
  protected getRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    headers[PluginRequestHeaders.PluginID] = this.type;
    headers[PluginRequestHeaders.DatasourceUID] = this.uid;
    return headers;
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
  async getResource<T = any>(
    path: string,
    params?: BackendSrvRequest['params'],
    options?: Partial<BackendSrvRequest>
  ): Promise<T> {
    const headers = this.getRequestHeaders();
    const result = await lastValueFrom(
      getBackendSrv().fetch<T>({
        ...options,
        method: 'GET',
        headers: options?.headers ? { ...options.headers, ...headers } : headers,
        params: params ?? options?.params,
        url: `/api/datasources/uid/${this.uid}/resources/${path}`,
      })
    );
    return result.data;
  }

  /**
   * Send a POST request to the datasource resource path
   */
  async postResource<T = any>(
    path: string,
    data?: BackendSrvRequest['data'],
    options?: Partial<BackendSrvRequest>
  ): Promise<T> {
    const headers = this.getRequestHeaders();
    const result = await lastValueFrom(
      getBackendSrv().fetch<T>({
        ...options,
        method: 'POST',
        headers: options?.headers ? { ...options.headers, ...headers } : headers,
        data: data ?? { ...data },
        url: `/api/datasources/uid/${this.uid}/resources/${path}`,
      })
    );
    return result.data;
  }

  /**
   * Run the datasource healthcheck
   */
  async callHealthCheck(): Promise<HealthCheckResult> {
    return lastValueFrom(
      getBackendSrv().fetch<HealthCheckResult>({
        method: 'GET',
        url: `/api/datasources/uid/${this.uid}/health`,
        showErrorAlert: false,
        headers: this.getRequestHeaders(),
      })
    )
      .then((v: FetchResponse) => v.data)
      .catch((err) => err.data);
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
      const frame: DataFrame = f;
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
