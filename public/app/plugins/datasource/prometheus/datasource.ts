import _ from 'lodash';

import $ from 'jquery';
import kbn from 'app/core/utils/kbn';
import * as dateMath from 'app/core/utils/datemath';
import PrometheusMetricFindQuery from './metric_find_query';
import TableModel from 'app/core/table_model';

function prometheusSpecialRegexEscape(value) {
  return value.replace(/[\\^$*+?.()|[\]{}]/g, '\\\\$&');
}

export class PrometheusDatasource {
  type: string;
  editorSrc: string;
  name: string;
  supportMetrics: boolean;
  url: string;
  directUrl: string;
  basicAuth: any;
  withCredentials: any;
  metricsNameCache: any;
  interval: string;
  httpMethod: string;

  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv, private timeSrv) {
    this.type = 'prometheus';
    this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
    this.name = instanceSettings.name;
    this.supportMetrics = true;
    this.url = instanceSettings.url;
    this.directUrl = instanceSettings.directUrl;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.interval = instanceSettings.jsonData.timeInterval || '15s';
    this.httpMethod = instanceSettings.jsonData.httpMethod;
  }

  _request(method, url, data?, requestId?) {
    var options: any = {
      url: this.url + url,
      method: method,
      requestId: requestId,
    };
    if (method === 'GET') {
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

  interpolateQueryExpr(value, variable, defaultFormatFn) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return value;
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
    var self = this;
    var start = this.getPrometheusTime(options.range.from, false);
    var end = this.getPrometheusTime(options.range.to, true);
    var range = Math.ceil(end - start);

    var queries = [];
    var activeTargets = [];

    options = _.clone(options);

    for (let target of options.targets) {
      if (!target.expr || target.hide) {
        continue;
      }

      activeTargets.push(target);
      queries.push(this.createQuery(target, options, range));
    }

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      return this.$q.when({ data: [] });
    }

    var allQueryPromise = _.map(queries, query => {
      if (!query.instant) {
        return this.performTimeSeriesQuery(query, start, end);
      } else {
        return this.performInstantQuery(query, end);
      }
    });

    return this.$q.all(allQueryPromise).then(responseList => {
      var result = [];

      _.each(responseList, (response, index) => {
        if (response.status === 'error') {
          throw response.error;
        }

        if (activeTargets[index].format === 'table') {
          result.push(self.transformMetricDataToTable(response.data.data.result, responseList.length, index));
        } else {
          for (let metricData of response.data.data.result) {
            if (response.data.data.resultType === 'matrix') {
              result.push(self.transformMetricData(metricData, activeTargets[index], start, end, queries[index].step));
            } else if (response.data.data.resultType === 'vector') {
              result.push(self.transformInstantMetricData(metricData, activeTargets[index]));
            }
          }
        }
      });

      return { data: result };
    });
  }

  createQuery(target, options, range) {
    var query: any = {};
    query.instant = target.instant;

    var interval = kbn.interval_to_seconds(options.interval);
    // Minimum interval ("Min step"), if specified for the query. or same as interval otherwise
    var minInterval = kbn.interval_to_seconds(
      this.templateSrv.replace(target.interval, options.scopedVars) || options.interval
    );
    var intervalFactor = target.intervalFactor || 1;
    // Adjust the interval to take into account any specified minimum and interval factor plus Prometheus limits
    var adjustedInterval = this.adjustInterval(interval, minInterval, range, intervalFactor);
    var scopedVars = options.scopedVars;
    // If the interval was adjusted, make a shallow copy of scopedVars with updated interval vars
    if (interval !== adjustedInterval) {
      interval = adjustedInterval;
      scopedVars = Object.assign({}, options.scopedVars, {
        __interval: { text: interval + 's', value: interval + 's' },
        __interval_ms: { text: interval * 1000, value: interval * 1000 },
      });
    }
    query.step = interval;

    // Only replace vars in expression after having (possibly) updated interval vars
    query.expr = this.templateSrv.replace(target.expr, scopedVars, this.interpolateQueryExpr);
    query.requestId = options.panelId + target.refId;
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
    return this._request(this.httpMethod, url, data, query.requestId);
  }

  performInstantQuery(query, time) {
    var url = '/api/v1/query';
    var data = {
      query: query.expr,
      time: time,
    };
    return this._request(this.httpMethod, url, data, query.requestId);
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

    return this._request('GET', url).then(result => {
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

    let interpolated = this.templateSrv.replace(query, {}, this.interpolateQueryExpr);
    var metricFindQuery = new PrometheusMetricFindQuery(this, interpolated, this.timeSrv);
    return metricFindQuery.process();
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

    var interpolated = this.templateSrv.replace(expr, {}, this.interpolateQueryExpr);

    var step = '60s';
    if (annotation.step) {
      step = this.templateSrv.replace(annotation.step);
    }

    var start = this.getPrometheusTime(options.range.from, false);
    var end = this.getPrometheusTime(options.range.to, true);
    var query = {
      expr: interpolated,
      step: this.adjustInterval(kbn.interval_to_seconds(step), 0, Math.ceil(end - start), 1) + 's',
    };

    var self = this;
    return this.performTimeSeriesQuery(query, start, end).then(function(results) {
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
              title: self.renderTemplate(titleFormat, series.metric),
              tags: tags,
              text: self.renderTemplate(textFormat, series.metric),
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

  transformMetricData(md, options, start, end, step) {
    var dps = [],
      metricLabel = null;

    metricLabel = this.createMetricLabel(md.metric, options);

    var stepMs = step * 1000;
    var baseTimestamp = start * 1000;
    for (let value of md.values) {
      var dp_value = parseFloat(value[1]);
      if (_.isNaN(dp_value)) {
        dp_value = null;
      }

      var timestamp = parseFloat(value[0]) * 1000;
      for (let t = baseTimestamp; t < timestamp; t += stepMs) {
        dps.push([null, t]);
      }
      baseTimestamp = timestamp + stepMs;
      dps.push([dp_value, timestamp]);
    }

    var endTimestamp = end * 1000;
    for (let t = baseTimestamp; t <= endTimestamp; t += stepMs) {
      dps.push([null, t]);
    }

    return { target: metricLabel, datapoints: dps };
  }

  transformMetricDataToTable(md, resultCount: number, resultIndex: number) {
    var table = new TableModel();
    var i, j;
    var metricLabels = {};

    if (md.length === 0) {
      return table;
    }

    // Collect all labels across all metrics
    _.each(md, function(series) {
      for (var label in series.metric) {
        if (!metricLabels.hasOwnProperty(label)) {
          metricLabels[label] = 1;
        }
      }
    });

    // Sort metric labels, create columns for them and record their index
    var sortedLabels = _.keys(metricLabels).sort();
    table.columns.push({ text: 'Time', type: 'time' });
    _.each(sortedLabels, function(label, labelIndex) {
      metricLabels[label] = labelIndex + 1;
      table.columns.push({ text: label });
    });
    let valueText = resultCount > 1 ? `Value #${String.fromCharCode(65 + resultIndex)}` : 'Value';
    table.columns.push({ text: valueText });

    // Populate rows, set value to empty string when label not present.
    _.each(md, function(series) {
      if (series.value) {
        series.values = [series.value];
      }
      if (series.values) {
        for (i = 0; i < series.values.length; i++) {
          var values = series.values[i];
          var reordered: any = [values[0] * 1000];
          if (series.metric) {
            for (j = 0; j < sortedLabels.length; j++) {
              var label = sortedLabels[j];
              if (series.metric.hasOwnProperty(label)) {
                reordered.push(series.metric[label]);
              } else {
                reordered.push('');
              }
            }
          }
          reordered.push(parseFloat(values[1]));
          table.rows.push(reordered);
        }
      }
    });

    return table;
  }

  transformInstantMetricData(md, options) {
    var dps = [],
      metricLabel = null;
    metricLabel = this.createMetricLabel(md.metric, options);
    dps.push([parseFloat(md.value[1]), md.value[0] * 1000]);
    return { target: metricLabel, datapoints: dps };
  }

  createMetricLabel(labelData, options) {
    if (_.isUndefined(options) || _.isEmpty(options.legendFormat)) {
      return this.getOriginalMetricName(labelData);
    }

    return this.renderTemplate(this.templateSrv.replace(options.legendFormat), labelData) || '{}';
  }

  renderTemplate(aliasPattern, aliasData) {
    var aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
    return aliasPattern.replace(aliasRegex, function(match, g1) {
      if (aliasData[g1]) {
        return aliasData[g1];
      }
      return g1;
    });
  }

  getOriginalMetricName(labelData) {
    var metricName = labelData.__name__ || '';
    delete labelData.__name__;
    var labelPart = _.map(_.toPairs(labelData), function(label) {
      return label[0] + '="' + label[1] + '"';
    }).join(',');
    return metricName + '{' + labelPart + '}';
  }

  getPrometheusTime(date, roundUp) {
    if (_.isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.ceil(date.valueOf() / 1000);
  }
}
