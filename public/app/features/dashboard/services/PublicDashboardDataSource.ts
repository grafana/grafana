import { catchError, Observable, of, switchMap } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceRef,
  PluginMeta,
} from '@grafana/data';
import { BackendDataSourceResponse, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';

export const PUBLIC_DATASOURCE = '-- Public --';

export class PublicDashboardDataSource extends DataSourceApi<any> {
  constructor(datasource: DataSourceRef | string | DataSourceApi | null) {
    super({
      name: 'public-ds',
      id: 0,
      type: 'public-ds',
      meta: {} as PluginMeta,
      uid: PublicDashboardDataSource.resolveUid(datasource),
      jsonData: {},
      access: 'proxy',
    });

    this.interval = '1min';
  }

  /**
   * Get the datasource uid based on the many types a datasource can be.
   */
  private static resolveUid(datasource: DataSourceRef | string | DataSourceApi | null): string {
    if (typeof datasource === 'string') {
      return datasource;
    }

    return datasource?.uid ?? PUBLIC_DATASOURCE;
  }

  /**
   * Ideally final -- any other implementation may not work as expected
   */
  query(request: DataQueryRequest<any>): Observable<DataQueryResponse> {
    const { intervalMs, maxDataPoints, range, requestId, publicDashboardAccessToken, panelId } = request;
    let targets = request.targets;

    const queries = targets.map((q) => {
      return {
        ...q,
        publicDashboardAccessToken,
        intervalMs,
        maxDataPoints,
      };
    });

    // Return early if no queries exist
    if (!queries.length) {
      return of({ data: [] });
    }

    const body: any = { queries, publicDashboardAccessToken, panelId };

    if (range) {
      body.range = range;
      body.from = range.from.valueOf().toString();
      body.to = range.to.valueOf().toString();
    }

    return getBackendSrv()
      .fetch<BackendDataSourceResponse>({
        url: `/api/public/dashboards/${publicDashboardAccessToken}/panels/${panelId}/query`,
        method: 'POST',
        data: body,
        requestId,
      })
      .pipe(
        switchMap((raw) => {
          return of(toDataQueryResponse(raw, queries as DataQuery[]));
        }),
        catchError((err) => {
          return of(toDataQueryResponse(err));
        })
      );
  }

  testDatasource(): Promise<any> {
    return Promise.resolve(null);
  }
}
