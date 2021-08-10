import {
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
import { ZipkinQuery, ZipkinSpan } from './types';
import { createGraphFrames } from './utils/graphTransform';
import { transformResponse } from './utils/transforms';

export class ZipkinDatasource extends DataSourceApi<ZipkinQuery> {
  uploadedJson: string | ArrayBuffer | null = null;
  constructor(private instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(options: DataQueryRequest<ZipkinQuery>): Observable<DataQueryResponse> {
    const target = options.targets[0];
    if (target.queryType === 'upload') {
      if (!this.uploadedJson) {
        return of({ data: [] });
      }
      const traceData = JSON.parse(this.uploadedJson as string);
      return of(responseToDataQueryResponse({ data: traceData }));
    }

    if (target.query) {
      return this.request<ZipkinSpan[]>(`${apiPrefix}/trace/${encodeURIComponent(target.query)}`).pipe(
        map(responseToDataQueryResponse)
      );
    }
    return of(emptyDataQueryResponse);
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
