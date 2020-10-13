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
import { getBackendSrv, BackendSrvRequest } from '@grafana/runtime';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { serializeParams } from 'app/core/utils/fetch';

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
      return this._request(`/api/traces/${encodeURIComponent(id)}`).pipe(
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
      // As we are not searching for a valid trace here this will definitely fail but we should return 502 if it's
      // unreachable. 500 should otherwise be from tempo it self but probably makes sense to report them here.
      if (e?.status >= 500 && e?.status < 600) {
        throw e;
      }
    }
    return true;
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

  private _request(apiUrl: string, data?: any, options?: Partial<BackendSrvRequest>): Observable<Record<string, any>> {
    // Hack for proxying metadata requests
    const baseUrl = `/api/datasources/proxy/${this.instanceSettings.id}`;
    const params = data ? serializeParams(data) : '';
    const url = `${baseUrl}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return from(getBackendSrv().datasourceRequest(req));
  }
}

function getTime(date: string | DateTime, roundUp: boolean) {
  if (typeof date === 'string') {
    date = dateMath.parse(date, roundUp)!;
  }
  return date.valueOf() * 1000;
}
