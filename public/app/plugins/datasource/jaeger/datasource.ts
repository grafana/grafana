import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  dateMath,
  DateTime,
  FieldType,
  getDefaultTimeRange,
  MutableDataFrame,
  ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { createNodeGraphFrames, NodeGraphOptions, SpanBarOptions } from '@grafana/o11y-ds-frontend';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { TraceIdTimeParamsOptions } from './configuration/TraceIdTimeParams';
import { createGraphFrames } from './graphTransform';
import { createTraceFrame } from './responseTransform';
import { JaegerQuery } from './types';

export interface JaegerJsonData extends DataSourceJsonData {
  nodeGraph?: NodeGraphOptions;
  traceIdTimeParams?: TraceIdTimeParamsOptions;
}

export class JaegerDatasource extends DataSourceWithBackend<JaegerQuery, JaegerJsonData> {
  uploadedJson: string | ArrayBuffer | null = null;
  nodeGraph?: NodeGraphOptions;
  traceIdTimeParams?: TraceIdTimeParamsOptions;
  spanBar?: SpanBarOptions;
  constructor(
    instanceSettings: DataSourceInstanceSettings<JaegerJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.nodeGraph = instanceSettings.jsonData.nodeGraph;
    this.traceIdTimeParams = instanceSettings.jsonData.traceIdTimeParams;
  }

  async metadataRequest(url: string, params?: Record<string, unknown>) {
    return await this.getResource(url, params);
  }

  isSearchFormValid(query: JaegerQuery): boolean {
    return !!query.service;
  }

  query(options: DataQueryRequest<JaegerQuery>): Observable<DataQueryResponse> {
    // At this moment we expect only one target. In case we somehow change the UI to be able to show multiple
    // traces at one we need to change this.
    const target: JaegerQuery = options.targets[0];
    if (!target) {
      return of({ data: [emptyTraceDataFrame] });
    }

    if (target.queryType === 'upload') {
      if (!this.uploadedJson) {
        return of({ data: [] });
      }

      try {
        const traceData = JSON.parse(this.uploadedJson as string).data[0];
        let data = [createTraceFrame(traceData)];
        if (this.nodeGraph?.enabled) {
          data.push(...createGraphFrames(traceData));
        }
        return of({ data });
      } catch (error) {
        return of({ error: { message: 'The JSON file uploaded is not in a valid Jaeger format' }, data: [] });
      }
    }

    return super.query({ ...options, targets: [target] }).pipe(
      map((response) => {
        // If the node graph is enabled and the query is a trace ID query, add the node graph frames to the response
        if (this.nodeGraph?.enabled && !target.queryType) {
          return addNodeGraphFramesToResponse(response);
        }
        return response;
      })
    );
  }

  interpolateVariablesInQueries(queries: JaegerQuery[], scopedVars: ScopedVars): JaegerQuery[] {
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

  applyTemplateVariables(query: JaegerQuery, scopedVars: ScopedVars) {
    let expandedQuery = { ...query };

    if (query.tags && this.templateSrv.containsTemplate(query.tags)) {
      expandedQuery = {
        ...query,
        tags: this.templateSrv.replace(query.tags, scopedVars),
      };
    }

    return {
      ...expandedQuery,
      service: this.templateSrv.replace(query.service ?? '', scopedVars),
      operation: this.templateSrv.replace(query.operation ?? '', scopedVars),
      minDuration: this.templateSrv.replace(query.minDuration ?? '', scopedVars),
      maxDuration: this.templateSrv.replace(query.maxDuration ?? '', scopedVars),
    };
  }

  async testDatasource() {
    return await super.testDatasource();
  }

  getTimeRange(range = getDefaultTimeRange()): { start: number; end: number } {
    return {
      start: getTime(range.from, false),
      end: getTime(range.to, true),
    };
  }

  getQueryDisplayText(query: JaegerQuery) {
    return query.query || '';
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
    custom: {
      traceFormat: 'jaeger',
    },
  },
});

export function addNodeGraphFramesToResponse(response: DataQueryResponse): DataQueryResponse {
  if (!response.data || response.data.length === 0) {
    return response;
  }

  // Convert the first frame to a DataFrame for node graph processing
  const frame = toDataFrame(response.data[0]);
  // Add the node graph frames to the response
  const data = response.data.concat(createNodeGraphFrames(frame));
  return {
    ...response,
    data,
  };
}
