import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';
import { BackendSrvRequest, FetchResponse, getBackendSrv } from '@grafana/runtime';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { serializeParams } from '../../../core/utils/fetch';
import { apiPrefix } from './constants';
import { ZipkinSpan } from './types';
import { transformResponse } from './utils/transforms';
import { createGraphFrames } from './utils/graphTransform';

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

  async testDatasource(): Promise<{ status: string; message: string }> {
    await this.metadataRequest(`${apiPrefix}/services`);
    return { status: 'success', message: 'Data source is working' };
  }

  getQueryDisplayText(query: ZipkinQuery): string {
    return query.query;
  }

  private request<T = any>(
    apiUrl: string,
    data?: any,
    options?: Partial<BackendSrvRequest>
  ): Observable<FetchResponse<T>> {
    const params = data ? serializeParams(data) : '';
    const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return getBackendSrv().fetch<T>(req);
  }
}

function responseToDataQueryResponse(response: { data: ZipkinSpan[] }): DataQueryResponse {
  return {
    data: response?.data ? [transformResponse(response?.data), ...createGraphFrames(response?.data)] : [],
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
