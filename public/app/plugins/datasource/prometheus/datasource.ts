import _ from 'lodash';

import $ from 'jquery';
import kbn from 'app/core/utils/kbn';
import * as dateMath from 'app/core/utils/datemath';
import PrometheusMetricFindQuery from './metric_find_query';
import { ResultTransformer } from './result_transformer';
import { BackendSrv } from 'app/core/services/backend_srv';

export function alignRange(start, end, step) {
  const alignedEnd = Math.ceil(end / step) * step;
  const alignedStart = Math.floor(start / step) * step;
  return {
    end: alignedEnd,
    start: alignedStart,
  };
}

export function prometheusRegularEscape(value) {
  if (typeof value === 'string') {
    return value.replace(/'/g, "\\\\'");
  }
  return value;
}

export function prometheusSpecialRegexEscape(value) {
  if (typeof value === 'string') {
    return prometheusRegularEscape(value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]+?.()]/g, '\\\\$&'));
  }
  return value;
}

export class PrometheusDatasource {
  type: string;
  editorSrc: string;
  name: string;
  supportsExplore: boolean;
  supportMetrics: boolean;
  url: string;
  directUrl: string;
  basicAuth: any;
  withCredentials: any;
  metricsNameCache: any;
  interval: string;
  queryTimeout: string;
  httpMethod: string;
  resultTransformer: ResultTransformer;

  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv: BackendSrv, private templateSrv, private timeSrv) {
    this.type = 'prometheus';
    this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
    this.name = instanceSettings.name;
    this.supportsExplore = true;
    this.supportMetrics = true;
    this.url = instanceSettings.url;
    this.directUrl = instanceSettings.directUrl;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.interval = instanceSettings.jsonData.timeInterval || '15s';
    this.queryTimeout = instanceSettings.jsonData.queryTimeout;
    this.httpMethod = instanceSettings.jsonData.httpMethod || 'GET';
    this.resultTransformer = new ResultTransformer(templateSrv);
  }

  _request(url, data?, options?: any) {
    var options: any = {
      url: this.url + url,
      method: this.httpMethod,
      ...options,
    };
    if (options.method === 'GET') {
      if (!_.isEmpty(data)) {
        options.url =
          options.url +
          '?' +
          _.map(data, (v, k) => {
            return encodeURIComponent(k) + '=' + encodeURIComponent(v);
          }).join('&');
      }
    } else {
      options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      options.transformRequest = data => {
        return $.param(data);
      };
      options.data = data;
    }

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }

    if (this.basicAuth) {
      options.headers = {
        Authorization: this.basicAuth,
      };
    }

    return this.backendSrv.datasourceRequest(options);
  }

  // Use this for tab completion features, wont publish response to other components
  metadataRequest(url) {
    return this._request(url, null, { method: 'GET', silent: true });
  }

  interpolateQueryExpr(value, variable, defaultFormatFn) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return prometheusRegularEscape(value);
    }

    if (typeof value === 'string') {
      return prometheusSpecialRegexEscape(value);
    }

    var escapedValues = _.map(value, prometheusSpecialRegexEscape);
    return escapedValues.join('|');
  }

  targetContainsTemplate(target) {
    return this.templateSrv.variableExists(target.expr);
  }

  query(options) {
    var start = this.getPrometheusTime(options.range.from, false);
    var end = this.getPrometheusTime(options.range.to, true);

    var queries = [];
    var activeTargets = [];

    options = _.clone(options);

    for (let target of options.targets) {
      if (!target.expr || target.hide) {
        continue;
      }

      activeTargets.push(target);
      queries.push(this.createQuery(target, options, start, end));
    }

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      return this.$q.when({ data: [] });
    }

    var allQueryPromise = _.map(queries, query => {
      if (!query.instant) {
        return this.performTimeSeriesQuery(query, query.start, query.end);
      } else {
        return this.performInstantQuery(query, end);
      }
    });

    return this.$q.all(allQueryPromise).then(responseList => {
      let result = [];

      _.each(responseList, (response, index) => {
        if (response.status === 'error') {
          throw response.error;
        }

        // Keeping original start/end for transformers
        const transformerOptions = {
          format: activeTargets[index].format,
          step: queries[index].step,
          legendFormat: activeTargets[index].legendFormat,
          start: queries[index].start,
          end: queries[index].end,
          query: queries[index].expr,
          responseListLength: responseList.length,
          responseIndex: index,
          refId: activeTargets[index].refId,
        };

        this.resultTransformer.transform(result, response, transformerOptions);
      });

      return { data: result };
    });
  }

  createQuery(target, options, start, end) {
    var query: any = {};
    query.instant = target.instant;
    var range = Math.ceil(end - start);

    var interval = kbn.interval_to_seconds(options.interval);
    // Minimum interval ("Min step"), if specified for the query. or same as interval otherwise
    var minInterval = kbn.interval_to_seconds(
      this.templateSrv.replace(target.interval, options.scopedVars) || options.interval
    );
    var intervalFactor = target.intervalFactor || 1;
    // Adjust the interval to take into account any specified minimum and interval factor plus Prometheus limits
    var adjustedInterval = this.adjustInterval(interval, minInterval, range, intervalFactor);
    var scopedVars = { ...options.scopedVars, ...this.getRangeScopedVars() };
    // If the interval was adjusted, make a shallow copy of scopedVars with updated interval vars
    if (interval !== adjustedInterval) {
      interval = adjustedInterval;
      scopedVars = Object.assign({}, options.scopedVars, {
        __interval: { text: interval + 's', value: interval + 's' },
        __interval_ms: { text: interval * 1000, value: interval * 1000 },
        ...this.getRangeScopedVars(),
      });
    }
    query.step = interval;

    // Only replace vars in expression after having (possibly) updated interval vars
    query.expr = this.templateSrv.replace(target.expr, scopedVars, this.interpolateQueryExpr);
    query.requestId = options.panelId + target.refId;

    // Align query interval with step
    const adjusted = alignRange(start, end, query.step);
    query.start = adjusted.start;
    query.end = adjusted.end;

    return query;
  }

  adjustInterval(interval, minInterval, range, intervalFactor) {
    // Prometheus will drop queries that might return more than 11000 data points.
    // Calibrate interval if it is too small.
    if (interval !== 0 && range / intervalFactor / interval > 11000) {
      interval = Math.ceil(range / intervalFactor / 11000);
    }
    return Math.max(interval * intervalFactor, minInterval, 1);
  }

  performTimeSeriesQuery(query, start, end) {
    if (start > end) {
      throw { message: 'Invalid time range' };
    }

    var url = '/api/v1/query_range';
    var data = {
      query: query.expr,
      start: start,
      end: end,
      step: query.step,
    };
    if (this.queryTimeout) {
      data['timeout'] = this.queryTimeout;
    }
    return this._request(url, data, { requestId: query.requestId });
  }

  performInstantQuery(query, time) {
    var url = '/api/v1/query';
    var data = {
      query: query.expr,
      time: time,
    };
    if (this.queryTimeout) {
      data['timeout'] = this.queryTimeout;
    }
    return this._request(url, data, { requestId: query.requestId });
  }

  performSuggestQuery(query, cache = false) {
    var url = '/api/v1/label/__name__/values';

    if (cache && this.metricsNameCache && this.metricsNameCache.expire > Date.now()) {
      return this.$q.when(
        _.filter(this.metricsNameCache.data, metricName => {
          return metricName.indexOf(query) !== 1;
        })
      );
    }

    return this.metadataRequest(url).then(result => {
      this.metricsNameCache = {
        data: result.data.data,
        expire: Date.now() + 60 * 1000,
      };
      return _.filter(result.data.data, metricName => {
        return metricName.indexOf(query) !== 1;
      });
    });
  }

  metricFindQuery(query) {
    if (!query) {
      return this.$q.when([]);
    }

    let scopedVars = {
      __interval: { text: this.interval, value: this.interval },
      __interval_ms: { text: kbn.interval_to_ms(this.interval), value: kbn.interval_to_ms(this.interval) },
      ...this.getRangeScopedVars(),
    };
    let interpolated = this.templateSrv.replace(query, scopedVars, this.interpolateQueryExpr);
    var metricFindQuery = new PrometheusMetricFindQuery(this, interpolated, this.timeSrv);
    return metricFindQuery.process();
  }

  getRangeScopedVars() {
    let range = this.timeSrv.timeRange();
    let msRange = range.to.diff(range.from);
    let regularRange = kbn.secondsToHms(msRange / 1000);
    return {
      __range_ms: { text: msRange, value: msRange },
      __range: { text: regularRange, value: regularRange },
    };
  }

  annotationQuery(options) {
    var annotation = options.annotation;
    var expr = annotation.expr || '';
    var tagKeys = annotation.tagKeys || '';
    var titleFormat = annotation.titleFormat || '';
    var textFormat = annotation.textFormat || '';

    if (!expr) {
      return this.$q.when([]);
    }

    var step = annotation.step || '60s';
    var start = this.getPrometheusTime(options.range.from, false);
    var end = this.getPrometheusTime(options.range.to, true);
    // Unsetting min interval
    const queryOptions = {
      ...options,
      interval: '0s',
    };
    const query = this.createQuery({ expr, interval: step }, queryOptions, start, end);

    var self = this;
    return this.performTimeSeriesQuery(query, query.start, query.end).then(function(results) {
      var eventList = [];
      tagKeys = tagKeys.split(',');

      _.each(results.data.data.result, function(series) {
        var tags = _.chain(series.metric)
          .filter(function(v, k) {
            return _.includes(tagKeys, k);
          })
          .value();

        for (let value of series.values) {
          if (value[1] === '1') {
            var event = {
              annotation: annotation,
              time: Math.floor(parseFloat(value[0])) * 1000,
              title: self.resultTransformer.renderTemplate(titleFormat, series.metric),
              tags: tags,
              text: self.resultTransformer.renderTemplate(textFormat, series.metric),
            };

            eventList.push(event);
          }
        }
      });

      return eventList;
    });
  }

  testDatasource() {
    let now = new Date().getTime();
    return this.performInstantQuery({ expr: '1+1' }, now / 1000).then(response => {
      if (response.data.status === 'success') {
        return { status: 'success', message: 'Data source is working' };
      } else {
        return { status: 'error', message: response.error };
      }
    });
  }

  getExploreState(panel) {
    let state = {};
    if (panel.targets) {
      const queries = panel.targets.map(t => ({
        query: this.templateSrv.replace(t.expr, {}, this.interpolateQueryExpr),
        format: t.format,
      }));
      state = {
        ...state,
        queries,
        datasource: this.name,
      };
    }
    return state;
  }

  getPrometheusTime(date, roundUp) {
    if (_.isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.ceil(date.valueOf() / 1000);
  }

  getOriginalMetricName(labelData) {
    return this.resultTransformer.getOriginalMetricName(labelData);
  }
}
