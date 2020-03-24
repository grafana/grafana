import {
  dateMath,
  DateTime,
  MutableDataFrame,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataQuery,
  FieldType,
} from '@grafana/data';
import { BackendSrv, DatasourceRequestOptions } from 'app/core/services/backend_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';

function serializeParams(data: Record<string, any>) {
  return Object.keys(data)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&');
}

export type JaegerQuery = {
  query: string;
} & DataQuery;

export class JaegerDatasource extends DataSourceApi<JaegerQuery> {
  /** @ngInject */
  constructor(
    private instanceSettings: DataSourceInstanceSettings,
    private backendSrv: BackendSrv,
    private timeSrv: TimeSrv
  ) {
    super(instanceSettings);
  }

  _request(apiUrl: string, data?: any, options?: DatasourceRequestOptions): Observable<Record<string, any>> {
    // Hack for proxying metadata requests
    const baseUrl = `/api/datasources/proxy/${this.instanceSettings.id}`;
    const params = data ? serializeParams(data) : '';
    const url = `${baseUrl}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return from(this.backendSrv.datasourceRequest(req));
  }

  async metadataRequest(url: string, params?: Record<string, any>) {
    const res = await this._request(url, params, { silent: true }).toPromise();
    return res.data.data;
  }

  query(options: DataQueryRequest<JaegerQuery>): Observable<DataQueryResponse> {
    // At this moment we expect only one target. In case we somehow change the UI to be able to show multiple
    // traces at one we need to change this.
    const id = options.targets?.[0]?.query;
    if (id) {
      // TODO: this api is internal, used in jaeger ui. Officially they have gRPC api that should be used.
      return this._request(`/api/traces/${id}`).pipe(
        map(response => {
          return {
            data: [
              new MutableDataFrame({
                fields: [
                  {
                    name: 'trace',
                    type: FieldType.trace,
                    values: response?.data?.data || [],
                  },
                ],
              }),
            ],
          };
        })
      );
    } else {
      return of({
        name: 'trace',
        type: FieldType.trace,
        data: [],
      });
    }
  }

  async testDatasource(): Promise<any> {
    return true;
  }

  getTime(date: string | DateTime, roundUp: boolean) {
    if (typeof date === 'string') {
      date = dateMath.parse(date, roundUp);
    }
    return date.valueOf() * 1000;
  }

  getTimeRange(): { start: number; end: number } {
    const range = this.timeSrv.timeRange();
    return {
      start: this.getTime(range.from, false),
      end: this.getTime(range.to, true),
    };
  }
}
