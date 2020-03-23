import {
  dateMath,
  DateTime,
  MutableDataFrame,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataQuery,
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
    // //http://localhost:16686/search?end=1573338717880000&limit=20&lookback=6h&maxDuration&minDuration&service=app&start=1573317117880000
    // const url =
    //   options.targets.length && options.targets[0].query
    //     ? `${this.instanceSettings.url}/trace/${options.targets[0].query}?uiEmbed=v0`
    //     : '';
    //
    // return of({
    //   data: [
    //     new MutableDataFrame({
    //       fields: [
    //         {
    //           name: 'url',
    //           values: [url],
    //         },
    //       ],
    //     }),
    //   ],
    // });

    const id = options.targets?.[0]?.query;
    if (id) {
      return this._request(`/api/traces/${id}`).pipe(
        map(response => {
          return {
            data: [
              new MutableDataFrame({
                fields: [
                  {
                    name: 'data',
                    values: [response.data.data],
                  },
                ],
              }),
            ],
          };
        })
      );
    } else {
      return of({ data: [] });
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
