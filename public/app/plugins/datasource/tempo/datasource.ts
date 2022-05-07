import { identity, pick, pickBy, groupBy, startCase } from 'lodash';
import { EMPTY, from, merge, Observable, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';

import {
  ArrayVector,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  FieldType,
  isValidGoDuration,
  LoadingState,
  toDataFrame,
} from '@grafana/data';
import { config, BackendSrvRequest, DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { NodeGraphOptions } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { serializeParams } from 'app/core/utils/fetch';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { LokiOptions, LokiQuery } from '../loki/types';
import { PrometheusDatasource } from '../prometheus/datasource';
import { PromQuery } from '../prometheus/types';

import {
  failedMetric,
  histogramMetric,
  mapPromMetricsToServiceMap,
  serviceMapMetrics,
  apmMetrics,
  totalsMetric,
  rateMetric,
  rateTrendMetric,
  durationMetric,
  errorRateMetric,
  errorRateTrendMetric,
} from './graphTransform';
import {
  transformTrace,
  transformTraceList,
  transformFromOTLP as transformFromOTEL,
  createTableFrameFromSearch,
} from './resultTransformer';

// search = Loki search, nativeSearch = Tempo search for backwards compatibility
export type TempoQueryType = 'search' | 'traceId' | 'serviceMap' | 'upload' | 'nativeSearch' | 'clear';

export interface TempoJsonData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };
  search?: {
    hide?: boolean;
  };
  nodeGraph?: NodeGraphOptions;
  lokiSearch?: {
    datasourceUid?: string;
  };
}

export interface TempoQuery extends DataQuery {
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
}

