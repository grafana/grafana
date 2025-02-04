import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  FieldType,
  createDataFrame,
  ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { createNodeGraphFrames, NodeGraphOptions, SpanBarOptions } from '@grafana/o11y-ds-frontend';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { ZipkinQuery, ZipkinSpan } from './types';
import { createGraphFrames } from './utils/graphTransform';
import { transformResponse } from './utils/transforms';

export interface ZipkinJsonData extends DataSourceJsonData {
  nodeGraph?: NodeGraphOptions;
}

export class ZipkinDatasource extends DataSourceWithBackend<ZipkinQuery, ZipkinJsonData> {
  uploadedJson: string | ArrayBuffer | null = null;
  nodeGraph?: NodeGraphOptions;
  spanBar?: SpanBarOptions;
  constructor(
    instanceSettings: DataSourceInstanceSettings<ZipkinJsonData>,
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
      return super.query(options).pipe(
        map((response) => {
          if (this.nodeGraph?.enabled) {
            return addNodeGraphFramesToResponse(response);
          }
          return response;
        })
      );
    }
    return of(emptyDataQueryResponse);
  }

  async metadataRequest(url: string, params?: Record<string, unknown>) {
    return await this.getResource(url, params);
  }

  async testDatasource(): Promise<{ status: string; message: string }> {
    return await super.testDatasource();
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
