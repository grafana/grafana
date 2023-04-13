import { cloneDeep, extend, groupBy, has, isString, map as _map, omit, pick, reduce } from 'lodash';
import { defer, lastValueFrom, merge, mergeMap, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  AnnotationEvent,
  ArrayVector,
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateMath,
  FieldType,
  MetricFindValue,
  QueryResultMeta,
  ScopedVars,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
  TimeSeries,
  toDataFrame,
} from '@grafana/data';
import {
  BackendDataSourceResponse,
  DataSourceWithBackend,
  FetchResponse,
  frameToMetricFindValue,
  getBackendSrv,
} from '@grafana/runtime';
import config from 'app/core/config';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { AnnotationEditor } from './components/AnnotationEditor';
import { FluxQueryEditor } from './components/FluxQueryEditor';
import { BROWSER_MODE_DISABLED_MESSAGE } from './constants';
import { getAllPolicies } from './influxQLMetadataQuery';
import InfluxQueryModel from './influx_query_model';
import InfluxSeries from './influx_series';
import { prepareAnnotation } from './migrations';
import { buildRawQuery, replaceHardCodedRetentionPolicy } from './queryUtils';
import ResponseParser from './response_parser';
import { InfluxOptions, InfluxQuery, InfluxVersion } from './types';

// we detect the field type based on the value-array
function getFieldType(values: unknown[]): FieldType {
  // the values-array may contain a lot of nulls.
  // we need the first not-null item
  const firstNotNull = values.find((v) => v !== null);

  if (firstNotNull === undefined) {
    // we could not find any not-null values
    return FieldType.number;
  }

  const valueType = typeof firstNotNull;

  switch (valueType) {
    case 'string':
      return FieldType.string;
    case 'boolean':
      return FieldType.boolean;
    case 'number':
      return FieldType.number;
    default:
      // this should never happen, influxql values
      // can only be numbers, strings and booleans.
      throw new Error(`InfluxQL: invalid value type ${valueType}`);
  }
}

// this conversion function is specialized to work with the timeseries
// data returned by InfluxDatasource.getTimeSeries()
function timeSeriesToDataFrame(timeSeries: TimeSeries): DataFrame {
  const times: number[] = [];
  const values: unknown[] = [];

  // the data we process here is not correctly typed.
  // the typescript types say every data-point is number|null,
  // but in fact it can be string or boolean too.

  const points = timeSeries.datapoints;
  for (const point of points) {
    values.push(point[0]);
    times.push(point[1] as number);
  }

  const timeField = {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {},
    values: new ArrayVector<number>(times),
  };

  const valueField = {
    name: TIME_SERIES_VALUE_FIELD_NAME,
    type: getFieldType(values),
    config: {
      displayNameFromDS: timeSeries.title,
    },
    values: new ArrayVector<unknown>(values),
    labels: timeSeries.tags,
  };

  const fields = [timeField, valueField];

  return {
    name: timeSeries.target,
    refId: timeSeries.refId,
    meta: timeSeries.meta,
    fields,
    length: values.length,
  };
}

export default class InfluxDatasource extends DataSourceWithBackend<InfluxQuery, InfluxOptions> {
  type: string;
  urls: string[];
  username: string;
  password: string;
  name: string;
  database: any;
  basicAuth: any;
  withCredentials: any;
  access: 'direct' | 'proxy';
  interval: any;
  responseParser: ResponseParser;
  httpMode: string;
  isFlux: boolean;
  isProxyAccess: boolean;
  retentionPolicies: string[];

  constructor(
    instanceSettings: DataSourceInstanceSettings<InfluxOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);

    this.type = 'influxdb';
    this.urls = (instanceSettings.url ?? '').split(',').map((url) => {
      return url.trim();
    });

    this.username = instanceSettings.username ?? '';
    this.password = instanceSettings.password ?? '';
    this.name = instanceSettings.name;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.access = instanceSettings.access;
    const settingsData = instanceSettings.jsonData || ({} as InfluxOptions);
    this.database = settingsData.dbName ?? instanceSettings.database;
    this.interval = settingsData.timeInterval;
    this.httpMode = settingsData.httpMode || 'GET';
    this.responseParser = new ResponseParser();
    this.isFlux = settingsData.version === InfluxVersion.Flux;
    this.isProxyAccess = instanceSettings.access === 'proxy';
    this.retentionPolicies = [];

