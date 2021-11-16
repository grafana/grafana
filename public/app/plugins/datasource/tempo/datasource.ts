import { from, merge, Observable, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';
import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  isValidGoDuration,
  LoadingState,
} from '@grafana/data';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import { BackendSrvRequest, DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { serializeParams } from 'app/core/utils/fetch';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { identity, pick, pickBy, groupBy, startCase } from 'lodash';
import Prism from 'prismjs';
import { LokiOptions, LokiQuery } from '../loki/types';
import { PrometheusDatasource } from '../prometheus/datasource';
import { PromQuery } from '../prometheus/types';
import { failedMetric, mapPromMetricsToServiceMap, serviceMapMetrics, totalsMetric } from './graphTransform';
import {
  transformTrace,
  transformTraceList,
  transformFromOTLP as transformFromOTEL,
  createTableFrameFromSearch,
} from './resultTransformer';
import { tokenizer } from './syntax';
import { NodeGraphOptions } from 'app/core/components/NodeGraphSettings';

// search = Loki search, nativeSearch = Tempo search for backwards compatibility
export type TempoQueryType = 'search' | 'traceId' | 'serviceMap' | 'upload' | 'nativeSearch';

export interface TempoJsonData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };
  search?: {
    hide?: boolean;
  };
  nodeGraph?: NodeGraphOptions;
}

export type TempoQuery = {
  query: string;
  // Query to find list of traces, e.g., via Loki
  linkedQuery?: LokiQuery;
  search: string;
  queryType: TempoQueryType;
  serviceName?: string;
  spanName?: string;
  minDuration?: string;
  maxDuration?: string;
  limit?: number;
  serviceMapQuery?: string;
} & DataQuery;

export const DEFAULT_LIMIT = 20;

export class TempoDatasource extends DataSourceWithBackend<TempoQuery, TempoJsonData> {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };
  search?: {
    hide?: boolean;
  };
  nodeGraph?: NodeGraphOptions;
  uploadedJson?: string | ArrayBuffer | null = null;

  constructor(private instanceSettings: DataSourceInstanceSettings<TempoJsonData>) {
    super(instanceSettings);
    this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
    this.serviceMap = instanceSettings.jsonData.serviceMap;
    this.search = instanceSettings.jsonData.search;
    this.nodeGraph = instanceSettings.jsonData.nodeGraph;
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets.filter((target) => !target.hide);
    const targets: { [type: string]: TempoQuery[] } = groupBy(filteredTargets, (t) => t.queryType || 'traceId');

    // Run search queries on linked datasource
    if (this.tracesToLogs?.datasourceUid && targets.search?.length > 0) {
      const dsSrv = getDatasourceSrv();
      subQueries.push(
        from(dsSrv.get(this.tracesToLogs.datasourceUid)).pipe(
          mergeMap((linkedDatasource: DataSourceApi) => {
            // Wrap linked query into a data request based on original request
            const linkedRequest: DataQueryRequest = { ...options, targets: targets.search.map((t) => t.linkedQuery!) };
            // Find trace matchers in derived fields of the linked datasource that's identical to this datasource
            const settings: DataSourceInstanceSettings<LokiOptions> = (linkedDatasource as any).instanceSettings;
            const traceLinkMatcher: string[] =
              settings.jsonData.derivedFields
                ?.filter((field) => field.datasourceUid === this.uid && field.matcherRegex)
                .map((field) => field.matcherRegex) || [];
            if (!traceLinkMatcher || traceLinkMatcher.length === 0) {
              return throwError(
                () =>
                  new Error(
                    'No Loki datasource configured for search. Set up Derived Fields for traces in a Loki datasource settings and link it to this Tempo datasource.'
                  )
              );
            } else {
              return (linkedDatasource.query(linkedRequest) as Observable<DataQueryResponse>).pipe(
                map((response) =>
                  response.error ? response : transformTraceList(response, this.uid, this.name, traceLinkMatcher)
                )
              );
            }
          })
        )
      );
    }

    if (targets.nativeSearch?.length) {
      try {
        const searchQuery = this.buildSearchQuery(targets.nativeSearch[0]);
        subQueries.push(
          this._request('/api/search', searchQuery).pipe(
            map((response) => {
              return {
                data: [createTableFrameFromSearch(response.data.traces, this.instanceSettings)],
              };
            }),
            catchError((error) => {
              return of({ error: { message: error.data.message }, data: [] });
            })
          )
        );
      } catch (error) {
        return of({ error: { message: error.message }, data: [] });
      }
    }

    if (targets.upload?.length) {
      if (this.uploadedJson) {
        const otelTraceData = JSON.parse(this.uploadedJson as string);
        if (!otelTraceData.batches) {
          subQueries.push(of({ error: { message: 'JSON is not valid OpenTelemetry format' }, data: [] }));
        } else {
          subQueries.push(of(transformFromOTEL(otelTraceData.batches, this.nodeGraph?.enabled)));
        }
      } else {
        subQueries.push(of({ data: [], state: LoadingState.Done }));
      }
    }

    if (this.serviceMap?.datasourceUid && targets.serviceMap?.length > 0) {
      subQueries.push(serviceMapQuery(options, this.serviceMap.datasourceUid));
    }

    if (targets.traceId?.length > 0) {
      const traceRequest: DataQueryRequest<TempoQuery> = { ...options, targets: targets.traceId };
      subQueries.push(
        super.query(traceRequest).pipe(
          map((response) => {
            if (response.error) {
              return response;
            }
            return transformTrace(response, this.nodeGraph?.enabled);
          })
        )
      );
    }

    return merge(...subQueries);
  }

  async metadataRequest(url: string, params = {}) {
    return await this._request(url, params, { method: 'GET', hideFromInspector: true }).toPromise();
  }

  private _request(apiUrl: string, data?: any, options?: Partial<BackendSrvRequest>): Observable<Record<string, any>> {
    const params = data ? serializeParams(data) : '';
    const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = { ...options, url };

    return getBackendSrv().fetch(req);
  }

  async testDatasource(): Promise<any> {
    const options: BackendSrvRequest = {
      headers: {},
      method: 'GET',
      url: `${this.instanceSettings.url}/api/echo`,
    };
    const response = await getBackendSrv().fetch<any>(options).toPromise();

    if (response?.ok) {
      return { status: 'success', message: 'Data source is working' };
    }
  }

  getQueryDisplayText(query: TempoQuery) {
    if (query.queryType === 'nativeSearch') {
      let result = [];
      for (const key of ['serviceName', 'spanName', 'search', 'minDuration', 'maxDuration', 'limit']) {
        if (query.hasOwnProperty(key) && query[key as keyof TempoQuery]) {
          result.push(`${startCase(key)}: ${query[key as keyof TempoQuery]}`);
        }
      }
      return result.join(', ');
    }
    return query.query;
  }

  buildSearchQuery(query: TempoQuery) {
    const tokens = query.search ? Prism.tokenize(query.search, tokenizer) : [];

    // Build key value pairs
    let tagsQuery: Array<{ [key: string]: string }> = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      const token = tokens[i];
      const lookupToken = tokens[i + 2];

      // Ensure there is a valid key value pair with accurate types
      if (
        token &&
        lookupToken &&
        typeof token !== 'string' &&
        token.type === 'key' &&
        typeof token.content === 'string' &&
        typeof lookupToken !== 'string' &&
        lookupToken.type === 'value' &&
        typeof lookupToken.content === 'string'
      ) {
        tagsQuery.push({ [token.content]: lookupToken.content });
      }
    }

    let tempoQuery = pick(query, ['minDuration', 'maxDuration', 'limit']);
    // Remove empty properties
    tempoQuery = pickBy(tempoQuery, identity);

    if (query.serviceName) {
      tagsQuery.push({ ['service.name']: query.serviceName });
    }
    if (query.spanName) {
      tagsQuery.push({ ['name']: query.spanName });
    }

    // Set default limit
    if (!tempoQuery.limit) {
      tempoQuery.limit = DEFAULT_LIMIT;
    }

    // Validate query inputs and remove spaces if valid
    if (tempoQuery.minDuration) {
      if (!isValidGoDuration(tempoQuery.minDuration)) {
        throw new Error('Please enter a valid min duration.');
      }
      tempoQuery.minDuration = tempoQuery.minDuration.replace(/\s/g, '');
    }
    if (tempoQuery.maxDuration) {
      if (!isValidGoDuration(tempoQuery.maxDuration)) {
        throw new Error('Please enter a valid max duration.');
      }
      tempoQuery.maxDuration = tempoQuery.maxDuration.replace(/\s/g, '');
    }

    if (!Number.isInteger(tempoQuery.limit) || tempoQuery.limit <= 0) {
      throw new Error('Please enter a valid limit.');
    }

    const tagsQueryObject = tagsQuery.reduce((tagQuery, item) => ({ ...tagQuery, ...item }), {});
    return { ...tagsQueryObject, ...tempoQuery };
  }

  async getServiceGraphLabels() {
    const ds = await getDatasourceSrv().get(this.serviceMap!.datasourceUid);
    return ds.getTagKeys!();
  }

  async getServiceGraphLabelValues(key: string) {
    const ds = await getDatasourceSrv().get(this.serviceMap!.datasourceUid);
    return ds.getTagValues!({ key });
  }
}

