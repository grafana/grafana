import {
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
import { catchError, map } from 'rxjs/operators';
import { createTableFrame, createTraceFrame } from './responseTransform';
import { createGraphFrames } from './graphTransform';
import { JaegerQuery } from './types';
import { identity, omit, pick, pickBy } from 'lodash';
import { convertTagsLogfmt } from './util';
import { ALL_OPERATIONS_KEY } from './components/SearchForm';

export class JaegerDatasource extends DataSourceApi<JaegerQuery> {
  uploadedJson: string | ArrayBuffer | null = null;
  constructor(private instanceSettings: DataSourceInstanceSettings, private readonly timeSrv: TimeSrv = getTimeSrv()) {
    super(instanceSettings);
  }

  async metadataRequest(url: string, params?: Record<string, any>): Promise<any> {
    const res = await this._request(url, params, { hideFromInspector: true }).toPromise();
    return res.data.data;
  }

  query(options: DataQueryRequest<JaegerQuery>): Observable<DataQueryResponse> {
    // At this moment we expect only one target. In case we somehow change the UI to be able to show multiple
    // traces at one we need to change this.
    const target = options.targets[0];
    if (!target) {
      return of({ data: [emptyTraceDataFrame] });
    }

    if (target.queryType !== 'search' && target.query) {
      return this._request(`/api/traces/${encodeURIComponent(target.query)}`).pipe(
        map((response) => {
          const traceData = response?.data?.data?.[0];
          if (!traceData) {
            return { data: [emptyTraceDataFrame] };
          }
          return {
            data: [createTraceFrame(traceData), ...createGraphFrames(traceData)],
          };
        })
      );
    }

    if (target.queryType === 'upload') {
      if (!this.uploadedJson) {
        return of({ data: [] });
      }
      const traceData = JSON.parse(this.uploadedJson as string).data[0];
      return of({ data: [createTraceFrame(traceData), ...createGraphFrames(traceData)] });
    }

    let jaegerQuery = pick(target, ['operation', 'service', 'tags', 'minDuration', 'maxDuration', 'limit']);
    // remove empty properties
    jaegerQuery = pickBy(jaegerQuery, identity);
    if (jaegerQuery.tags) {
      jaegerQuery = { ...jaegerQuery, tags: convertTagsLogfmt(jaegerQuery.tags) };
    }

    if (jaegerQuery.operation === ALL_OPERATIONS_KEY) {
      jaegerQuery = omit(jaegerQuery, 'operation');
    }

    // TODO: this api is internal, used in jaeger ui. Officially they have gRPC api that should be used.
    return this._request(`/api/traces`, {
      ...jaegerQuery,
      ...this.getTimeRange(),
      lookback: 'custom',
    }).pipe(
      map((response) => {
        return {
          data: [createTableFrame(response.data.data, this.instanceSettings)],
        };
      })
    );
  }

  async testDatasource(): Promise<any> {
    return this._request('/api/services')
      .pipe(
        map((res) => {
          const values: any[] = res?.data?.data || [];
          const testResult =
            values.length > 0
              ? { status: 'success', message: 'Data source connected and services found.' }
              : {
                  status: 'error',
                  message:
                    'Data source connected, but no services received. Verify that Jaeger is configured properly.',
                };
          return testResult;
        }),
        catchError((err: any) => {
          let message = 'Jaeger: ';
          if (err.statusText) {
            message += err.statusText;
          } else {
            message += 'Cannot connect to Jaeger';
          }

          if (err.status) {
            message += `. ${err.status}`;
          }

          if (err.data && err.data.message) {
            message += `. ${err.data.message}`;
          } else if (err.data) {
            message += `. ${JSON.stringify(err.data)}`;
          }
          return of({ status: 'error', message: message });
        })
      )
      .toPromise();
  }

  getTimeRange(): { start: number; end: number } {
    const range = this.timeSrv.timeRange();
    return {
      start: getTime(range.from, false),
      end: getTime(range.to, true),
    };
  }

  getQueryDisplayText(query: JaegerQuery) {
    return query.query || '';
  }

  private _request(apiUrl: string, data?: any, options?: Partial<BackendSrvRequest>): Observable<Record<string, any>> {
    const params = data ? serializeParams(data) : '';
    const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return getBackendSrv().fetch(req);
  }
}

function getTime(date: string | DateTime, roundUp: boolean) {
  if (typeof date === 'string') {
    date = dateMath.parse(date, roundUp)!;
  }
  return date.valueOf() * 1000;
}

const emptyTraceDataFrame = new MutableDataFrame({
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
});
