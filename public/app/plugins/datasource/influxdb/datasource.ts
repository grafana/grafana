import { extend, groupBy, has, isString, omit, pick, reduce } from 'lodash';
import { lastValueFrom, merge, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  AnnotationEvent,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateMath,
  MetricFindValue,
  ScopedVars,
  toDataFrame,
} from '@grafana/data';
import {
  BackendDataSourceResponse,
  DataSourceWithBackend,
  FetchResponse,
  frameToMetricFindValue,
  getBackendSrv,
} from '@grafana/runtime';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { AnnotationEditor } from './components/AnnotationEditor';
import { FluxQueryEditor } from './components/FluxQueryEditor';
import { BROWSER_MODE_DISABLED_MESSAGE } from './constants';
import InfluxQueryModel from './influx_query_model';
import { prepareAnnotation } from './migrations';
import { buildRawQuery } from './queryUtils';
import { InfluxQueryBuilder } from './query_builder';
import ResponseParser from './response_parser';
import { InfluxOptions, InfluxQuery, InfluxVersion } from './types';

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
  responseParser: any;
  httpMode: string;
  isFlux: boolean;
  isProxyAccess: boolean;

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

  query(request: DataQueryRequest<InfluxQuery>): Observable<DataQueryResponse> {
    if (!this.isProxyAccess) {
      const error = new Error(BROWSER_MODE_DISABLED_MESSAGE);
      return throwError(() => error);
    }
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

    if (filteredRequest.targets.some((target: InfluxQuery) => target.fromAnnotations)) {
      const streams: Array<Observable<DataQueryResponse>> = [];

      for (const target of filteredRequest.targets) {
        if (target.query) {
          streams.push(
            new Observable((subscriber) => {
              this.annotationEvents(filteredRequest, target)
                .then((events) => subscriber.next({ data: [toDataFrame(events)] }))
                .catch((ex) => subscriber.error(new Error(ex)))
                .finally(() => subscriber.complete());
            })
          );
        }
      }

      return merge(...streams);
    }

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

    query = this.applyVariables(query, scopedVars, rest);

    return query;
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
    if (this.isFlux) {
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

    const interpolated = this.templateSrv.replace(query, undefined, 'regex');

    return lastValueFrom(this._seriesQuery(interpolated, options)).then((resp) => {
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