function queryServiceMapPrometheus(request: DataQueryRequest<PromQuery>, datasourceUid: string) {
  return from(getDatasourceSrv().get(datasourceUid)).pipe(
    mergeMap((ds) => {
      return (ds as PrometheusDatasource).query(request);
    })
  );
}

function serviceMapQuery(request: DataQueryRequest<TempoQuery>, datasourceUid: string) {
  return queryServiceMapPrometheus(makePromServiceMapRequest(request), datasourceUid).pipe(
    // Just collect all the responses first before processing into node graph data
    toArray(),
    map((responses: DataQueryResponse[]) => {
      const errorRes = responses.find((res) => !!res.error);
      if (errorRes) {
        throw new Error(errorRes.error!.message);
      }

      const { nodes, edges } = mapPromMetricsToServiceMap(responses, request.range);
      nodes.fields[0].config = {
        links: [
          makePromLink('Total requests', totalsMetric, datasourceUid),
          makePromLink('Failed requests', failedMetric, datasourceUid),
        ],
      };

      return {
        data: [nodes, edges],
        state: LoadingState.Done,
      };
    })
  );
}

function makePromLink(title: string, metric: string, datasourceUid: string) {
  return {
    url: '',
    title,
    internal: {
      query: {
        expr: metric,
      } as PromQuery,
      datasourceUid,
      datasourceName: 'Prometheus',
    },
  };
}

function makePromServiceMapRequest(options: DataQueryRequest<TempoQuery>): DataQueryRequest<PromQuery> {
  return {
    ...options,
    targets: serviceMapMetrics.map((metric) => {
      return {
        refId: metric,
        // options.targets[0] is not correct here, but not sure what should happen if you have multiple queries for
        // service map at the same time anyway
        expr: `delta(${metric}${options.targets[0].serviceMapQuery || ''}[$__range])`,
        instant: true,
      };
    }),
  };
}
