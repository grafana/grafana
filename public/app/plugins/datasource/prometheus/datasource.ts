///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';

import kbn from 'app/core/utils/kbn';
import * as dateMath from 'app/core/utils/datemath';
import PrometheusMetricFindQuery from './metric_find_query';
import TableModel from 'app/core/table_model';

var durationSplitRegexp = /(\d+)(ms|s|m|h|d|w|M|y)/;

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

  /** @ngInject */
  constructor(instanceSettings,
              private $q,
              private backendSrv,
              private templateSrv,
              private timeSrv) {
    this.type = 'prometheus';
    this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
    this.name = instanceSettings.name;
    this.supportMetrics = true;
    this.url = instanceSettings.url;
    this.directUrl = instanceSettings.directUrl;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
  }

  _request(method, url, requestId?) {
    var options: any = {
      url: this.url + url,
      method: method,
      requestId: requestId,
    };

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }

    if (this.basicAuth) {
      options.headers = {
        "Authorization": this.basicAuth
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

    var queries = [];
    var activeTargets = [];

    options = _.clone(options);

    for (let target of options.targets) {
      if (!target.expr || target.hide) {
        continue;
      }

      activeTargets.push(target);

      var query: any = {};
      query.expr = this.templateSrv.replace(target.expr, options.scopedVars, self.interpolateQueryExpr);
      query.requestId = options.panelId + target.refId;

      var interval = this.templateSrv.replace(target.interval, options.scopedVars) || options.interval;
      var intervalFactor = target.intervalFactor || 1;
      target.step = query.step = this.calculateInterval(interval, intervalFactor);
      var range = Math.ceil(end - start);
      target.step = query.step = this.adjustStep(query.step, this.intervalSeconds(options.interval), range);
      queries.push(query);
    }

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      return this.$q.when({ data: [] });
    }

    var allQueryPromise = _.map(queries, query => {
      return this.performTimeSeriesQuery(query, start, end);
    });

    return this.$q.all(allQueryPromise).then(responseList => {
      var result = [];
      var index = 0;

      _.each(responseList, (response, index) => {
        if (response.status === 'error') {
          throw response.error;
        }

        if (activeTargets[index].format === "table") {
          result.push(self.transformMetricDataToTable(response.data.data.result));
        } else {
          for (let metricData of response.data.data.result) {
            result.push(self.transformMetricData(metricData, activeTargets[index], start, end));
          }
        }
      });

      return { data: result };
    });
  }

  adjustStep(step, autoStep, range) {
    // Prometheus drop query if range/step > 11000
    // calibrate step if it is too big
    if (step !== 0 && range / step > 11000) {
      step = Math.ceil(range / 11000);
    }
    return Math.max(step, autoStep);
  }

  performTimeSeriesQuery(query, start, end) {
    if (start > end) {
      throw { message: 'Invalid time range' };
    }

    var url = '/api/v1/query_range?query=' + encodeURIComponent(query.expr) + '&start=' + start + '&end=' + end + '&step=' + query.step;
    return this._request('GET', url, query.requestId);
  }

  performSuggestQuery(query, cache = false) {
    var url = '/api/v1/label/__name__/values';

    if (cache && this.metricsNameCache && this.metricsNameCache.expire > Date.now()) {
      return this.$q.when(_.filter(this.metricsNameCache.data, metricName => {
        return metricName.indexOf(query) !== 1;
      }));
    }

    return this._request('GET', url).then(result => {
      this.metricsNameCache = {
        data: result.data.data,
        expire: Date.now() + (60 * 1000)
      };
      return _.filter(result.data.data, metricName => {
        return metricName.indexOf(query) !== 1;
      });
    });
  }

  metricFindQuery(query) {
    if (!query) { return this.$q.when([]); }

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

    if (!expr) { return this.$q.when([]); }

    var interpolated = this.templateSrv.replace(expr, {}, this.interpolateQueryExpr);

    var step = '60s';
    if (annotation.step) {
      step = this.templateSrv.replace(annotation.step);
    }

    var start = this.getPrometheusTime(options.range.from, false);
    var end = this.getPrometheusTime(options.range.to, true);
    var query = {
      expr: interpolated,
      step: this.adjustStep(kbn.interval_to_seconds(step), 0, Math.ceil(end - start)) + 's'
    };

    var self = this;
    return this.performTimeSeriesQuery(query, start, end).then(function(results) {
      var eventList = [];
      tagKeys = tagKeys.split(',');

      _.each(results.data.data.result, function(series) {
        var tags = _.chain(series.metric)
        .filter(function(v, k) {
          return _.includes(tagKeys, k);
        }).value();

        for (let value of series.values) {
          if (value[1] === '1') {
            var event = {
              annotation: annotation,
              time: Math.floor(parseFloat(value[0])) * 1000,
              title: self.renderTemplate(titleFormat, series.metric),
              tags: tags,
              text: self.renderTemplate(textFormat, series.metric)
            };

            eventList.push(event);
          }
        }
      });

      return eventList;
    });
  }

  testDatasource() {
    return this.metricFindQuery('metrics(.*)').then(function() {
      return { status: 'success', message: 'Data source is working'};
    });
  }

  calculateInterval(interval, intervalFactor) {
    return Math.ceil(this.intervalSeconds(interval) * intervalFactor);
  }

  intervalSeconds(interval) {
    var m = interval.match(durationSplitRegexp);
    var dur = moment.duration(parseInt(m[1]), m[2]);
    var sec = dur.asSeconds();
    if (sec < 1) {
      sec = 1;
    }

    return sec;
  }

  transformMetricData(md, options, start, end) {
    var dps = [],
      metricLabel = null;

    metricLabel = this.createMetricLabel(md.metric, options);

    var stepMs = parseInt(options.step) * 1000;
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

  transformMetricDataToTable(md) {
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
    table.columns.push({text: 'Time', type: 'time'});
    _.each(sortedLabels, function(label, labelIndex) {
      metricLabels[label] = labelIndex + 1;
      table.columns.push({text: label});
    });
    table.columns.push({text: 'Value'});

    // Populate rows, set value to empty string when label not present.
    _.each(md, function(series) {
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
