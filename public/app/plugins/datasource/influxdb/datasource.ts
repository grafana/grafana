import { cloneDeep, map as _map, reduce, get, has, extend, omit, pick, isString } from 'lodash';

import {
  dateMath,
  DataSourceInstanceSettings,
  ScopedVars,
  DataQueryRequest,
  DataQueryResponse,
  dateTime,
  LoadingState,
  QueryResultMeta,
  MetricFindValue,
  AnnotationQueryRequest,
  AnnotationEvent,
  DataQueryError,
  DataFrame,
  TimeSeries,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
  FieldType,
  ArrayVector,
} from '@grafana/data';
import { v4 as uuidv4 } from 'uuid';
import InfluxSeries from './influx_series';
import InfluxQueryModel from './influx_query_model';
import ResponseParser from './response_parser';
import { InfluxQueryBuilder } from './query_builder';
import { InfluxQuery, InfluxOptions, InfluxVersion } from './types';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getBackendSrv, DataSourceWithBackend, frameToMetricFindValue } from '@grafana/runtime';
import { Observable, throwError, of } from 'rxjs';
import { FluxQueryEditor } from './components/FluxQueryEditor';
import { catchError, map } from 'rxjs/operators';
import { buildRawQuery } from './queryUtils';

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
  interval: any;
  responseParser: any;
  httpMode: string;
  isFlux: boolean;

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
    this.database = instanceSettings.database;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    const settingsData = instanceSettings.jsonData || ({} as InfluxOptions);
    this.interval = settingsData.timeInterval;
    this.httpMode = settingsData.httpMode || 'GET';
    this.responseParser = new ResponseParser();
    this.isFlux = settingsData.version === InfluxVersion.Flux;

    if (this.isFlux) {
      // When flux, use an annotation processor rather than the `annotationQuery` lifecycle
      this.annotations = {
        QueryEditor: FluxQueryEditor,
      };
    }
  }

  query(request: DataQueryRequest<InfluxQuery>): Observable<DataQueryResponse> {
    if (this.isFlux) {
      // for not-flux queries we call `this.classicQuery`, and that
      // handles the is-hidden situation.
      // for the flux-case, we do the filtering here
      const filteredRequest = {
        ...request,
        targets: request.targets.filter((t) => t.hide !== true),
      };
      return super.query(filteredRequest);
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
    // this only works in flux-mode, it should not be called in non-flux-mode
    if (!this.isFlux) {
      throw new Error('applyTemplateVariables called in influxql-mode. this should never happen');
    }

    return {
      ...query,
      query: this.templateSrv.replace(query.query ?? '', scopedVars), // The raw query text
    };
  }

  /**
   * The unchanged pre 7.1 query implementation
   */
  classicQuery(options: any): Observable<DataQueryResponse> {
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
    if (adhocFilters.length > 0) {
      const tmpQuery = new InfluxQueryModel({ refId: 'A' }, this.templateSrv, scopedVars);
      timeFilter += ' AND ' + tmpQuery.renderAdhocFilters(adhocFilters);
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

  async annotationQuery(options: AnnotationQueryRequest<any>): Promise<AnnotationEvent[]> {
    if (this.isFlux) {
      return Promise.reject({
        message: 'Flux requires the standard annotation query',
      });
    }

    // InfluxQL puts a query string on the annotation
    if (!options.annotation.query) {
      return Promise.reject({
        message: 'Query missing in annotation definition',
      });
    }

    const timeFilter = this.getTimeFilter({ rangeRaw: options.rangeRaw, timezone: options.dashboard.timezone });
    let query = options.annotation.query.replace('$timeFilter', timeFilter);
    query = this.templateSrv.replace(query, undefined, 'regex');

    return this._seriesQuery(query, options)
      .toPromise()
      .then((data: any) => {
        if (!data || !data.results || !data.results[0]) {
          throw { message: 'No results in response from InfluxDB' };
        }
        return new InfluxSeries({
          series: data.results[0].series,
          annotation: options.annotation,
        }).getAnnotations();
      });
  }

  targetContainsTemplate(target: any) {
    // for flux-mode we just take target.query,
    // for influxql-mode we use InfluxQueryModel to create the text-representation
    const queryText = this.isFlux ? target.query : buildRawQuery(target);

    return this.templateSrv.variableExists(queryText);
  }

  interpolateVariablesInQueries(queries: InfluxQuery[], scopedVars: ScopedVars): InfluxQuery[] {
    if (!queries || queries.length === 0) {
      return [];
    }

    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map((query) => {
        const expandedQuery = {
          ...query,
          datasource: this.name,
          measurement: this.templateSrv.replace(query.measurement ?? '', scopedVars, 'regex'),
          policy: this.templateSrv.replace(query.policy ?? '', scopedVars, 'regex'),
        };

        if (query.rawQuery || this.isFlux) {
          expandedQuery.query = this.templateSrv.replace(query.query ?? '', scopedVars, 'regex');
        }

        if (query.tags) {
          expandedQuery.tags = query.tags.map((tag) => {
            return {
              ...tag,
              value: this.templateSrv.replace(tag.value, undefined, 'regex'),
            };
          });
        }
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  async metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
    if (this.isFlux) {
      const target: InfluxQuery = {
        refId: 'metricFindQuery',
        query,
      };
      return super
        .query({
          ...options, // includes 'range'
          targets: [target],
        } as DataQueryRequest)
        .toPromise()
        .then((rsp) => {
          if (rsp.data?.length) {
            return frameToMetricFindValue(rsp.data[0]);
          }
          return [];
        });
    }

    const interpolated = this.templateSrv.replace(query, undefined, 'regex');

    return this._seriesQuery(interpolated, options)
      .toPromise()
      .then((resp) => {
        return this.responseParser.parse(query, resp);
      });
  }

  getTagKeys(options: any = {}) {
    const queryBuilder = new InfluxQueryBuilder({ measurement: options.measurement || '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('TAG_KEYS');
    return this.metricFindQuery(query, options);
  }

  getTagValues(options: any = {}) {
    const queryBuilder = new InfluxQueryBuilder({ measurement: options.measurement || '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('TAG_VALUES', options.key);
    return this.metricFindQuery(query, options);
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

  testDatasource() {
    if (this.isFlux) {
      // TODO: eventually use the real /health endpoint
      const request: DataQueryRequest<InfluxQuery> = {
        targets: [{ refId: 'test', query: 'buckets()' }],
        requestId: `${this.id}-health-${uuidv4()}`,
        dashboardId: 0,
        panelId: 0,
        interval: '1m',
        intervalMs: 60000,
        maxDataPoints: 423,
        range: {
          from: dateTime(1000),
          to: dateTime(2000),
        },
      } as DataQueryRequest<InfluxQuery>;

      return super
        .query(request)
        .toPromise()
        .then((res: DataQueryResponse) => {
          if (!res || !res.data || res.state !== LoadingState.Done) {
            console.error('InfluxDB Error', res);
            return { status: 'error', message: 'Error reading InfluxDB' };
          }
          const first = res.data[0];
          if (first && first.length) {
            return { status: 'success', message: `${first.length} buckets found` };
          }
          console.error('InfluxDB Error', res);
          return { status: 'error', message: 'Error reading buckets' };
        })
        .catch((err: any) => {
          console.error('InfluxDB Error', err);
          return { status: 'error', message: err.message };
        });
    }

    const queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('RETENTION POLICIES');

    return this._seriesQuery(query)
      .toPromise()
      .then((res: any) => {
        const error = get(res, 'results[0].error');
        if (error) {
          return { status: 'error', message: error };
        }
        return { status: 'success', message: 'Data source is working' };
      })
      .catch((err: any) => {
        return { status: 'error', message: err.message };
      });
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
}
