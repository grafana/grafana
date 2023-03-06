import { each, indexOf, isArray, isString, map as _map } from 'lodash';
import { lastValueFrom, merge, Observable, of, OperatorFunction, pipe, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  AbstractLabelMatcher,
  AbstractLabelOperator,
  AbstractQuery,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceWithQueryExportSupport,
  dateMath,
  dateTime,
  MetricFindValue,
  QueryResultMetaStat,
  ScopedVars,
  TimeRange,
  TimeZone,
  toDataFrame,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { isVersionGtOrEq, SemVersion } from 'app/core/utils/version';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getRollupNotice, getRuntimeConsolidationNotice } from 'app/plugins/datasource/graphite/meta';

import { getSearchFilterScopedVar } from '../../../features/variables/utils';

import { AnnotationEditor } from './components/AnnotationsEditor';
import { convertToGraphiteQueryObject } from './components/helpers';
import gfunc, { FuncDefs, FuncInstance } from './gfunc';
import GraphiteQueryModel from './graphite_query';
import { prepareAnnotation } from './migrations';
// Types
import {
  GraphiteLokiMapping,
  GraphiteMetricLokiMatcher,
  GraphiteOptions,
  GraphiteQuery,
  GraphiteQueryImportConfiguration,
  GraphiteQueryRequest,
  GraphiteQueryType,
  GraphiteType,
  MetricTankRequestMeta,
} from './types';
import { reduceError } from './utils';
import { DEFAULT_GRAPHITE_VERSION } from './versions';

const GRAPHITE_TAG_COMPARATORS = {
  '=': AbstractLabelOperator.Equal,
  '!=': AbstractLabelOperator.NotEqual,
  '=~': AbstractLabelOperator.EqualRegEx,
  '!=~': AbstractLabelOperator.NotEqualRegEx,
};

/**
 * Converts Graphite glob-like pattern to a regular expression
 */
function convertGlobToRegEx(text: string): string {
  if (text.includes('*') || text.includes('{')) {
    return '^' + text.replace(/\*/g, '.*').replace(/\{/g, '(').replace(/}/g, ')').replace(/,/g, '|');
  } else {
    return text;
  }
}

