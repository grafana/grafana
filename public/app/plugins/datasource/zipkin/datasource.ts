import { lastValueFrom, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  FieldType,
  createDataFrame,
  ScopedVars,
  urlUtil,
  toDataFrame,
} from '@grafana/data';
import { createNodeGraphFrames, NodeGraphOptions, SpanBarOptions } from '@grafana/o11y-ds-frontend';
import {
  BackendSrvRequest,
  config,
  DataSourceWithBackend,
  FetchResponse,
  getBackendSrv,
  getTemplateSrv,
  TemplateSrv,
} from '@grafana/runtime';

import { ZipkinQuery, ZipkinSpan } from './types';
import { createGraphFrames } from './utils/graphTransform';
import { transformResponse } from './utils/transforms';

const apiPrefix = '/api/v2';

export interface ZipkinJsonData extends DataSourceJsonData {
  nodeGraph?: NodeGraphOptions;
}

export class ZipkinDatasource extends DataSourceWithBackend<ZipkinQuery, ZipkinJsonData> {
  uploadedJson: string | ArrayBuffer | null = null;
  nodeGraph?: NodeGraphOptions;
  spanBar?: SpanBarOptions;
  constructor(
    private instanceSettings: DataSourceInstanceSettings<ZipkinJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
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
      if (config.featureToggles.zipkinBackendMigration) {
        return super.query(options).pipe(
          map((response) => {
            if (this.nodeGraph?.enabled) {
              return addNodeGraphFramesToResponse(response);
            }
            return response;
          })
        );
      }
      const query = this.applyTemplateVariables(target, options.scopedVars);
      return this.request<ZipkinSpan[]>(`${apiPrefix}/trace/${encodeURIComponent(query.query)}`).pipe(
        map((res) => responseToDataQueryResponse(res, this.nodeGraph?.enabled))
      );
    }
    return of(emptyDataQueryResponse);
  }

  async metadataRequest(url: string, params?: Record<string, unknown>) {
    if (config.featureToggles.zipkinBackendMigration) {
      return await this.getResource(url, params);
    }
    const urlWithPrefix = `${apiPrefix}/${url}`;
    const res = await lastValueFrom(this.request(urlWithPrefix, params, { hideFromInspector: true }));
    return res.data;
  }

  async testDatasource(): Promise<{ status: string; message: string }> {
    if (config.featureToggles.zipkinBackendMigration) {
      return await super.testDatasource();
    }

    await this.metadataRequest('services');
    return { status: 'success', message: 'Data source is working' };
  }

  getQueryDisplayText(query: ZipkinQuery): string {
    return query.query;
  }

  interpolateVariablesInQueries(queries: ZipkinQuery[], scopedVars: ScopedVars): ZipkinQuery[] {
    if (!queries || queries.length === 0) {
      return [];
    }

    return queries.map((query) => {
      return {
        ...query,
        datasource: this.getRef(),
        ...this.applyTemplateVariables(query, scopedVars),
      };
    });
  }

  applyTemplateVariables(query: ZipkinQuery, scopedVars: ScopedVars) {
    const expandedQuery = { ...query };

    return {
      ...expandedQuery,
      query: this.templateSrv.replace(query.query ?? '', scopedVars),
    };
  }

  private request<T = any>(
    apiUrl: string,
    data?: unknown,
    options?: Partial<BackendSrvRequest>
  ): Observable<FetchResponse<T>> {
    const params = data ? urlUtil.serializeParams(data) : '';
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

export function addNodeGraphFramesToResponse(response: DataQueryResponse): DataQueryResponse {
  if (!response.data || response.data.length === 0) {
    return response;
  }

  // This is frame, but it is not typed, so we use toDataFrame to convert it to DataFrame
  const frame = toDataFrame(response.data[0]);
  const data = [...response.data];
  data.push(...createNodeGraphFrames(frame));
  return {
    ...response,
    data,
  };
}

const emptyDataQueryResponse = {
  data: [
    createDataFrame({
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
