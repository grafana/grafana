import { identity, pick, pickBy, groupBy, startCase } from 'lodash';
import { EMPTY, from, merge, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, map, mergeMap, toArray } from 'rxjs/operators';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  FieldType,
  isValidGoDuration,
  LoadingState,
  ScopedVars,
} from '@grafana/data';
import {
  config,
  BackendSrvRequest,
  DataSourceWithBackend,
  getBackendSrv,
  TemplateSrv,
  getTemplateSrv,
} from '@grafana/runtime';
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
  totalsMetric,
  rateMetric,
  durationMetric,
  errorRateMetric,
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

  constructor(
    private instanceSettings: DataSourceInstanceSettings<TempoJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
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
        const query = this.applyVariables(targets.nativeSearch[0], options.scopedVars);
        const searchQuery = this.buildSearchQuery(query, timeRange);
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
      const dsid = this.serviceMap.datasourceUid;

      subQueries.push(
        firstServiceMapQuery(options, this.serviceMap.datasourceUid).pipe(
          concatMap((result) => secondServiceMapQuery(options, result, dsid, this.name))
        )
      );
    }

    if (targets.traceId?.length > 0) {
      subQueries.push(this.handleTraceIdQuery(options, targets.traceId));
    }

    return merge(...subQueries);
  }

  applyTemplateVariables(query: TempoQuery, scopedVars: ScopedVars): Record<string, any> {
    return this.applyVariables(query, scopedVars);
  }

  interpolateVariablesInQueries(queries: TempoQuery[], scopedVars: ScopedVars): TempoQuery[] {
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

  applyVariables(query: TempoQuery, scopedVars: ScopedVars) {
    const expandedQuery = { ...query };

    if (query.linkedQuery) {
      expandedQuery.linkedQuery = {
        ...query.linkedQuery,
        expr: this.templateSrv.replace(query.linkedQuery?.expr ?? '', scopedVars),
      };
    }

    return {
      ...expandedQuery,
      query: this.templateSrv.replace(query.query ?? '', scopedVars),
      search: this.templateSrv.replace(query.search ?? '', scopedVars),
      minDuration: this.templateSrv.replace(query.minDuration ?? '', scopedVars),
      maxDuration: this.templateSrv.replace(query.maxDuration ?? '', scopedVars),
    };
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
    const validTargets = targets.filter((t) => t.query).map((t) => ({ ...t, query: t.query.trim() }));
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
      tempoQuery.minDuration = this.templateSrv.replace(tempoQuery.minDuration ?? '');
      if (!isValidGoDuration(tempoQuery.minDuration)) {
        throw new Error('Please enter a valid min duration.');
      }
      tempoQuery.minDuration = tempoQuery.minDuration.replace(/\s/g, '');
    }
    if (tempoQuery.maxDuration) {
      tempoQuery.maxDuration = this.templateSrv.replace(tempoQuery.maxDuration ?? '');
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

function firstServiceMapQuery(request: DataQueryRequest<TempoQuery>, datasourceUid: string) {
  const serviceMapRequest = makePromServiceMapRequest(request);
  serviceMapRequest.targets = makeApmRequest([buildExpr(rateMetric, '', request)]).concat(
    serviceMapRequest.targets as any
  );

  return queryServiceMapPrometheus(serviceMapRequest, datasourceUid).pipe(
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

      return {
        data: [responses, nodes, edges],
        state: LoadingState.Done,
      };
    })
  );
}

// we need the response from the first query to get the rate span_name(s),
// -> which determine the errorRate/duration span_name(s) we need to query
function secondServiceMapQuery(
  request: DataQueryRequest<TempoQuery>,
  firstResponses: DataQueryResponse,
  datasourceUid: string,
  tempoDatasourceUid: string
) {
  var apmMetrics = [];
  const spanNames = firstResponses.data[0][0]?.data[0]?.fields[1]?.values.toArray() ?? [];
  const errorRateBySpanName = buildExpr(errorRateMetric, 'span_name=~"' + spanNames.join('|') + '"', request);
  apmMetrics.push(errorRateBySpanName);

  const durationBySpanName: any = [];
  spanNames.map((name: string) => {
    const metric = buildExpr(durationMetric, 'span_name=~"' + name + '"', request);
    durationBySpanName.push(metric);
    apmMetrics.push(metric);
  });

  const serviceMapRequest = makePromServiceMapRequest(request);
  serviceMapRequest.targets = makeApmRequest(apmMetrics);

  return queryServiceMapPrometheus(serviceMapRequest, datasourceUid).pipe(
    // Just collect all the responses first before processing into node graph data
    toArray(),
    map((secondResponses: DataQueryResponse[]) => {
      const errorRes = secondResponses.find((res) => !!res.error);
      if (errorRes) {
        throw new Error(errorRes.error!.message);
      }

      const apmTable = getApmTable(
        request,
        firstResponses,
        secondResponses[0],
        errorRateBySpanName,
        durationBySpanName,
        datasourceUid,
        tempoDatasourceUid
      );

      return {
        data: [apmTable, firstResponses.data[1], firstResponses.data[2]],
        state: LoadingState.Done,
      };
    })
  );
}

function makePromLink(title: string, expr: string, datasourceUid: string, instant: boolean) {
  return {
    url: '',
    title,
    internal: {
      query: {
        expr: expr,
        range: !instant,
        exemplar: !instant,
        instant: instant,
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
        expr: `rate(${metric}${options.targets[0].serviceMapQuery || ''}[$__range])`,
        instant: true,
      };
    }),
  };
}

