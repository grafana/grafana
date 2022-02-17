import { DataQuery, DataQueryRequest, DataQueryResponse, DataSourceApi, PluginMeta } from '@grafana/data';
import { BackendDataSourceResponse, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { catchError, Observable, of, switchMap } from 'rxjs';

export class PublicDashboardDataSource extends DataSourceApi<any> {
  constructor() {
    super({
      name: 'public-ds',
      id: 1,
      type: 'public-ds',
      meta: {} as PluginMeta,
      uid: '1',
      jsonData: {},
      access: 'proxy',
    });
  }

  /**
   * Ideally final -- any other implementation may not work as expected
   */
  query(request: DataQueryRequest<any>): Observable<DataQueryResponse> {
    const { intervalMs, maxDataPoints, range, requestId, dashboardUid } = request;
    let targets = request.targets;

    if (this.filterQuery) {
      targets = targets.filter((q) => this.filterQuery!(q));
    }

    const queries = targets.map((q) => {
      return {
        ...q,
        dashboardUid,
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

    return getBackendSrv()
      .fetch<BackendDataSourceResponse>({
        url: '/api/ds/public-query',
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
