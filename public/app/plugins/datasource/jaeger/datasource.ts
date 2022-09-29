import { identity, omit, pick, pickBy } from 'lodash';
import { lastValueFrom, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  dateMath,
  DateTime,
  FieldType,
  MutableDataFrame,
  ScopedVars,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { SpanBarOptions } from '@jaegertracing/jaeger-ui-components';
import { NodeGraphOptions } from 'app/core/components/NodeGraphSettings';
import { serializeParams } from 'app/core/utils/fetch';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { ALL_OPERATIONS_KEY } from './components/SearchForm';
import { createGraphFrames } from './graphTransform';
import { createTableFrame, createTraceFrame } from './responseTransform';
import { JaegerQuery } from './types';
import { convertTagsLogfmt } from './util';

export interface JaegerJsonData extends DataSourceJsonData {
  nodeGraph?: NodeGraphOptions;
}

export class JaegerDatasource extends DataSourceApi<JaegerQuery, JaegerJsonData> {
  uploadedJson: string | ArrayBuffer | null = null;
  nodeGraph?: NodeGraphOptions;
  spanBar?: SpanBarOptions;
  constructor(
    private instanceSettings: DataSourceInstanceSettings<JaegerJsonData>,
    private readonly timeSrv: TimeSrv = getTimeSrv(),
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.nodeGraph = instanceSettings.jsonData.nodeGraph;
  }

  async metadataRequest(url: string, params?: Record<string, any>): Promise<any> {
    const res = await lastValueFrom(this._request(url, params, { hideFromInspector: true }));
    return res.data.data;
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

    if (target.queryType === 'search' && !this.isSearchFormValid(target)) {
      return of({ error: { message: 'You must select a service.' }, data: [] });
    }

    if (target.queryType !== 'search' && target.query) {
      return this._request(
        `/api/traces/${encodeURIComponent(this.templateSrv.replace(target.query, options.scopedVars))}`
      ).pipe(
        map((response) => {
          const traceData = response?.data?.data?.[0];
          if (!traceData) {
            return { data: [emptyTraceDataFrame] };
          }
          let data = [createTraceFrame(traceData)];
          if (this.nodeGraph?.enabled) {
            data.push(...createGraphFrames(traceData));
          }
          return {
            data,
          };
        })
      );
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

    let jaegerInterpolated = pick(this.applyVariables(target, options.scopedVars), [
      'service',
      'operation',
      'tags',
      'minDuration',
      'maxDuration',
      'limit',
    ]);
    // remove empty properties
    let jaegerQuery = pickBy(jaegerInterpolated, identity);

    if (jaegerQuery.operation === ALL_OPERATIONS_KEY) {
      jaegerQuery = omit(jaegerQuery, 'operation');
    }

    if (jaegerQuery.tags) {
      jaegerQuery = {
        ...jaegerQuery,
        tags: convertTagsLogfmt(jaegerQuery.tags.toString()),
      };
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

  interpolateVariablesInQueries(queries: JaegerQuery[], scopedVars: ScopedVars): JaegerQuery[] {
    if (!queries || queries.length === 0) {
      return [];
    }

    return queries.map((query) => {
      return {
        ...query,
        datasource: this.getRef(),
        ...this.applyVariables(query, scopedVars),
      };
    });
  }

  applyVariables(query: JaegerQuery, scopedVars: ScopedVars) {
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

  async testDatasource(): Promise<any> {
    return lastValueFrom(
      this._request('/api/services').pipe(
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
    );
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
    custom: {
      traceFormat: 'jaeger',
    },
  },
});