interface SearchQueryParams {
  minDuration?: string;
  maxDuration?: string;
  limit?: number;
  tags: string;
  start?: number;
  end?: number;
}

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
  lokiSearch?: {
    datasourceUid?: string;
  };
  uploadedJson?: string | ArrayBuffer | null = null;

  constructor(private instanceSettings: DataSourceInstanceSettings<TempoJsonData>) {
    super(instanceSettings);
    this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
    this.serviceMap = instanceSettings.jsonData.serviceMap;
    this.search = instanceSettings.jsonData.search;
    this.nodeGraph = instanceSettings.jsonData.nodeGraph;
    this.lokiSearch = instanceSettings.jsonData.lokiSearch;
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets.filter((target) => !target.hide);
    const targets: { [type: string]: TempoQuery[] } = groupBy(filteredTargets, (t) => t.queryType || 'traceId');

    if (targets.clear) {
      return of({ data: [], state: LoadingState.Done });
    }

    const logsDatasourceUid = this.getLokiSearchDS();

    // Run search queries on linked datasource
    if (logsDatasourceUid && targets.search?.length > 0) {
      const dsSrv = getDatasourceSrv();
      subQueries.push(
        from(dsSrv.get(logsDatasourceUid)).pipe(
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
        const timeRange = config.featureToggles.tempoBackendSearch
          ? { startTime: options.range.from.unix(), endTime: options.range.to.unix() }
          : undefined;
        const searchQuery = this.buildSearchQuery(targets.nativeSearch[0], timeRange);
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
      subQueries.push(this.handleTraceIdQuery(options, targets.traceId));
    }

    return merge(...subQueries);
  }

  /**
   * Handles the simplest of the queries where we have just a trace id and return trace data for it.
   * @param options
   * @param targets
   * @private
   */
  private handleTraceIdQuery(
    options: DataQueryRequest<TempoQuery>,
    targets: TempoQuery[]
  ): Observable<DataQueryResponse> {
    const validTargets = targets.filter((t) => t.query);
    if (!validTargets.length) {
      return EMPTY;
    }

    const traceRequest: DataQueryRequest<TempoQuery> = { ...options, targets: validTargets };
    return super.query(traceRequest).pipe(
      map((response) => {
        if (response.error) {
          return response;
        }
        return transformTrace(response, this.nodeGraph?.enabled);
      })
    );
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

  buildSearchQuery(query: TempoQuery, timeRange?: { startTime: number; endTime?: number }): SearchQueryParams {
    let tags = query.search ?? '';

    let tempoQuery = pick(query, ['minDuration', 'maxDuration', 'limit']);
    // Remove empty properties
    tempoQuery = pickBy(tempoQuery, identity);

    if (query.serviceName) {
      tags += ` service.name="${query.serviceName}"`;
    }
    if (query.spanName) {
      tags += ` name="${query.spanName}"`;
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

    let searchQuery: SearchQueryParams = { tags, ...tempoQuery };

    if (timeRange) {
      searchQuery.start = timeRange.startTime;
      searchQuery.end = timeRange.endTime;
    }

    return searchQuery;
  }

  async getServiceGraphLabels() {
    const ds = await getDatasourceSrv().get(this.serviceMap!.datasourceUid);
    return ds.getTagKeys!();
  }

  async getServiceGraphLabelValues(key: string) {
    const ds = await getDatasourceSrv().get(this.serviceMap!.datasourceUid);
    return ds.getTagValues!({ key });
  }

  // Get linked loki search datasource. Fall back to legacy loki search/trace to logs config
  getLokiSearchDS = (): string | undefined => {
    const legacyLogsDatasourceUid =
      this.tracesToLogs?.lokiSearch !== false && this.lokiSearch === undefined
        ? this.tracesToLogs?.datasourceUid
        : undefined;
    return this.lokiSearch?.datasourceUid ?? legacyLogsDatasourceUid;
  };
}

function queryServiceMapPrometheus(request: DataQueryRequest<PromQuery>, datasourceUid: string) {
  return from(getDatasourceSrv().get(datasourceUid)).pipe(
    mergeMap((ds) => {
      return (ds as PrometheusDatasource).query(request);
    })
  );
}

function serviceMapQuery(request: DataQueryRequest<TempoQuery>, datasourceUid: string) {
  const serviceMapRequest = makePromServiceMapRequest(request);
  const combinedRequest = addApmMetricsToRequest(request, serviceMapRequest);

  return queryServiceMapPrometheus(combinedRequest, datasourceUid).pipe(
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
          makePromLink(
            'Request rate',
            `rate(${totalsMetric}{server="\${__data.fields.id}"}[$__rate_interval])`,
            datasourceUid,
            false
          ),
          makePromLink(
            'Request histogram',
            `histogram_quantile(0.9, sum(rate(${histogramMetric}{server="\${__data.fields.id}"}[$__rate_interval])) by (le, client, server))`,
            datasourceUid,
            false
          ),
          makePromLink(
            'Failed request rate',
            `rate(${failedMetric}{server="\${__data.fields.id}"}[$__rate_interval])`,
            datasourceUid,
            false
          ),
        ],
      };

      const apmTableFrame = getApmTableFrame(responses, request, datasourceUid);

      return {
        data: [apmTableFrame, nodes, edges],
        state: LoadingState.Done,
      };
    })
  );
}

