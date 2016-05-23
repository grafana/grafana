define([
  'lodash'
],
function (_) {
  'use strict';

  function PrometheusMetricFindQuery(datasource, query, timeSrv) {
    this.datasource = datasource;
    this.query = query;
    this.range = timeSrv.timeRange();
  }

  PrometheusMetricFindQuery.prototype.process = function() {
    var labelValuesRegex  = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]+)\)$/;
    var metricNamesRegex = /^metrics\((.+)\)$/;
    var labelsRegex = /^labels\((.+)\)$/;
    var queryResultRegex = /^query_result\((.+)\)$/;

    var labelsQuery = this.query.match(labelsRegex);
    if (labelsQuery) {
      return this.labelsQuery(labelsQuery[1]);
    }

    var labelValuesQuery = this.query.match(labelValuesRegex);
    if (labelValuesQuery) {
      if (labelValuesQuery[1]) {
        return this.labelValuesQuery(labelValuesQuery[2], labelValuesQuery[1]);
      } else {
        return this.labelValuesQuery(labelValuesQuery[2], null);
      }
    }

    var metricNamesQuery = this.query.match(metricNamesRegex);
    if (metricNamesQuery) {
      return this.metricNameQuery(metricNamesQuery[1]);
    }

    var queryResultQuery = this.query.match(queryResultRegex);
    if (queryResultQuery) {
      return this.queryResultQuery(queryResultQuery[1]);
    }

    // if query contains full metric name, return metric name and label list
    return this.metricNameAndLabelsQuery(this.query);
  };

  PrometheusMetricFindQuery.prototype.labelValuesQuery = function(label, metric) {
    var url;

    if (!metric) {
      // return label values globally
      url = '/api/v1/label/' + label + '/values';

      return this.datasource._request('GET', url).then(function(result) {
        return _.map(result.data.data, function(value) {
          return {text: value};
        });
      });
    } else {
      url = '/api/v1/series?match[]=' + encodeURIComponent(metric)
        + '&start=' + (this.range.from.valueOf() / 1000)
        + '&end=' + (this.range.to.valueOf() / 1000);

      return this.datasource._request('GET', url)
      .then(function(result) {
        return _.map(result.data.data, function(metric) {
          return {
            text: metric[label],
            expandable: true
          };
        });
      });
    }
  };

  PrometheusMetricFindQuery.prototype.labelsQuery = function(metric) {
    var url;

    url = '/api/v1/series?match[]=' + encodeURIComponent(metric)
      + '&start=' + (this.range.from.valueOf() / 1000)
      + '&end=' + (this.range.to.valueOf() / 1000);

    return this.datasource._request('GET', url)
      .then(function(result) {
        var tags = {};
        _.each(result.data.data, function(metric) {
          _.each(metric, function(value, key) {
            if (key === "__name__") {
              return;
            }

            tags[key] = key;
          });
        });

        return _.map(tags, function(value) {
          return {text: value, value: value};
        });
      });
  };

  PrometheusMetricFindQuery.prototype.metricNameQuery = function(metricFilterPattern) {
    var url = '/api/v1/label/__name__/values';

    return this.datasource._request('GET', url)
      .then(function(result) {
        return _.chain(result.data.data)
          .filter(function(metricName) {
            var r = new RegExp(metricFilterPattern);
            return r.test(metricName);
          })
        .map(function(matchedMetricName) {
          return {
            text: matchedMetricName,
            expandable: true
          };
        })
        .value();
      });
  };

  PrometheusMetricFindQuery.prototype.queryResultQuery = function(query) {
    var url = '/api/v1/query?query=' + encodeURIComponent(query) + '&time=' + (this.range.to.valueOf() / 1000);

    return this.datasource._request('GET', url)
      .then(function(result) {
        return _.map(result.data.data.result, function(metricData) {
          var text = metricData.metric.__name__ || '';
          delete metricData.metric.__name__;
          text += '{' +
            _.map(metricData.metric, function(v, k) { return k + '="' + v + '"'; }).join(',') +
            '}';
          text += ' ' + metricData.value[1] + ' ' + metricData.value[0] * 1000;

          return {
            text: text,
            expandable: true
          };
        });
      });
  };

  PrometheusMetricFindQuery.prototype.metricNameAndLabelsQuery = function(query) {
    var url = '/api/v1/series?match[]=' + encodeURIComponent(query)
      + '&start=' + (this.range.from.valueOf() / 1000)
      + '&end=' + (this.range.to.valueOf() / 1000);

    var self = this;
    return this.datasource._request('GET', url)
      .then(function(result) {
        return _.map(result.data.data, function(metric) {
          return {
            text: self.datasource.getOriginalMetricName(metric),
            expandable: true
          };
        });
      });
  };

  return PrometheusMetricFindQuery;
});
