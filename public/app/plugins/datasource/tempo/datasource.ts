import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  dateMath,
  DateTime,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { serializeParams } from 'app/core/utils/fetch';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { transformResponse } from './transform';
import { isTempoResponse, TempoResponse } from './types';

export type TempoQuery = {
  query: string;
} & DataQuery;

export class TempoDatasource extends DataSourceApi<TempoQuery> {
  constructor(private instanceSettings: DataSourceInstanceSettings, private readonly timeSrv: TimeSrv = getTimeSrv()) {
    super(instanceSettings);
  }

  async metadataRequest(url: string, params?: Record<string, any>): Promise<any> {
    const res = await this._request(url, params, { hideFromInspector: true }).toPromise();
    return res.data.data;
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    // At this moment we expect only one target. In case we somehow change the UI to be able to show multiple
    // traces at one we need to change this.
    const id = options.targets[0]?.query;
    if (id) {
      return this._request<TempoResponse | { data: any }>(`/api/traces/${encodeURIComponent(id)}`).pipe(
        map((response) => {
          return {
            data: [
              new MutableDataFrame({
                fields: [
                  {
                    name: 'trace',
                    type: FieldType.trace,
                    values: isTempoResponse(response.data)
                      ? [transformResponse(response.data, id)]
                      : response.data.data || [],
                  },
                ],
                meta: {
                  preferredVisualisationType: 'trace',
                },
              }),
            ],
          };
        })
      );
    } else {
      return of({
        data: [
          new MutableDataFrame({
            fields: [
              {
                name: 'trace',
                type: FieldType.trace,
                values: [],
              },
            ],
            meta: {
              preferredVisualisationType: 'trace',
            },
          }),
        ],
      });
    }
  }

  async testDatasource(): Promise<any> {
    try {
      await this._request(`/api/traces/random`).toPromise();
    } catch (e) {
      // If all went well this request will get back with 400 - Bad request
      if (e?.status !== 400) {
        throw e;
      }
    }
    return { status: 'success', message: 'Data source is working' };
  }

  getTimeRange(): { start: number; end: number } {
    const range = this.timeSrv.timeRange();
    return {
      start: getTime(range.from, false),
      end: getTime(range.to, true),
    };
  }

  getQueryDisplayText(query: TempoQuery) {
    return query.query;
  }

  private _request<T = any>(apiUrl: string, data?: any, options?: Partial<BackendSrvRequest>) {
    const params = data ? serializeParams(data) : '';
    const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return getBackendSrv().fetch<T>(req);
  }
}

function getTime(date: string | DateTime, roundUp: boolean) {
  if (typeof date === 'string') {
    date = dateMath.parse(date, roundUp)!;
  }
  return date.valueOf() * 1000;
}