function getApmTableFrame(
  responses: DataQueryResponse[],
  request: DataQueryRequest<TempoQuery>,
  datasourceUid: string
) {
  var df: any = {};
  // filter does not return table results
  if (responses[0].data.length <= 4) {
    df = toDataFrame([]);
  } else {
    const rate = responses[0].data.filter((x) => {
      return x.refId === rateMetric.query;
    });
    const rateTrend = responses[0].data.filter((x) => {
      return x.refId === rateTrendMetric.query;
    });
    const errorRate = responses[0].data.filter((x) => {
      return x.refId === errorRateMetric.query;
    });
    const errorRateTrend = responses[0].data.filter((x) => {
      return x.refId === errorRateTrendMetric.query;
    });
    const duration = responses[0].data.filter((x) => {
      return x.refId === durationMetric.query;
    });

    df.fields = [];
    if (rate.length > 0 && rate[0].fields?.length > 2) {
      df.fields.push({
        ...rate[0].fields[1],
        name: 'Name',
      });

      df.fields.push({
        ...rate[0].fields[2],
        name: 'Rate',
        config: {
          links: [
            makePromLink(
              rateMetric.query,
              buildExpr(rateMetric.query, request.targets[0].serviceMapQuery),
              datasourceUid,
              rateMetric.instant
            ),
          ],
        },
      });
    }

    if (rateTrend.length > 0 && rateTrend[0].fields?.length > 1) {
      var values = [];
      for (const frame in rateTrend) {
        values.push(rateTrend[frame].fields[1].values.toArray());
      }

      df.fields.push({
        ...rateTrend[0].fields[1],
        values: new ArrayVector(values),
        name: 'Trend (Rate)',
        labels: null,
        config: {
          color: {
            mode: 'continuous-BlPu',
          },
          custom: {
            displayMode: 'area-chart',
          },
        },
      });
    }

    if (errorRate.length > 0 && errorRate[0].fields?.length > 2) {
      df.fields.push({
        ...errorRate[0].fields[2],
        name: 'Error Rate',
        config: {
          links: [
            makePromLink(
              errorRateMetric.query,
              buildExpr(errorRateMetric.query, request.targets[0].serviceMapQuery),
              datasourceUid,
              errorRateMetric.instant
            ),
          ],
        },
      });
    }

    if (errorRateTrend.length > 0 && errorRateTrend[0].fields?.length > 2) {
      df.fields.push({
        ...errorRateTrend[0].fields[2],
        name: 'Trend (Error Rate)',
        labels: null,
        config: {
          color: {
            mode: 'continuous-BlPu',
          },
          custom: {
            displayMode: 'lcd-gauge',
          },
        },
      });
    }

    if (duration.length > 0 && duration[0].fields?.length > 1) {
      df.fields.push({
        ...duration[0].fields[1],
        name: 'Duration',
        config: {
          links: [
            makePromLink(
              durationMetric.query,
              buildExpr(durationMetric.query, request.targets[0].serviceMapQuery),
              datasourceUid,
              durationMetric.instant
            ),
          ],
        },
      });
    }

    if (df.fields.length > 0 && df.fields[0].values) {
      var linkTitles = [];
      for (var i = 0; i < df.fields[0].values.length; i++) {
        linkTitles.push('Tempo');
      }

      df.fields.push({
        name: 'Links',
        type: FieldType.string,
        values: new ArrayVector(linkTitles),
        config: {
          custom: {
            instant: true,
          },
          links: [makeTempoLink('traces_spanmetrics_calls_total', '')],
        },
      });
    }
  }

  return df;
}

function makePromLink(title: string, metric: string, datasourceUid: string, instant: boolean) {
  return {
    url: '',
    title,
    internal: {
      query: {
        expr: metric,
        instant: instant,
      } as PromQuery,
      datasourceUid,
      datasourceName: 'Prometheus',
    },
  };
}

function makeTempoLink(title: string, query: string) {
  return {
    url: '',
    title,
    internal: {
      query: {
        queryType: 'nativeSearch',
        serviceName: 'app',
        spanName: 'HTTP Client',
      } as TempoQuery,
      datasourceUid: 'gdev-tempo-joey',
      datasourceName: 'Tempo',
    },
  };
}

function buildExpr(metric: string, serviceMapQuery: string | undefined) {
  if (!serviceMapQuery || serviceMapQuery === '{}') {
    const replaceString = metric.includes(',REPLACE_STRING') ? ',REPLACE_STRING' : 'REPLACE_STRING';
    return `${metric.replace(replaceString, '')}`;
  }
  // map serviceGraph metric tags to APM metric tags
  serviceMapQuery = serviceMapQuery.replace('client', 'service').replace('server', 'service');
  serviceMapQuery = serviceMapQuery.replace('{', '').replace('}', '');
  return `${metric.replace('REPLACE_STRING', serviceMapQuery)}`;
}

function addApmMetricsToRequest(
  options: DataQueryRequest<TempoQuery>,
  promQuery: DataQueryRequest<PromQuery>
): DataQueryRequest<PromQuery> {
  const metrics = apmMetrics.map((metric) => {
    const expr = buildExpr(metric.query, options.targets[0].serviceMapQuery);
    return {
      refId: metric.query,
      expr: expr,
      instant: metric.instant,
    };
  });

  promQuery.targets = metrics.concat(promQuery.targets as any);
  return promQuery;
}

function makePromServiceMapRequest(options: DataQueryRequest<TempoQuery>): DataQueryRequest<PromQuery> {
  return {
    ...options,
    targets: serviceMapMetrics.map((metric) => {
      return {
        refId: metric,
        // options.targets[0] is not correct here, but not sure what should happen if you have multiple queries for
        // service map at the same time anyway
        expr: `rate(${metric}${options.targets[0].serviceMapQuery || ''}[$__range])`,
        instant: true,
      };
    }),
  };
}