// APM Table
/////////////////////////

function getApmTable(
  request: DataQueryRequest<TempoQuery>,
  firstResponse: DataQueryResponse,
  secondResponse: DataQueryResponse,
  errorRateBySpanName: string,
  durationBySpanName: string[],
  datasourceUid: string,
  tempoDatasourceUid: string
) {
  var df: any = {};
  const rate = firstResponse.data[0][0].data.filter((x: { refId: string }) => {
    return x.refId === buildExpr(rateMetric, '', request);
  });
  const errorRate = secondResponse.data.filter((x) => {
    return x.refId === errorRateBySpanName;
  });
  const duration = secondResponse.data.filter((x) => {
    return durationBySpanName.includes(x.refId);
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
        links: [makePromLink('Rate', buildLinkExp(rateMetric), datasourceUid, false)],
        decimals: 2,
      },
    });

    df.fields.push({
      ...rate[0].fields[2],
      name: ' ',
      labels: null,
      config: {
        color: {
          mode: 'continuous-BlPu',
        },
        custom: {
          displayMode: 'lcd-gauge',
        },
        decimals: 3,
      },
    });
  }

  if (errorRate.length > 0 && errorRate[0].fields?.length > 2) {
    const errorRateNames = errorRate[0].fields[1]?.values.toArray() ?? [];
    const errorRateValues = errorRate[0].fields[2]?.values.toArray() ?? [];
    let errorRateObj: any = {};
    errorRateNames.map((name: string, index: number) => {
      errorRateObj[name] = { name: name, value: errorRateValues[index] };
    });

    const values = getRateAlignedValues(rate, errorRateObj);

    df.fields.push({
      ...errorRate[0].fields[2],
      name: 'Error Rate',
      values: values,
      config: {
        links: [makePromLink('Error Rate', buildLinkExp(errorRateMetric), datasourceUid, false)],
        decimals: 2,
      },
    });

    df.fields.push({
      ...errorRate[0].fields[2],
      name: '  ',
      values: values,
      labels: null,
      config: {
        color: {
          mode: 'continuous-RdYlGr',
        },
        custom: {
          displayMode: 'lcd-gauge',
        },
        decimals: 3,
      },
    });
  }

  if (duration.length > 0 && duration[0].fields?.length > 1) {
    let durationObj: any = {};
    duration.map((d) => {
      const delimiter = d.refId.includes('span_name=~"') ? 'span_name=~"' : 'span_name="';
      const name = d.refId.split(delimiter)[1].split('"}')[0];
      durationObj[name] = { name: name, value: d.fields[1]?.values.toArray()[0] };
    });

    df.fields.push({
      ...duration[0].fields[1],
      name: 'Duration (p90)',
      values: getRateAlignedValues(rate, durationObj),
      config: {
        links: [makePromLink('Duration', buildLinkExp(durationMetric), datasourceUid, false)],
        unit: 'ms',
        decimals: 3,
      },
    });
  }

  if (df.fields.length > 0 && df.fields[0].values) {
    df.fields.push({
      name: 'Links',
      type: FieldType.string,
      values: df.fields[0].values.map(() => {
        return 'Tempo';
      }),
      config: {
        links: [makeTempoLink('Tempo', `\${__data.fields[0]}`, tempoDatasourceUid)],
      },
    });
  }

  return df;
}

function buildExpr(metric: any, extraParams: any, request: any) {
  let serviceMapQuery = request.targets[0]?.serviceMapQuery.replace('{', '').replace('}', '') ?? '';
  // map serviceGraph metric tags to APM metric tags
  serviceMapQuery = serviceMapQuery.replace('client', 'service').replace('server', 'service');
  const metricParams = serviceMapQuery.includes('span_name')
    ? metric.params.concat(serviceMapQuery)
    : metric.params
        .concat(serviceMapQuery)
        .concat(extraParams)
        .filter((item: string) => item);
  const expr = metric.expr.replace('{}', '{' + metricParams.join(',') + '}');
  return expr;
}

function buildLinkExp(metric: any) {
  return metric.expr.replace('{}', '{' + metric.params.concat('span_name="${__data.fields[0]}"}').join(','));
}

// query result frames can come back in any order
// here we align the table col values to the same row name (rateName) across the table
function getRateAlignedValues(rateResp: DataQueryResponseData[], objToAlign: any) {
  const rateNames = rateResp[0].fields[1]?.values.toArray().sort() ?? [];
  let tempRateNames = rateNames;
  let values: string[] = [];

  objToAlign = Object.keys(objToAlign)
    .sort()
    .reduce((obj: any, key) => {
      obj[key] = objToAlign[key];
      return obj;
    }, {});

  for (var i = 0; i < rateNames.length; i++) {
    if (tempRateNames[i]) {
      if (tempRateNames[i] === Object.keys(objToAlign)[i]) {
        values.push(objToAlign[Object.keys(objToAlign)[i]].value);
      } else {
        i--;
        tempRateNames = tempRateNames.slice(1);
        values.push('0');
      }
    }
  }

  return values;
}

function makeApmRequest(metrics: any[]) {
  return metrics.map((metric) => {
    return {
      refId: metric,
      expr: metric,
      instant: true,
    };
  });
}

function makeTempoLink(title: string, spanName: string, tempoDatasourceUid: string) {
  return {
    url: '',
    title,
    internal: {
      query: {
        queryType: 'nativeSearch',
        spanName: spanName,
      } as TempoQuery,
      datasourceUid: tempoDatasourceUid,
      datasourceName: 'Tempo',
    },
  };
}