export class GraphiteDatasource
  extends DataSourceApi<GraphiteQuery, GraphiteOptions, GraphiteQueryImportConfiguration>
  implements DataSourceWithQueryExportSupport<GraphiteQuery>
{
  basicAuth: string;
  url: string;
  name: string;
  graphiteVersion: any;
  supportsTags: boolean;
  isMetricTank: boolean;
  rollupIndicatorEnabled: boolean;
  cacheTimeout: any;
  withCredentials: boolean;
  funcDefs: FuncDefs | null = null;
  funcDefsPromise: Promise<any> | null = null;
  _seriesRefLetters: string;
  requestCounter = 100;
  private readonly metricMappings: GraphiteLokiMapping[];

  constructor(instanceSettings: any, private readonly templateSrv: TemplateSrv = getTemplateSrv()) {
    super(instanceSettings);
    this.basicAuth = instanceSettings.basicAuth;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    // graphiteVersion is set when a datasource is created but it hadn't been set in the past so we're
    // still falling back to the default behavior here for backwards compatibility (see also #17429)
    this.graphiteVersion = instanceSettings.jsonData.graphiteVersion || DEFAULT_GRAPHITE_VERSION;
    this.metricMappings = instanceSettings.jsonData.importConfiguration?.loki?.mappings || [];
    this.isMetricTank = instanceSettings.jsonData.graphiteType === GraphiteType.Metrictank;
    this.supportsTags = supportsTags(this.graphiteVersion);
    this.cacheTimeout = instanceSettings.cacheTimeout;
    this.rollupIndicatorEnabled = instanceSettings.jsonData.rollupIndicatorEnabled;
    this.withCredentials = instanceSettings.withCredentials;
    this.funcDefs = null;
    this.funcDefsPromise = null;
    this._seriesRefLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.annotations = {
      QueryEditor: AnnotationEditor,
      prepareAnnotation,
    };
  }

  getQueryOptionsInfo() {
    return {
      maxDataPoints: true,
      cacheTimeout: true,
      links: [
        {
          text: 'Help',
          url: 'http://docs.grafana.org/features/datasources/graphite/#using-graphite-in-grafana',
        },
      ],
    };
  }

  getImportQueryConfiguration(): GraphiteQueryImportConfiguration {
    return {
      loki: {
        mappings: this.metricMappings,
      },
    };
  }

  async exportToAbstractQueries(queries: GraphiteQuery[]): Promise<AbstractQuery[]> {
    return queries.map((query) => this.exportToAbstractQuery(query));
  }

  exportToAbstractQuery(query: GraphiteQuery): AbstractQuery {
    const graphiteQuery: GraphiteQueryModel = new GraphiteQueryModel(
      this,
      {
        ...query,
        target: query.target || '',
        textEditor: false,
      },
      getTemplateSrv()
    );
    graphiteQuery.parseTarget();

    let labels: AbstractLabelMatcher[] = [];
    const config = this.getImportQueryConfiguration().loki;

    if (graphiteQuery.seriesByTagUsed) {
      graphiteQuery.tags.forEach((tag) => {
        labels.push({
          name: tag.key,
          operator: GRAPHITE_TAG_COMPARATORS[tag.operator],
          value: tag.value,
        });
      });
    } else {
      const targetNodes = graphiteQuery.segments.map((segment) => segment.value);
      let mappings = config.mappings.filter((mapping) => mapping.matchers.length <= targetNodes.length);

      for (let mapping of mappings) {
        const matchers = mapping.matchers.concat();

        matchers.every((matcher: GraphiteMetricLokiMatcher, index: number) => {
          if (matcher.labelName) {
            let value = (targetNodes[index] as string)!;

            if (value === '*') {
              return true;
            }

            const converted = convertGlobToRegEx(value);
            labels.push({
              name: matcher.labelName,
              operator: converted !== value ? AbstractLabelOperator.EqualRegEx : AbstractLabelOperator.Equal,
              value: converted,
            });
            return true;
          }
          return targetNodes[index] === matcher.value || matcher.value === '*';
        });
      }
    }

    return {
      refId: query.refId,
      labelMatchers: labels,
    };
  }

  query(options: DataQueryRequest<GraphiteQuery>): Observable<DataQueryResponse> {
    if (options.targets.some((target: GraphiteQuery) => target.fromAnnotations)) {
      const streams: Array<Observable<DataQueryResponse>> = [];

      for (const target of options.targets) {
        streams.push(
          new Observable((subscriber) => {
            this.annotationEvents(options.range, target)
              .then((events) => subscriber.next({ data: [toDataFrame(events)] }))
              .catch((ex) => subscriber.error(new Error(ex)))
              .finally(() => subscriber.complete());
          })
        );
      }

      return merge(...streams);
    }

    // handle the queries here
    const graphOptions = {
      from: this.translateTime(options.range.from, false, options.timezone),
      until: this.translateTime(options.range.to, true, options.timezone),
      targets: options.targets,
      format: (options as GraphiteQueryRequest).format,
      cacheTimeout: options.cacheTimeout || this.cacheTimeout,
      maxDataPoints: options.maxDataPoints,
    };

    const params = this.buildGraphiteParams(graphOptions, options.scopedVars);
    if (params.length === 0) {
      return of({ data: [] });
    }

    if (this.isMetricTank) {
      params.push('meta=true');
    }

    const httpOptions: any = {
      method: 'POST',
      url: '/render',
      data: params.join('&'),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    this.addTracingHeaders(httpOptions, options);

    if (options.panelId) {
      httpOptions.requestId = this.name + '.panelId.' + options.panelId;
    }

    return this.doGraphiteRequest(httpOptions).pipe(map(this.convertResponseToDataFrames));
  }

  addTracingHeaders(httpOptions: { headers: any }, options: { dashboardId?: number; panelId?: number }) {
    const proxyMode = !this.url.match(/^http/);
    if (proxyMode) {
      if (options.dashboardId) {
        httpOptions.headers['X-Dashboard-Id'] = options.dashboardId;
      }
      if (options.panelId) {
        httpOptions.headers['X-Panel-Id'] = options.panelId;
      }
    }
  }

  convertResponseToDataFrames = (result: any): DataQueryResponse => {
    const data: DataFrame[] = [];
    if (!result || !result.data) {
      return { data };
    }

    // Series are either at the root or under a node called 'series'
    const series = result.data.series || result.data;

    if (!isArray(series)) {
      throw { message: 'Missing series in result', data: result };
    }

    for (let i = 0; i < series.length; i++) {
      const s = series[i];

      // Disables Grafana own series naming
      s.title = s.target;

      for (let y = 0; y < s.datapoints.length; y++) {
        s.datapoints[y][1] *= 1000;
      }

      const frame = toDataFrame(s);

      // Metrictank metadata
      if (s.meta) {
        frame.meta = {
          custom: {
            requestMetaList: result.data.meta, // info for the whole request
            seriesMetaList: s.meta, // Array of metadata
          },
        };

        if (this.rollupIndicatorEnabled) {
          const rollupNotice = getRollupNotice(s.meta);
          const runtimeNotice = getRuntimeConsolidationNotice(s.meta);

          if (rollupNotice) {
            frame.meta.notices = [rollupNotice];
          } else if (runtimeNotice) {
            frame.meta.notices = [runtimeNotice];
          }
        }

        // only add the request stats to the first frame
        if (i === 0 && result.data.meta.stats) {
          frame.meta.stats = this.getRequestStats(result.data.meta);
        }
      }

      data.push(frame);
    }

    return { data };
  };

  getRequestStats(meta: MetricTankRequestMeta): QueryResultMetaStat[] {
    const stats: QueryResultMetaStat[] = [];

    for (const key in meta.stats) {
      let unit: string | undefined = undefined;

      if (key.endsWith('.ms')) {
        unit = 'ms';
      }

      stats.push({ displayName: key, value: meta.stats[key], unit });
    }

    return stats;
  }

  parseTags(tagString: string) {
    let tags: string[] = [];
    tags = tagString.split(',');
    if (tags.length === 1) {
      tags = tagString.split(' ');
      if (tags[0] === '') {
        tags = [];
      }
    }
    return tags;
  }

  interpolateVariablesInQueries(queries: GraphiteQuery[], scopedVars: ScopedVars): GraphiteQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map((query) => {
        const expandedQuery = {
          ...query,
          datasource: this.getRef(),
          target: this.templateSrv.replace(query.target ?? '', scopedVars),
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  annotationEvents(range: any, target: any) {
    if (target.target) {
      // Graphite query as target as annotation
      const targetAnnotation = this.templateSrv.replace(target.target, {}, 'glob');
      const graphiteQuery = {
        range: range,
        targets: [{ target: targetAnnotation }],
        format: 'json',
        maxDataPoints: 100,
      } as unknown as DataQueryRequest<GraphiteQuery>;

      return lastValueFrom(
        this.query(graphiteQuery).pipe(
          map((result: any) => {
            const list = [];

            for (let i = 0; i < result.data.length; i++) {
              const target = result.data[i];

              for (let y = 0; y < target.length; y++) {
                const time = target.fields[0].values.get(y);
                const value = target.fields[1].values.get(y);

                if (!value) {
                  continue;
                }

                list.push({
                  annotation: target,
                  time,
                  title: target.name,
                });
              }
            }

            return list;
          })
        )
      );
    } else {
      // Graphite event/tag as annotation
      const tags = this.templateSrv.replace(target.tags?.join(' '));
      return this.events({ range: range, tags: tags }).then((results: any) => {
        const list = [];
        if (!isArray(results.data)) {
          console.error(`Unable to get annotations from ${results.url}.`);
          return [];
        }
        for (let i = 0; i < results.data.length; i++) {
          const e = results.data[i];

          let tags = e.tags;
          if (isString(e.tags)) {
            tags = this.parseTags(e.tags);
          }

          list.push({
            annotation: target,
            time: e.when * 1000,
            title: e.what,
            tags: tags,
            text: e.data,
          });
        }

        return list;
      });
    }
  }

  events(options: { range: TimeRange; tags: any; timezone?: any }) {
    try {
      let tags = '';
      if (options.tags) {
        tags = '&tags=' + options.tags;
      }
      return lastValueFrom(
        this.doGraphiteRequest({
          method: 'GET',
          url:
            '/events/get_data?from=' +
            this.translateTime(options.range.raw.from, false, options.timezone) +
            '&until=' +
            this.translateTime(options.range.raw.to, true, options.timezone) +
            tags,
        })
      );
    } catch (err) {
      return Promise.reject(err);
    }
  }

  targetContainsTemplate(target: GraphiteQuery) {
    return this.templateSrv.containsTemplate(target.target ?? '');
  }

  translateTime(date: any, roundUp: any, timezone: TimeZone) {
    if (isString(date)) {
      if (date === 'now') {
        return 'now';
      } else if (date.indexOf('now-') >= 0 && date.indexOf('/') === -1) {
        date = date.substring(3);
        date = date.replace('m', 'min');
        date = date.replace('M', 'mon');
        return date;
      }
      date = dateMath.parse(date, roundUp, timezone);
    }

    // graphite' s from filter is exclusive
    // here we step back one minute in order
    // to guarantee that we get all the data that
    // exists for the specified range
    if (roundUp) {
      if (date.get('s')) {
        date.add(1, 's');
      }
    } else if (roundUp === false) {
      if (date.get('s')) {
        date.subtract(1, 's');
      }
    }

    return date.unix();
  }

  metricFindQuery(findQuery: string | GraphiteQuery, optionalOptions?: any): Promise<MetricFindValue[]> {
    const options: any = optionalOptions || {};

    const queryObject = convertToGraphiteQueryObject(findQuery);
    if (queryObject.queryType === GraphiteQueryType.Value || queryObject.queryType === GraphiteQueryType.MetricName) {
      return this.requestMetricRender(queryObject, options, queryObject.queryType);
    }

    let query = queryObject.target ?? '';

    // First attempt to check for tag-related functions (using empty wildcard for interpolation)
    let interpolatedQuery = this.templateSrv.replace(
      query,
      getSearchFilterScopedVar({ query, wildcardChar: '', options: optionalOptions })
    );

    // special handling for tag_values(<tag>[,<expression>]*), this is used for template variables
    let allParams = interpolatedQuery.match(/^tag_values\((.*)\)$/);
    let expressions = allParams ? allParams[1].split(',').filter((p) => !!p) : undefined;
    if (expressions) {
      options.limit = 10000;
      return this.getTagValuesAutoComplete(expressions.slice(1), expressions[0], undefined, options);
    }

    // special handling for tags(<expression>[,<expression>]*), this is used for template variables
    allParams = interpolatedQuery.match(/^tags\((.*)\)$/);
    expressions = allParams ? allParams[1].split(',').filter((p) => !!p) : undefined;
    if (expressions) {
      options.limit = 10000;
      return this.getTagsAutoComplete(expressions, undefined, options);
    }

    // If no tag-related query was found, perform metric-based search (using * as the wildcard for interpolation)
    let useExpand = query.match(/^expand\((.*)\)$/);
    query = useExpand ? useExpand[1] : query;

    interpolatedQuery = this.templateSrv.replace(
      query,
      getSearchFilterScopedVar({ query, wildcardChar: '*', options: optionalOptions })
    );

    let range;
    if (options.range) {
      range = {
        from: this.translateTime(options.range.from, false, options.timezone),
        until: this.translateTime(options.range.to, true, options.timezone),
      };
    }

    if (useExpand) {
      return this.requestMetricExpand(interpolatedQuery, options.requestId, range);
    } else {
      return this.requestMetricFind(interpolatedQuery, options.requestId, range);
    }
  }

  /**
   * Search for metrics matching giving pattern using /metrics/render endpoint.
   * It will return all possible values or names and parse them based on queryType.
   * For example:
   *
   * queryType: GraphiteQueryType.Value
   * query: groupByNode(movingAverage(apps.country.IE.counters.requests.count, 10), 2, 'sum')
   * result: 239.4, 233.4, 230.8, 230.4, 233.9, 238, 239.8, 236.8, 235.8
   *
   * queryType: GraphiteQueryType.MetricName
   * query: highestAverage(carbon.agents.*.*, 5)
   * result: carbon.agents.aa6338c54341-a.memUsage, carbon.agents.aa6338c54341-a.committedPoints, carbon.agents.aa6338c54341-a.updateOperations, carbon.agents.aa6338c54341-a.metricsReceived, carbon.agents.aa6338c54341-a.activeConnections
   */
  private async requestMetricRender(
    queryObject: GraphiteQuery,
    options: any,
    queryType: GraphiteQueryType
  ): Promise<MetricFindValue[]> {
    const requestId: string = options.requestId ?? `Q${this.requestCounter++}`;
    const range: TimeRange = options.range ?? {
      from: dateTime().subtract(6, 'hour'),
      to: dateTime(),
      raw: {
        from: 'now - 6h',
        to: 'now',
      },
    };
    const queryReq: DataQueryRequest<GraphiteQuery> = {
      app: 'graphite-variable-editor',
      interval: '1s',
      intervalMs: 10000,
      startTime: Date.now(),
      targets: [{ ...queryObject }],
      timezone: 'browser',
      scopedVars: {},
      requestId,
      range,
    };
    const data: DataQueryResponse = await lastValueFrom(this.query(queryReq));

    let result: MetricFindValue[];

    if (queryType === GraphiteQueryType.Value) {
      result = data.data[0].fields[1].values
        .filter((f?: number) => !!f)
        .map((v: number) => ({
          text: v.toString(),
          value: v,
          expandable: false,
        }));
    } else if (queryType === GraphiteQueryType.MetricName) {
      result = data.data.map((series) => ({
        text: series.name,
        value: series.name,
        expandable: false,
      }));
    } else {
      result = [];
    }

    return Promise.resolve(result);
  }

  /**
   * Search for metrics matching giving pattern using /metrics/find endpoint. It will
   * return all possible values at the last level of the query, for example:
   *
   * metrics: prod.servers.001.cpu, prod.servers.002.cpu
   * query: *.servers.*
   * result: 001, 002
   *
   * For more complex searches use requestMetricExpand
   */
  private requestMetricFind(
    query: string,
    requestId: string,
    range?: { from: any; until: any }
  ): Promise<MetricFindValue[]> {
    const httpOptions: any = {
      method: 'POST',
      url: '/metrics/find',
      params: {},
      data: `query=${query}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // for cancellations
      requestId: requestId,
    };

    if (range) {
      httpOptions.params.from = range.from;
      httpOptions.params.until = range.until;
    }

    return lastValueFrom(
      this.doGraphiteRequest(httpOptions).pipe(
        map((results: any) => {
          return _map(results.data, (metric) => {
            return {
              text: metric.text,
              expandable: metric.expandable ? true : false,
            };
          });
        })
      )
    );
  }

  /**
   * Search for metrics matching giving pattern using /metrics/expand endpoint.
   * The result will contain all metrics (with full name) matching provided query.
   * It's a more flexible version of /metrics/find endpoint (@see requestMetricFind)
   */
  private requestMetricExpand(
    query: string,
    requestId: string,
    range?: { from: any; until: any }
  ): Promise<MetricFindValue[]> {
    const httpOptions: any = {
      method: 'GET',
      url: '/metrics/expand',
      params: { query },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // for cancellations
      requestId,
    };

    if (range) {
      httpOptions.params.from = range.from;
      httpOptions.params.until = range.until;
    }

    return lastValueFrom(
      this.doGraphiteRequest(httpOptions).pipe(
        map((results: any) => {
          return _map(results.data.results, (metric) => {
            return {
              text: metric,
              expandable: false,
            };
          });
        })
      )
    );
  }

  getTags(optionalOptions: any) {
    const options = optionalOptions || {};

    const httpOptions: any = {
      method: 'GET',
      url: '/tags',
      // for cancellations
      requestId: options.requestId,
    };

    if (options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
      httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
    }

    return lastValueFrom(
      this.doGraphiteRequest(httpOptions).pipe(
        map((results: any) => {
          return _map(results.data, (tag) => {
            return {
              text: tag.tag,
              id: tag.id,
            };
          });
        })
      )
    );
  }

  getTagValues(options: any = {}) {
    const httpOptions: any = {
      method: 'GET',
      url: '/tags/' + this.templateSrv.replace(options.key),
      // for cancellations
      requestId: options.requestId,
    };

    if (options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
      httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
    }

    return lastValueFrom(
      this.doGraphiteRequest(httpOptions).pipe(
        map((results: any) => {
          if (results.data && results.data.values) {
            return _map(results.data.values, (value) => {
              return {
                text: value.value,
                id: value.id,
              };
            });
          } else {
            return [];
          }
        })
      )
    );
  }

  getTagsAutoComplete(expressions: any[], tagPrefix: any, optionalOptions?: any) {
    const options = optionalOptions || {};

    const httpOptions: any = {
      method: 'GET',
      url: '/tags/autoComplete/tags',
      params: {
        expr: _map(expressions, (expression) => this.templateSrv.replace((expression || '').trim())),
      },
      // for cancellations
      requestId: options.requestId,
    };

    if (tagPrefix) {
      httpOptions.params.tagPrefix = tagPrefix;
    }
    if (options.limit) {
      httpOptions.params.limit = options.limit;
    }
    if (options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
      httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
    }
    return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(mapToTags()));
  }

  getTagValuesAutoComplete(expressions: any[], tag: any, valuePrefix: any, optionalOptions: any) {
    const options = optionalOptions || {};

    const httpOptions: any = {
      method: 'GET',
      url: '/tags/autoComplete/values',
      params: {
        expr: _map(expressions, (expression) => this.templateSrv.replace((expression || '').trim())),
        tag: this.templateSrv.replace((tag || '').trim()),
      },
      // for cancellations
      requestId: options.requestId,
    };

    if (valuePrefix) {
      httpOptions.params.valuePrefix = valuePrefix;
    }
    if (options.limit) {
      httpOptions.params.limit = options.limit;
    }
    if (options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
      httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
    }
    return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(mapToTags()));
  }

  getVersion(optionalOptions: any) {
    const options = optionalOptions || {};

    const httpOptions = {
      method: 'GET',
      url: '/version',
      requestId: options.requestId,
    };

    return lastValueFrom(
      this.doGraphiteRequest(httpOptions).pipe(
        map((results: any) => {
          if (results.data) {
            const semver = new SemVersion(results.data);
            return semver.isValid() ? results.data : '';
          }
          return '';
        }),
        catchError(() => {
          return of('');
        })
      )
    );
  }

  createFuncInstance(funcDef: any, options?: any): FuncInstance {
    return gfunc.createFuncInstance(funcDef, options, this.funcDefs);
  }

  getFuncDef(name: string) {
    return gfunc.getFuncDef(name, this.funcDefs);
  }

  waitForFuncDefsLoaded() {
    return this.getFuncDefs();
  }

  getFuncDefs() {
    if (this.funcDefsPromise !== null) {
      return this.funcDefsPromise;
    }

    if (!supportsFunctionIndex(this.graphiteVersion)) {
      this.funcDefs = gfunc.getFuncDefs(this.graphiteVersion);
      this.funcDefsPromise = Promise.resolve(this.funcDefs);
      return this.funcDefsPromise;
    }

    const httpOptions = {
      method: 'GET',
      url: '/functions',
      // add responseType because if this is not defined,
      // backend_srv defaults to json
      responseType: 'text',
    };

    return lastValueFrom(
      this.doGraphiteRequest(httpOptions).pipe(
        map((results: any) => {
          // Fix for a Graphite bug: https://github.com/graphite-project/graphite-web/issues/2609
          // There is a fix for it https://github.com/graphite-project/graphite-web/pull/2612 but
          // it was merged to master in July 2020 but it has never been released (the last Graphite
          // release was 1.1.7 - March 2020). The bug was introduced in Graphite 1.1.7, in versions
          // 1.1.0 - 1.1.6 /functions endpoint returns a valid JSON
          const fixedData = JSON.parse(results.data.replace(/"default": ?Infinity/g, '"default": 1e9999'));
          this.funcDefs = gfunc.parseFuncDefs(fixedData);
          return this.funcDefs;
        }),
        catchError((error: any) => {
          console.error('Fetching graphite functions error', error);
          this.funcDefs = gfunc.getFuncDefs(this.graphiteVersion);
          return of(this.funcDefs);
        })
      )
    );
  }

  testDatasource() {
    const query: DataQueryRequest<GraphiteQuery> = {
      app: 'graphite',
      interval: '10ms',
      intervalMs: 10,
      requestId: 'reqId',
      scopedVars: {},
      startTime: 0,
      timezone: 'browser',
      panelId: 3,
      rangeRaw: { from: 'now-1h', to: 'now' },
      range: {
        from: dateTime('now-1h'),
        to: dateTime('now'),
        raw: { from: 'now-1h', to: 'now' },
      },
      targets: [{ refId: 'A', target: 'constantLine(100)' }],
      maxDataPoints: 300,
    };

    return lastValueFrom(this.query(query)).then(() => ({ status: 'success', message: 'Data source is working' }));
  }

  doGraphiteRequest(options: {
    method?: string;
    url: any;
    requestId?: any;
    withCredentials?: any;
    headers?: any;
    inspect?: any;
  }) {
    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = options.headers || {};
      options.headers.Authorization = this.basicAuth;
    }

    options.url = this.url + options.url;
    options.inspect = { type: 'graphite' };

    return getBackendSrv()
      .fetch(options)
      .pipe(
        catchError((err: any) => {
          return throwError(reduceError(err));
        })
      );
  }

  buildGraphiteParams(options: any, scopedVars?: ScopedVars): string[] {
    const graphiteOptions = ['from', 'until', 'rawData', 'format', 'maxDataPoints', 'cacheTimeout'];
    const cleanOptions = [],
      targets: any = {};
    let target, targetValue, i;
    const regex = /\#([A-Z])/g;
    const intervalFormatFixRegex = /'(\d+)m'/gi;
    let hasTargets = false;

    options['format'] = 'json';

    function fixIntervalFormat(match: any) {
      return match.replace('m', 'min').replace('M', 'mon');
    }

    for (i = 0; i < options.targets.length; i++) {
      target = options.targets[i];
      if (!target.target) {
        continue;
      }

      if (!target.refId) {
        target.refId = this._seriesRefLetters[i];
      }

      targetValue = this.templateSrv.replace(target.target, scopedVars);
      targetValue = targetValue.replace(intervalFormatFixRegex, fixIntervalFormat);
      targets[target.refId] = targetValue;
    }

    function nestedSeriesRegexReplacer(match: any, g1: string | number) {
      return targets[g1] || match;
    }

    for (i = 0; i < options.targets.length; i++) {
      target = options.targets[i];
      if (!target.target) {
        continue;
      }

      targetValue = targets[target.refId];
      targetValue = targetValue.replace(regex, nestedSeriesRegexReplacer);
      targets[target.refId] = targetValue;

      if (!target.hide) {
        hasTargets = true;
        cleanOptions.push('target=' + encodeURIComponent(targetValue));
      }
    }

    each(options, (value, key) => {
      if (indexOf(graphiteOptions, key) === -1) {
        return;
      }
      if (value) {
        cleanOptions.push(key + '=' + encodeURIComponent(value));
      }
    });

    if (!hasTargets) {
      return [];
    }

    return cleanOptions;
  }
}

function supportsTags(version: string): boolean {
  return isVersionGtOrEq(version, '1.1');
}

function supportsFunctionIndex(version: string): boolean {
  return isVersionGtOrEq(version, '1.1');
}

function mapToTags(): OperatorFunction<any, Array<{ text: string }>> {
  return pipe(
    map((results: any) => {
      if (results.data) {
        return _map(results.data, (value) => {
          return { text: value };
        });
      } else {
        return [];
      }
    })
  );
}
