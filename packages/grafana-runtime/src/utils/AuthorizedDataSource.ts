import { catchError, Observable, of, switchMap } from 'rxjs';

import {
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  getDataSourceRef,
  ScopedVars,
  TestDataSourceResponse,
} from '@grafana/data';

import { config } from '../config';
import { getBackendSrv, getDataSourceSrv, getGrafanaLiveSrv } from '../services';

import {
  ExpressionDatasourceRef,
  isExpressionReference,
  standardStreamOptionsProvider,
  StreamOptionsProvider,
  toStreamingDataResponse,
} from './DataSourceWithBackend';
import { BackendDataSourceResponse, toDataQueryResponse } from './queryResponse';

enum PluginRequestHeaders {
  PluginID = 'X-Plugin-Id', // can be used for routing
  DatasourceUID = 'X-Datasource-Uid', // can be used for routing/ load balancing
  DashboardUID = 'X-Dashboard-Uid', // mainly useful for debugging slow queries
  PanelID = 'X-Panel-Id', // mainly useful for debugging slow queries
  QueryGroupID = 'X-Query-Group-Id', // mainly useful to find related queries with query splitting
  FromExpression = 'X-Grafana-From-Expr', // used by datasources to identify expression queries
}

export class AuthorizedDataSource<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<DataQuery, DataSourceJsonData> {
  constructor(instanceSettings: DataSourceInstanceSettings<TOptions>) {
    super(instanceSettings);
  }
  applyTemplateVariables(query: TQuery, scopedVars: ScopedVars): Record<string, any> {
    return query;
  }

  streamOptionsProvider: StreamOptionsProvider<TQuery> = standardStreamOptionsProvider;
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

    let url = '/api/ds/query?ds_type=' + this.type;

    if (hasExpr) {
      headers[PluginRequestHeaders.FromExpression] = 'true';
      url += '&expression=true';
    }

    // Appending request ID to url to facilitate client-side performance metrics. See #65244 for more context.
    if (requestId) {
      url += `&requestId=${requestId}`;
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
  testDatasource(): Promise<TestDataSourceResponse> {
    throw new Error('Method not implemented.');
  }
}
