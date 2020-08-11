import {
  MutableDataFrame,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataQuery,
  FieldType,
} from '@grafana/data';
import { from, Observable, of } from 'rxjs';
import { serializeParams } from '../../../core/utils/fetch';
import { getBackendSrv, BackendSrvRequest } from '@grafana/runtime';
import { map } from 'rxjs/operators';
import { apiPrefix } from './constants';
import { ZipkinSpan } from './types';
import { transformResponse } from './utils/transforms';

export interface ZipkinQuery extends DataQuery {
  query: string;
}

export class ZipkinDatasource extends DataSourceApi<ZipkinQuery> {
  constructor(private instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(options: DataQueryRequest<ZipkinQuery>): Observable<DataQueryResponse> {
    const traceId = options.targets[0]?.query;
    if (traceId) {
      return this.request<ZipkinSpan[]>(`${apiPrefix}/trace/${encodeURIComponent(traceId)}`).pipe(
        map(responseToDataQueryResponse)
      );
    } else {
      return of(emptyDataQueryResponse);
    }
  }

  async metadataRequest(url: string, params?: Record<string, any>): Promise<any> {
    const res = await this.request(url, params, { hideFromInspector: true }).toPromise();
    return res.data;
  }

  async testDatasource(): Promise<any> {
    await this.metadataRequest(`${apiPrefix}/services`);
    return true;
  }

  getQueryDisplayText(query: ZipkinQuery) {
    return query.query;
  }

  private request<T = any>(apiUrl: string, data?: any, options?: Partial<BackendSrvRequest>): Observable<{ data: T }> {
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

function responseToDataQueryResponse(response: { data: ZipkinSpan[] }): DataQueryResponse {
  return {
    data: [
      new MutableDataFrame({
        fields: [
          {
            name: 'trace',
            type: FieldType.trace,
            // There is probably better mapping than just putting everything in as a single value but that's how
            // we do it with jaeger and is the simplest right now.
            values: response?.data ? [transformResponse(response?.data)] : [],
          },
        ],
        meta: {
          preferredVisualisationType: 'trace',
        },
      }),
    ],
  };
}

const emptyDataQueryResponse = {
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
};
