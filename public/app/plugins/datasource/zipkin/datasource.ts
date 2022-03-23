import { lastValueFrom, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { BackendSrvRequest, FetchResponse, getBackendSrv } from '@grafana/runtime';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';

import { serializeParams } from '../../../core/utils/fetch';
import { apiPrefix } from './constants';
import { ZipkinQuery, ZipkinSpan } from './types';
import { createGraphFrames } from './utils/graphTransform';
import { transformResponse } from './utils/transforms';
import { NodeGraphOptions } from 'app/core/components/NodeGraphSettings';

export interface ZipkinJsonData extends DataSourceJsonData {
  nodeGraph?: NodeGraphOptions;
}

export class ZipkinDatasource extends DataSourceApi<ZipkinQuery, ZipkinJsonData> {
  uploadedJson: string | ArrayBuffer | null = null;
  nodeGraph?: NodeGraphOptions;
  constructor(private instanceSettings: DataSourceInstanceSettings<ZipkinJsonData>) {
    super(instanceSettings);
    this.nodeGraph = instanceSettings.jsonData.nodeGraph;
  }

  query(options: DataQueryRequest<ZipkinQuery>): Observable<DataQueryResponse> {
    const target = options.targets[0];
    if (target.queryType === 'upload') {
      if (!this.uploadedJson) {
        return of({ data: [] });
      }

      try {
        const traceData = JSON.parse(this.uploadedJson as string);
        return of(responseToDataQueryResponse({ data: traceData }, this.nodeGraph?.enabled));
      } catch (error) {
        return of({ error: { message: 'JSON is not valid Zipkin format' }, data: [] });
      }
    }

    if (target.query) {
      return this.request<ZipkinSpan[]>(`${apiPrefix}/trace/${encodeURIComponent(target.query)}`).pipe(
        map((res) => responseToDataQueryResponse(res, this.nodeGraph?.enabled))
      );
    }
    return of(emptyDataQueryResponse);
  }

  async metadataRequest(url: string, params?: Record<string, any>): Promise<any> {
    const res = await lastValueFrom(this.request(url, params, { hideFromInspector: true }));
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

function responseToDataQueryResponse(response: { data: ZipkinSpan[] }, nodeGraph = false): DataQueryResponse {
  let data = response?.data ? [transformResponse(response?.data)] : [];
  if (nodeGraph) {
    data.push(...createGraphFrames(response?.data));
  }
  return {
    data,
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
        custom: {
          traceFormat: 'zipkin',
        },
      },
    }),
  ],
};
