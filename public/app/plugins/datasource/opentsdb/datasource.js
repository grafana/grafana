define([
  'angular',
  'lodash',
  'kbn',
  'moment',
  './queryCtrl',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('OpenTSDBDatasource', function($q, backendSrv, templateSrv) {

    function OpenTSDBDatasource(datasource) {
      this.type = 'opentsdb';
      this.editorSrc = 'app/features/opentsdb/partials/query.editor.html';
      this.url = datasource.url;
      this.name = datasource.name;
      this.supportMetrics = true;
    }

    // Called once per panel (graph)
    OpenTSDBDatasource.prototype.query = function(options) {
      var start = convertToTSDBTime(options.range.from);
      var end = convertToTSDBTime(options.range.to);
      var qs = [];

      _.each(options.targets, function(target) {
        qs.push(convertTargetToQuery(target, options.interval));
      });

      var queries = _.compact(qs);

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var groupByTags = {};
      _.each(queries, function(query) {
        _.each(query.tags, function(val, key) {
          groupByTags[key] = true;
        });
      });

      return this.performTimeSeriesQuery(queries, start, end).then(function(response) {
        var metricToTargetMapping = mapMetricsToTargets(response.data, options.targets);
        var result = _.map(response.data, function(metricData, index) {
          index = metricToTargetMapping[index];
          return transformMetricData(metricData, groupByTags, options.targets[index]);
        });
        return { data: result };
      });
    };

    OpenTSDBDatasource.prototype.performTimeSeriesQuery = function(queries, start, end) {
      var reqBody = {
        start: start,
        queries: queries
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (end) {
        reqBody.end = end;
      }

      var options = {
        method: 'POST',
        url: this.url + '/api/query',
        data: reqBody
      };

      return backendSrv.datasourceRequest(options);
    };

    OpenTSDBDatasource.prototype.performSuggestQuery = function(query, type) {
      var options = {
        method: 'GET',
        url: this.url + '/api/suggest',
        params: {
          type: type,
          q: query
        }
      };
      return backendSrv.datasourceRequest(options).then(function(result) {
        return result.data;
      });
    };

    OpenTSDBDatasource.prototype.performMetricKeyValueLookup = function(metric, key) {
      if(metric === "") {
        throw "Metric not set.";
      } else if(key === "") {
        throw "Key not set.";
      }
      var m = metric + "{" + key + "=*}";
      var options = {
        method: 'GET',
        url: this.url + '/api/search/lookup',
        params: {
          m: m,
        }
      };
      return backendSrv.datasourceRequest(options).then(function(result) {
        result = result.data.results;
        var tagvs = [];
        _.each(result, function(r) {
          tagvs.push(r.tags[key]);
        });
        return tagvs;
      });
    };

    OpenTSDBDatasource.prototype.performMetricKeyLookup = function(metric) {
      if(metric === "") {
        throw "Metric not set.";
      }
      var options = {
        method: 'GET',
        url: this.url + '/api/search/lookup',
        params: {
          m: metric,
        }
      };
      return backendSrv.datasourceRequest(options).then(function(result) {
        result = result.data.results;
        var tagks = [];
        _.each(result, function(r) {
          _.each(r.tags, function(tagv, tagk) {
            if(tagks.indexOf(tagk) === -1) {
              tagks.push(tagk);
            }
          });
        });
        return tagks;
      });
    };

    OpenTSDBDatasource.prototype.testDatasource = function() {
      return this.performSuggestQuery('cpu', 'metrics').then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

    function transformMetricData(md, groupByTags, options) {
      var metricLabel = createMetricLabel(md, options, groupByTags);
      var dps = [];

      // TSDB returns datapoints has a hash of ts => value.
      // Can't use _.pairs(invert()) because it stringifies keys/values
      _.each(md.dps, function (v, k) {
        dps.push([v, k * 1000]);
      });

      return { target: metricLabel, datapoints: dps };
    }

    function createMetricLabel(md, options, groupByTags) {
      if (!_.isUndefined(options) && options.alias) {
        var scopedVars = {};
        _.each(md.tags, function(value, key) {
          scopedVars['tag_' + key] = {value: value};
        });
        return templateSrv.replace(options.alias, scopedVars);
      }

      var label = md.metric;
      var tagData = [];

      if (!_.isEmpty(md.tags)) {
        _.each(_.pairs(md.tags), function(tag) {
          if (_.has(groupByTags, tag[0])) {
            tagData.push(tag[0] + "=" + tag[1]);
          }
        });
      }

      if (!_.isEmpty(tagData)) {
        label += "{" + tagData.join(", ") + "}";
      }

      return label;
    }

    function convertTargetToQuery(target, interval) {
      if (!target.metric || target.hide) {
        return null;
      }

      var query = {
        metric: templateSrv.replace(target.metric),
        aggregator: "avg"
      };

      if (target.aggregator) {
        query.aggregator = templateSrv.replace(target.aggregator);
      }

      if (target.shouldComputeRate) {
        query.rate = true;
        query.rateOptions = {
          counter: !!target.isCounter
        };

        if (target.counterMax && target.counterMax.length) {
          query.rateOptions.counterMax = parseInt(target.counterMax);
        }

        if (target.counterResetValue && target.counterResetValue.length) {
          query.rateOptions.resetValue = parseInt(target.counterResetValue);
        }
      }

      if (!target.disableDownsampling) {
        interval =  templateSrv.replace(target.downsampleInterval || interval);

        if (interval.match(/\.[0-9]+s/)) {
          interval = parseFloat(interval)*1000 + "ms";
        }

        query.downsample = interval + "-" + target.downsampleAggregator;
      }

      query.tags = angular.copy(target.tags);
      if(query.tags){
        for(var key in query.tags){
          query.tags[key] = templateSrv.replace(query.tags[key]);
        }
      }

      return query;
    }

    function mapMetricsToTargets(metrics, targets) {
      var interpolatedTagValue;
      return _.map(metrics, function(metricData) {
        return _.findIndex(targets, function(target) {
          return target.metric === metricData.metric &&
            _.all(target.tags, function(tagV, tagK) {
            interpolatedTagValue = templateSrv.replace(tagV);
            return metricData.tags[tagK] === interpolatedTagValue || interpolatedTagValue === "*";
          });
        });
      });
    }

    function convertToTSDBTime(date) {
      if (date === 'now') {
        return null;
      }

      date = kbn.parseDate(date);

      return date.getTime();
    }

    return OpenTSDBDatasource;
  });

});
