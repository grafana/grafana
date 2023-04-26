import { catchError, from, Observable, of, switchMap } from 'rxjs';

import {
  AnnotationQuery,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePluginMeta,
  DataSourceRef,
  toDataFrame,
} from '@grafana/data';
import { BackendDataSourceResponse, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';

import { GrafanaQueryType } from '../../../plugins/datasource/grafana/types';
import { MIXED_DATASOURCE_NAME } from '../../../plugins/datasource/mixed/MixedDataSource';
import { GRAFANA_DATASOURCE_NAME } from '../../alerting/unified/utils/datasource';

export const PUBLIC_DATASOURCE = '-- Public --';
export const DEFAULT_INTERVAL = '1min';

export class PublicDashboardDataSource extends DataSourceApi<DataQuery, DataSourceJsonData, {}> {
  constructor(datasource: DataSourceRef | string | DataSourceApi | null) {
    let meta = {} as DataSourcePluginMeta;
    if (PublicDashboardDataSource.isMixedDatasource(datasource)) {
      meta.mixed = true;
    }

    super({
      name: 'public-ds',
      id: 0,
      type: 'public-ds',
      meta,
      uid: PublicDashboardDataSource.resolveUid(datasource),
      jsonData: {},
      access: 'proxy',
      readOnly: true,
    });

    this.interval = PublicDashboardDataSource.resolveInterval(datasource);

    this.annotations = {
      prepareQuery(anno: AnnotationQuery): DataQuery | undefined {
        return { ...anno, queryType: GrafanaQueryType.Annotations, refId: 'anno' };
      },
    };
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

  private static isMixedDatasource(datasource: DataSourceRef | string | DataSourceApi | null): boolean {
    if (typeof datasource === 'string' || datasource == null) {
      return false;
    }

    return datasource?.uid === MIXED_DATASOURCE_NAME;
  }

  private static resolveInterval(datasource: DataSourceRef | string | DataSourceApi | null): string {
    if (typeof datasource === 'string' || datasource == null) {
      return DEFAULT_INTERVAL;
    }

    const interval = 'interval' in datasource ? datasource.interval : undefined;

    return interval ?? DEFAULT_INTERVAL;
  }

  /**
   * Ideally final -- any other implementation may not work as expected
   */
  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const {
      intervalMs,
      maxDataPoints,
      requestId,
      publicDashboardAccessToken,
      panelId,
      queryCachingTTL,
      range: { from: fromRange, to: toRange },
    } = request;
    let queries: DataQuery[];

    // Return early if no queries exist
    if (!request.targets.length) {
      return of({ data: [] });
    }

    // Its an annotations query
    // Currently, annotations requests come in one at a time, so there will only be one target
    const target = request.targets[0];
    if (target.queryType === GrafanaQueryType.Annotations) {
      if (target?.datasource?.uid === GRAFANA_DATASOURCE_NAME) {
        return from(this.getAnnotations(request));
      }
      return of({ data: [] });
    }

    // Its a datasource query
    else {
      const body = {
        intervalMs,
        maxDataPoints,
        queryCachingTTL,
        timeRange: { from: fromRange.valueOf().toString(), to: toRange.valueOf().toString() },
      };

      return getBackendSrv()
        .fetch<BackendDataSourceResponse>({
          url: `/api/public/dashboards/${publicDashboardAccessToken}/panels/${panelId}/query`,
          method: 'POST',
          data: body,
          requestId,
        })
        .pipe(
          switchMap((raw) => {
            return of(toDataQueryResponse(raw, queries));
          }),
          catchError((err) => {
            return of(toDataQueryResponse(err));
          })
        );
    }
  }

  async getAnnotations(request: DataQueryRequest<DataQuery>): Promise<DataQueryResponse> {
    const {
      publicDashboardAccessToken: accessToken,
      range: { to, from },
    } = request;

    const params = {
      from: from.valueOf(),
      to: to.valueOf(),
    };

    const annotations = accessToken
      ? await getBackendSrv().get(`/api/public/dashboards/${accessToken}/annotations`, params)
      : [];

    return { data: [toDataFrame(annotations)] };
  }

  testDatasource(): Promise<null> {
    return Promise.resolve(null);
  }
}
