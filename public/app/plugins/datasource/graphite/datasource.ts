import _ from 'lodash';
import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  dateMath,
  QueryResultMetaStat,
  ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { isVersionGtOrEq, SemVersion } from 'app/core/utils/version';
import gfunc from './gfunc';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
// Types
import { GraphiteOptions, GraphiteQuery, GraphiteType, MetricTankRequestMeta } from './types';
import { getRollupNotice, getRuntimeConsolidationNotice } from 'app/plugins/datasource/graphite/meta';
import { getSearchFilterScopedVar } from '../../../features/templating/utils';

export class GraphiteDatasource extends DataSourceApi<GraphiteQuery, GraphiteOptions> {
  basicAuth: string;
  url: string;
  name: string;
  graphiteVersion: any;
  supportsTags: boolean;
  isMetricTank: boolean;
  rollupIndicatorEnabled: boolean;
  cacheTimeout: any;
  withCredentials: boolean;
  funcDefs: any = null;
  funcDefsPromise: Promise<any> = null;
  _seriesRefLetters: string;

  /** @ngInject */
  constructor(instanceSettings: any, private templateSrv: TemplateSrv) {
    super(instanceSettings);
    this.basicAuth = instanceSettings.basicAuth;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.graphiteVersion = instanceSettings.jsonData.graphiteVersion || '0.9';
    this.isMetricTank = instanceSettings.jsonData.graphiteType === GraphiteType.Metrictank;
    this.supportsTags = supportsTags(this.graphiteVersion);
    this.cacheTimeout = instanceSettings.cacheTimeout;
    this.rollupIndicatorEnabled = instanceSettings.jsonData.rollupIndicatorEnabled;
    this.withCredentials = instanceSettings.withCredentials;
    this.funcDefs = null;
    this.funcDefsPromise = null;
    this._seriesRefLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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

  async query(options: DataQueryRequest<GraphiteQuery>): Promise<DataQueryResponse> {
    const graphOptions = {
      from: this.translateTime(options.rangeRaw.from, false, options.timezone),
      until: this.translateTime(options.rangeRaw.to, true, options.timezone),
      targets: options.targets,
      format: (options as any).format,
      cacheTimeout: options.cacheTimeout || this.cacheTimeout,
      maxDataPoints: options.maxDataPoints,
    };

    const params = this.buildGraphiteParams(graphOptions, options.scopedVars);
    if (params.length === 0) {
      return Promise.resolve({ data: [] });
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

    return this.doGraphiteRequest(httpOptions).then(this.convertResponseToDataFrames);
  }

  addTracingHeaders(httpOptions: { headers: any }, options: { dashboardId: any; panelId: any }) {
    const proxyMode = !this.url.match(/^http/);
    if (proxyMode) {
      httpOptions.headers['X-Dashboard-Id'] = options.dashboardId;
      httpOptions.headers['X-Panel-Id'] = options.panelId;
    }
  }

  convertResponseToDataFrames = (result: any): DataQueryResponse => {
    const data: DataFrame[] = [];
    if (!result || !result.data) {
      return { data };
    }

    // Series are either at the root or under a node called 'series'
    const series = result.data.series || result.data;

    if (!_.isArray(series)) {
      throw { message: 'Missing series in result', data: result };
    }

    for (let i = 0; i < series.length; i++) {
      const s = series[i];

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

      stats.push({ title: key, value: meta.stats[key], unit });
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
      expandedQueries = queries.map(query => {
        const expandedQuery = {
          ...query,
          datasource: this.name,
          target: this.templateSrv.replace(query.target, scopedVars),
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  annotationQuery(options: any) {
    // Graphite metric as annotation
    if (options.annotation.target) {
      const target = this.templateSrv.replace(options.annotation.target, {}, 'glob');
      const graphiteQuery = ({
        rangeRaw: options.rangeRaw,
        targets: [{ target: target }],
        format: 'json',
        maxDataPoints: 100,
      } as unknown) as DataQueryRequest<GraphiteQuery>;

      return this.query(graphiteQuery).then(result => {
        const list = [];

        for (let i = 0; i < result.data.length; i++) {
          const target = result.data[i];

          for (let y = 0; y < target.length; y++) {
            const time = target.fields[1].values.get(y);
            const value = target.fields[0].values.get(y);

            if (!value) {
              continue;
            }

            list.push({
              annotation: options.annotation,
              time,
              title: target.name,
            });
          }
        }

        return list;
      });
    } else {
      // Graphite event as annotation
      const tags = this.templateSrv.replace(options.annotation.tags);
      return this.events({ range: options.rangeRaw, tags: tags }).then((results: any) => {
        const list = [];
        for (let i = 0; i < results.data.length; i++) {
          const e = results.data[i];

          let tags = e.tags;
          if (_.isString(e.tags)) {
            tags = this.parseTags(e.tags);
          }

          list.push({
            annotation: options.annotation,
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

  events(options: { range: any; tags: any; timezone?: any }) {
    try {
      let tags = '';
      if (options.tags) {
        tags = '&tags=' + options.tags;
      }
      return this.doGraphiteRequest({
        method: 'GET',
        url:
          '/events/get_data?from=' +
          this.translateTime(options.range.from, false, options.timezone) +
          '&until=' +
          this.translateTime(options.range.to, true, options.timezone) +
          tags,
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  targetContainsTemplate(target: GraphiteQuery) {
    return this.templateSrv.variableExists(target.target);
  }

  translateTime(date: any, roundUp: any, timezone: any) {
    if (_.isString(date)) {
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

  metricFindQuery(query: string, optionalOptions?: any) {
    const options: any = optionalOptions || {};
    let interpolatedQuery = this.templateSrv.replace(
      query,
      getSearchFilterScopedVar({ query, wildcardChar: '', options: optionalOptions })
    );

    // special handling for tag_values(<tag>[,<expression>]*), this is used for template variables
    let matches = interpolatedQuery.match(/^tag_values\(([^,]+)((, *[^,]+)*)\)$/);
    if (matches) {
      const expressions = [];
      const exprRegex = /, *([^,]+)/g;
      let match = exprRegex.exec(matches[2]);
      while (match !== null) {
        expressions.push(match[1]);
        match = exprRegex.exec(matches[2]);
      }
      options.limit = 10000;
      return this.getTagValuesAutoComplete(expressions, matches[1], undefined, options);
    }

    // special handling for tags(<expression>[,<expression>]*), this is used for template variables
    matches = interpolatedQuery.match(/^tags\(([^,]*)((, *[^,]+)*)\)$/);
    if (matches) {
      const expressions = [];
      if (matches[1]) {
        expressions.push(matches[1]);
        const exprRegex = /, *([^,]+)/g;
        let match = exprRegex.exec(matches[2]);
        while (match !== null) {
          expressions.push(match[1]);
          match = exprRegex.exec(matches[2]);
        }
      }
      options.limit = 10000;
      return this.getTagsAutoComplete(expressions, undefined, options);
    }

    interpolatedQuery = this.templateSrv.replace(
      query,
      getSearchFilterScopedVar({ query, wildcardChar: '*', options: optionalOptions })
    );

    const httpOptions: any = {
      method: 'POST',
      url: '/metrics/find',
      params: {},
      data: `query=${interpolatedQuery}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // for cancellations
      requestId: options.requestId,
    };

    if (options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
      httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
    }

    return this.doGraphiteRequest(httpOptions).then((results: any) => {
      return _.map(results.data, metric => {
        return {
          text: metric.text,
          expandable: metric.expandable ? true : false,
        };
      });
    });
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

    return this.doGraphiteRequest(httpOptions).then((results: any) => {
      return _.map(results.data, tag => {
        return {
          text: tag.tag,
          id: tag.id,
        };
      });
    });
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

    return this.doGraphiteRequest(httpOptions).then((results: any) => {
      if (results.data && results.data.values) {
        return _.map(results.data.values, value => {
          return {
            text: value.value,
            id: value.id,
          };
        });
      } else {
        return [];
      }
    });
  }

  getTagsAutoComplete(expressions: any[], tagPrefix: any, optionalOptions: any) {
    const options = optionalOptions || {};

    const httpOptions: any = {
      method: 'GET',
      url: '/tags/autoComplete/tags',
      params: {
        expr: _.map(expressions, expression => this.templateSrv.replace((expression || '').trim())),
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

    return this.doGraphiteRequest(httpOptions).then((results: any) => {
      if (results.data) {
        return _.map(results.data, tag => {
          return { text: tag };
        });
      } else {
        return [];
      }
    });
  }

  getTagValuesAutoComplete(expressions: any[], tag: any, valuePrefix: any, optionalOptions: any) {
    const options = optionalOptions || {};

    const httpOptions: any = {
      method: 'GET',
      url: '/tags/autoComplete/values',
      params: {
        expr: _.map(expressions, expression => this.templateSrv.replace((expression || '').trim())),
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

    return this.doGraphiteRequest(httpOptions).then((results: any) => {
      if (results.data) {
        return _.map(results.data, value => {
          return { text: value };
        });
      } else {
        return [];
      }
    });
  }

  getVersion(optionalOptions: any) {
    const options = optionalOptions || {};

    const httpOptions = {
      method: 'GET',
      url: '/version',
      requestId: options.requestId,
    };

    return this.doGraphiteRequest(httpOptions)
      .then((results: any) => {
        if (results.data) {
          const semver = new SemVersion(results.data);
          return semver.isValid() ? results.data : '';
        }
        return '';
      })
      .catch(() => {
        return '';
      });
  }

  createFuncInstance(funcDef: any, options?: any) {
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
    };

    this.funcDefsPromise = this.doGraphiteRequest(httpOptions)
      .then((results: any) => {
        if (results.status !== 200 || typeof results.data !== 'object') {
          this.funcDefs = gfunc.getFuncDefs(this.graphiteVersion);
        } else {
          this.funcDefs = gfunc.parseFuncDefs(results.data);
        }
        return this.funcDefs;
      })
      .catch((err: any) => {
        console.log('Fetching graphite functions error', err);
        this.funcDefs = gfunc.getFuncDefs(this.graphiteVersion);
        return this.funcDefs;
      });

    return this.funcDefsPromise;
  }

  testDatasource() {
    const query = ({
      panelId: 3,
      rangeRaw: { from: 'now-1h', to: 'now' },
      targets: [{ target: 'constantLine(100)' }],
      maxDataPoints: 300,
    } as unknown) as DataQueryRequest<GraphiteQuery>;
    return this.query(query).then(() => {
      return { status: 'success', message: 'Data source is working' };
    });
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

    return getBackendSrv().datasourceRequest(options);
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

    _.each(options, (value, key) => {
      if (_.indexOf(graphiteOptions, key) === -1) {
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