    if (this.isFlux) {
      // When flux, use an annotation processor rather than the `annotationQuery` lifecycle
      this.annotations = {
        QueryEditor: FluxQueryEditor,
      };
    } else {
      this.annotations = {
        QueryEditor: AnnotationEditor,
        prepareAnnotation,
      };
    }
  }

  async getRetentionPolicies(): Promise<string[]> {
    if (this.retentionPolicies.length) {
      return Promise.resolve(this.retentionPolicies);
    } else {
      return getAllPolicies(this);
    }
  }

  query(request: DataQueryRequest<InfluxQuery>): Observable<DataQueryResponse> {
    if (!this.isProxyAccess) {
      const error = new Error(BROWSER_MODE_DISABLED_MESSAGE);
      return throwError(() => error);
    }

    // When the dashboard first load or on dashboard panel edit mode
    // PanelQueryRunner runs the queries to have a visualization on the panel.
    // At that point datasource doesn't have the retention policies fetched.
    // So hardcoded policy is being sent. Which causes problems.
    // To overcome this we check/load policies first and then do the query.
    return defer(() => this.getRetentionPolicies()).pipe(
      mergeMap((allPolicies) => {
        this.retentionPolicies = allPolicies;
        const policyFixedRequests = {
          ...request,
          targets: request.targets.map((t) => ({
            ...t,
            policy: replaceHardCodedRetentionPolicy(t.policy, this.retentionPolicies),
          })),
        };
        return this._query(policyFixedRequests);
      })
    );
  }

  _query(request: DataQueryRequest<InfluxQuery>): Observable<DataQueryResponse> {
    // for not-flux queries we call `this.classicQuery`, and that
    // handles the is-hidden situation.
    // for the flux-case, we do the filtering here
    const filteredRequest = {
      ...request,
      targets: request.targets.filter((t) => t.hide !== true),
    };

    if (this.isFlux) {
      return super.query(filteredRequest);
    }

    if (this.isMigrationToggleOnAndIsAccessProxy()) {
      return super.query(filteredRequest).pipe(
        map((res) => {
          if (res.error) {
            throw {
              message: 'InfluxDB Error: ' + res.error.message,
              res,
            };
          }

          const seriesList: any[] = [];

          const groupedFrames = groupBy(res.data, (x) => x.refId);
          if (Object.keys(groupedFrames).length > 0) {
            filteredRequest.targets.forEach((target) => {
              const filteredFrames = groupedFrames[target.refId] ?? [];
              switch (target.resultFormat) {
                case 'logs':
                case 'table':
                  seriesList.push(
                    this.responseParser.getTable(filteredFrames, target, {
                      preferredVisualisationType: target.resultFormat,
                    })
                  );
                  break;
                default: {
                  for (let i = 0; i < filteredFrames.length; i++) {
                    seriesList.push(filteredFrames[i]);
                  }
                  break;
                }
              }
            });
          }

          return { data: seriesList };
        })
      );
    }

    // Fallback to classic query support
    return this.classicQuery(request);
  }

  getQueryDisplayText(query: InfluxQuery) {
    if (this.isFlux) {
      return query.query;
    }
    return new InfluxQueryModel(query).render(false);
  }

  /**
   * Returns false if the query should be skipped
   */
  filterQuery(query: InfluxQuery): boolean {
    if (this.isFlux) {
      return !!query.query;
    }
    return true;
  }

  applyTemplateVariables(query: InfluxQuery, scopedVars: ScopedVars): Record<string, any> {
    // We want to interpolate these variables on backend
    const { __interval, __interval_ms, ...rest } = scopedVars || {};

    if (this.isFlux) {
      return {
        ...query,
        query: this.templateSrv.replace(query.query ?? '', rest), // The raw query text
      };
    }

    if (config.featureToggles.influxdbBackendMigration && this.access === 'proxy') {
      query = this.applyVariables(query, scopedVars, rest);
    }

    return query;
  }

  /**
   * The unchanged pre 7.1 query implementation
   */
  classicQuery(options: any): Observable<DataQueryResponse> {
    // migrate annotations
    if (options.targets.some((target: InfluxQuery) => target.fromAnnotations)) {
      const streams: Array<Observable<DataQueryResponse>> = [];

      for (const target of options.targets) {
        if (target.query) {
          streams.push(
            new Observable((subscriber) => {
              this.annotationEvents(options, target)
                .then((events) => subscriber.next({ data: [toDataFrame(events)] }))
                .catch((ex) => subscriber.error(new Error(ex)))
                .finally(() => subscriber.complete());
            })
          );
        }
      }

      return merge(...streams);
    }

    let timeFilter = this.getTimeFilter(options);
    const scopedVars = options.scopedVars;
    const targets = cloneDeep(options.targets);
    const queryTargets: any[] = [];

    let i, y;

    let allQueries = _map(targets, (target) => {
      if (target.hide) {
        return '';
      }

      queryTargets.push(target);

      // backward compatibility
      scopedVars.interval = scopedVars.__interval;

      return new InfluxQueryModel(target, this.templateSrv, scopedVars).render(true);
    }).reduce((acc, current) => {
      if (current !== '') {
        acc += ';' + current;
      }
      return acc;
    });

    if (allQueries === '') {
      return of({ data: [] });
    }

    // add global adhoc filters to timeFilter
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    const adhocFiltersFromDashboard = options.targets.flatMap((target: InfluxQuery) => target.adhocFilters ?? []);
    if (adhocFilters?.length || adhocFiltersFromDashboard?.length) {
      const ahFilters = adhocFilters?.length ? adhocFilters : adhocFiltersFromDashboard;
      const tmpQuery = new InfluxQueryModel({ refId: 'A' }, this.templateSrv, scopedVars);
      timeFilter += ' AND ' + tmpQuery.renderAdhocFilters(ahFilters);
    }
    // replace grafana variables
    scopedVars.timeFilter = { value: timeFilter };

    // replace templated variables
    allQueries = this.templateSrv.replace(allQueries, scopedVars);

    return this._seriesQuery(allQueries, options).pipe(
      map((data: any) => {
        if (!data || !data.results) {
          return { data: [] };
        }

        const seriesList = [];
        for (i = 0; i < data.results.length; i++) {
          const result = data.results[i];
          if (!result || !result.series) {
            continue;
          }

          const target = queryTargets[i];
          let alias = target.alias;
          if (alias) {
            alias = this.templateSrv.replace(target.alias, options.scopedVars);
          }

          const meta: QueryResultMeta = {
            executedQueryString: data.executedQueryString,
          };

          const influxSeries = new InfluxSeries({
            refId: target.refId,
            series: data.results[i].series,
            alias: alias,
            meta,
          });

          switch (target.resultFormat) {
            case 'logs':
              meta.preferredVisualisationType = 'logs';
            case 'table': {
              seriesList.push(influxSeries.getTable());
              break;
            }
            default: {
              const timeSeries = influxSeries.getTimeSeries();
              for (y = 0; y < timeSeries.length; y++) {
                seriesList.push(timeSeriesToDataFrame(timeSeries[y]));
              }
              break;
            }
          }
        }

        return { data: seriesList };
      })
    );
  }

  async annotationEvents(options: DataQueryRequest, annotation: InfluxQuery): Promise<AnnotationEvent[]> {
    if (this.isFlux) {
      return Promise.reject({
        message: 'Flux requires the standard annotation query',
      });
    }

    // InfluxQL puts a query string on the annotation
    if (!annotation.query) {
      return Promise.reject({
        message: 'Query missing in annotation definition',
      });
    }

    if (config.featureToggles.influxdbBackendMigration && this.access === 'proxy') {
      // We want to send our query to the backend as a raw query
      const target: InfluxQuery = {
        refId: 'metricFindQuery',
        datasource: this.getRef(),
        query: this.templateSrv.replace(annotation.query, undefined, 'regex'),
        rawQuery: true,
      };

      return lastValueFrom(
        getBackendSrv()
          .fetch<BackendDataSourceResponse>({
            url: '/api/ds/query',
            method: 'POST',
            headers: this.getRequestHeaders(),
            data: {
              from: options.range.from.valueOf().toString(),
              to: options.range.to.valueOf().toString(),
              queries: [target],
            },
            requestId: annotation.name,
          })
          .pipe(
            map(
              async (res: FetchResponse<BackendDataSourceResponse>) =>
                await this.responseParser.transformAnnotationResponse(annotation, res, target)
            )
          )
      );
    }

    const timeFilter = this.getTimeFilter({ rangeRaw: options.range.raw, timezone: options.timezone });
    let query = annotation.query.replace('$timeFilter', timeFilter);
    query = this.templateSrv.replace(query, undefined, 'regex');

    return lastValueFrom(this._seriesQuery(query, options)).then((data: any) => {
      if (!data || !data.results || !data.results[0]) {
        throw { message: 'No results in response from InfluxDB' };
      }
      return new InfluxSeries({
        series: data.results[0].series,
        annotation: annotation,
      }).getAnnotations();
    });
  }

  targetContainsTemplate(target: any) {
    // for flux-mode we just take target.query,
    // for influxql-mode we use InfluxQueryModel to create the text-representation
    const queryText = this.isFlux ? target.query : buildRawQuery(target);

    return this.templateSrv.containsTemplate(queryText);
  }

  interpolateVariablesInQueries(queries: InfluxQuery[], scopedVars: ScopedVars): InfluxQuery[] {
    if (!queries || queries.length === 0) {
      return [];
    }

    return queries.map((query) => {
      if (this.isFlux) {
        return {
          ...query,
          datasource: this.getRef(),
          query: this.templateSrv.replace(query.query ?? '', scopedVars, 'regex'), // The raw query text
        };
      }

      return {
        ...query,
        datasource: this.getRef(),
        ...this.applyVariables(query, scopedVars, scopedVars),
      };
    });
  }

  applyVariables(query: InfluxQuery, scopedVars: ScopedVars, rest: ScopedVars) {
    const expandedQuery = { ...query };
    if (query.groupBy) {
      expandedQuery.groupBy = query.groupBy.map((groupBy) => {
        return {
          ...groupBy,
          params: groupBy.params?.map((param) => {
            return this.templateSrv.replace(param.toString(), undefined, 'regex');
          }),
        };
      });
    }

    if (query.select) {
      expandedQuery.select = query.select.map((selects) => {
        return selects.map((select: any) => {
          return {
            ...select,
            params: select.params?.map((param: any) => {
              return this.templateSrv.replace(param.toString(), undefined, 'regex');
            }),
          };
        });
      });
    }

    if (query.tags) {
      expandedQuery.tags = query.tags.map((tag) => {
        return {
          ...tag,
          value: this.templateSrv.replace(tag.value, scopedVars, 'regex'),
        };
      });
    }

    return {
      ...expandedQuery,
      adhocFilters: this.templateSrv.getAdhocFilters(this.name) ?? [],
      query: this.templateSrv.replace(query.query ?? '', rest, 'regex'), // The raw query text
      alias: this.templateSrv.replace(query.alias ?? '', scopedVars),
      limit: this.templateSrv.replace(query.limit?.toString() ?? '', scopedVars, 'regex'),
      measurement: this.templateSrv.replace(query.measurement ?? '', scopedVars, 'regex'),
      policy: this.templateSrv.replace(query.policy ?? '', scopedVars, 'regex'),
      slimit: this.templateSrv.replace(query.slimit?.toString() ?? '', scopedVars, 'regex'),
      tz: this.templateSrv.replace(query.tz ?? '', scopedVars),
    };
  }

  async metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
    if (this.isFlux || this.isMigrationToggleOnAndIsAccessProxy()) {
      const target: InfluxQuery = {
        refId: 'metricFindQuery',
        query,
        rawQuery: true,
      };
      return lastValueFrom(
        super.query({
          ...options, // includes 'range'
          targets: [target],
        } as DataQueryRequest)
      ).then((rsp) => {
        if (rsp.data?.length) {
          return frameToMetricFindValue(rsp.data[0]);
        }
        return [];
      });
    }

    const interpolated = new InfluxQueryModel(
      {
        refId: 'metricFindQuery',
        query,
        rawQuery: true,
      },
      this.templateSrv,
      options.scopedVars
    ).render(true);

    return lastValueFrom(this._seriesQuery(interpolated, options)).then((resp) => {
      return this.responseParser.parse(query, resp);
    });
  }

  _seriesQuery(query: string, options?: any) {
    if (!query) {
      return of({ results: [] });
    }

    if (options && options.range) {
      const timeFilter = this.getTimeFilter({ rangeRaw: options.range, timezone: options.timezone });
      query = query.replace('$timeFilter', timeFilter);
    }

    return this._influxRequest(this.httpMode, '/query', { q: query, epoch: 'ms' }, options);
  }

  serializeParams(params: any) {
    if (!params) {
      return '';
    }

    return reduce(
      params,
      (memo, value, key) => {
        if (value === null || value === undefined) {
          return memo;
        }
        memo.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        return memo;
      },
      [] as string[]
    ).join('&');
  }

  _influxRequest(method: string, url: string, data: any, options?: any) {
    const currentUrl = this.urls.shift()!;
    this.urls.push(currentUrl);

    const params: any = {};

    if (this.username) {
      params.u = this.username;
      params.p = this.password;
    }

    if (options && options.database) {
      params.db = options.database;
    } else if (this.database) {
      params.db = this.database;
    }

    if (options?.policy) {
      params.rp = options.policy;
    }

    const { q } = data;

    if (method === 'POST' && has(data, 'q')) {
      // verb is POST and 'q' param is defined
      extend(params, omit(data, ['q']));
      data = this.serializeParams(pick(data, ['q']));
    } else if (method === 'GET' || method === 'POST') {
      // verb is GET, or POST without 'q' param
      extend(params, data);
      data = null;
    }

    const req: any = {
      method: method,
      url: currentUrl + url,
      params: params,
      data: data,
      precision: 'ms',
      inspect: { type: 'influxdb' },
      paramSerializer: this.serializeParams,
    };

    req.headers = req.headers || {};
    if (this.basicAuth || this.withCredentials) {
      req.withCredentials = true;
    }
    if (this.basicAuth) {
      req.headers.Authorization = this.basicAuth;
    }

    if (method === 'POST') {
      req.headers['Content-type'] = 'application/x-www-form-urlencoded';
    }

    return getBackendSrv()
      .fetch(req)
      .pipe(
        map((result: any) => {
          const { data } = result;
          if (data) {
            data.executedQueryString = q;
            if (data.results) {
              const errors = result.data.results.filter((elem: any) => elem.error);

              if (errors.length > 0) {
                throw {
                  message: 'InfluxDB Error: ' + errors[0].error,
                  data,
                };
              }
            }
          }
          return data;
        }),
        catchError((err) => {
          if (err.cancelled) {
            return of(err);
          }

          return throwError(this.handleErrors(err));
        })
      );
  }

  handleErrors(err: any) {
    const error: DataQueryError = {
      message:
        (err && err.status) ||
        (err && err.message) ||
        'Unknown error during query transaction. Please check JS console logs.',
    };

    if ((Number.isInteger(err.status) && err.status !== 0) || err.status >= 300) {
      if (err.data && err.data.error) {
        error.message = 'InfluxDB Error: ' + err.data.error;
        error.data = err.data;
        // @ts-ignore
        error.config = err.config;
      } else {
        error.message = 'Network Error: ' + err.statusText + '(' + err.status + ')';
        error.data = err.data;
        // @ts-ignore
        error.config = err.config;
      }
    }

    return error;
  }

  getTimeFilter(options: any) {
    const from = this.getInfluxTime(options.rangeRaw.from, false, options.timezone);
    const until = this.getInfluxTime(options.rangeRaw.to, true, options.timezone);

    return 'time >= ' + from + ' and time <= ' + until;
  }

  getInfluxTime(date: any, roundUp: any, timezone: any) {
    if (isString(date)) {
      if (date === 'now') {
        return 'now()';
      }

      const parts = /^now-(\d+)([dhms])$/.exec(date);
      if (parts) {
        const amount = parseInt(parts[1], 10);
        const unit = parts[2];
        return 'now() - ' + amount + unit;
      }
      date = dateMath.parse(date, roundUp, timezone);
    }

    return date.valueOf() + 'ms';
  }

  isMigrationToggleOnAndIsAccessProxy() {
    return config.featureToggles.influxdbBackendMigration && this.access === 'proxy';
  }
}
