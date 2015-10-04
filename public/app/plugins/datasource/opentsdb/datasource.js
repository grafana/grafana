define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
  'moment',
  './directives',
  './queryCtrl',
],
function (angular, _, dateMath) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('OpenTSDBDatasource', function($q, backendSrv, templateSrv) {

    function OpenTSDBDatasource(datasource) {
      this.type = 'opentsdb';
      this.url = datasource.url;
      this.name = datasource.name;
      this.supportMetrics = true;
    }

    // Called once per panel (graph)
    OpenTSDBDatasource.prototype.query = function(options) {
      var start = convertToTSDBTime(options.rangeRaw.from, false);
      var end = convertToTSDBTime(options.rangeRaw.to, true);
      var qs = [];

      _.each(options.targets, function(target) {
        if (!target.metric) { return; }
        qs.push(convertTargetToQuery(target, options));
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
        var metricToTargetMapping = mapMetricsToTargets(response.data, options);
        var result = _.map(response.data, function(metricData, index) {
          index = metricToTargetMapping[index];
          if (index === -1) {
            index = 0;
          }
          return transformMetricData(metricData, groupByTags, options.targets[index], options);
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

    OpenTSDBDatasource.prototype._performSuggestQuery = function(query, type) {
      return this._get('/api/suggest', {type: type, q: query, max: 1000}).then(function(result) {
        return result.data;
      });
    };

    OpenTSDBDatasource.prototype._performMetricKeyValueLookup = function(metric, key) {
      if(!metric || !key) {
        return $q.when([]);
      }

      var m = metric + "{" + key + "=*}";

      return this._get('/api/search/lookup', {m: m, limit: 3000}).then(function(result) {
        result = result.data.results;
        var tagvs = [];
        _.each(result, function(r) {
          if (tagvs.indexOf(r.tags[key]) === -1) {
            tagvs.push(r.tags[key]);
          }
        });
        return tagvs;
      });
    };

    OpenTSDBDatasource.prototype._performMetricKeyLookup = function(metric) {
      if(!metric) { return $q.when([]); }

      return this._get('/api/search/lookup', {m: metric, limit: 1000}).then(function(result) {
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

    OpenTSDBDatasource.prototype._get = function(relativeUrl, params) {
      return backendSrv.datasourceRequest({
        method: 'GET',
        url: this.url + relativeUrl,
        params: params,
      });
    };

    OpenTSDBDatasource.prototype.metricFindQuery = function(query) {
      if (!query) { return $q.when([]); }

      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      var responseTransform = function(result) {
        return _.map(result, function(value) {
          return {text: value};
        });
      };

      var metrics_regex = /metrics\((.*)\)/;
      var tag_names_regex = /tag_names\((.*)\)/;
      var tag_values_regex = /tag_values\((.*),\s?(.*)\)/;
      var tag_names_suggest_regex = /suggest_tagk\((.*)\)/;
      var tag_values_suggest_regex = /suggest_tagv\((.*)\)/;

      var metrics_query = interpolated.match(metrics_regex);
      if (metrics_query) {
        return this._performSuggestQuery(metrics_query[1], 'metrics').then(responseTransform);
      }

      var tag_names_query = interpolated.match(tag_names_regex);
      if (tag_names_query) {
        return this._performMetricKeyLookup(tag_names_query[1]).then(responseTransform);
      }

      var tag_values_query = interpolated.match(tag_values_regex);
      if (tag_values_query) {
        return this._performMetricKeyValueLookup(tag_values_query[1], tag_values_query[2]).then(responseTransform);
      }

      var tag_names_suggest_query = interpolated.match(tag_names_suggest_regex);
      if (tag_names_suggest_query) {
        return this._performSuggestQuery(tag_names_suggest_query[1], 'tagk').then(responseTransform);
      }

      var tag_values_suggest_query = interpolated.match(tag_values_suggest_regex);
      if (tag_values_suggest_query) {
        return this._performSuggestQuery(tag_values_suggest_query[1], 'tagv').then(responseTransform);
      }

      return $q.when([{text: "wtf"}]);
    };

    OpenTSDBDatasource.prototype.testDatasource = function() {
      return this._performSuggestQuery('cpu', 'metrics').then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

<<<<<<< c81196ad0d8b96a4053549a00b13308b32356a48
<<<<<<< e2aa0e975206b0b2f9b219d79077361b64b47630
=======
>>>>>>> refactor: polishing OpenTSDB related PR #1646, added caching of aggregators request so only one call is made
    var aggregatorsPromise = null;
    OpenTSDBDatasource.prototype.getAggregators = function() {
      if (aggregatorsPromise) { return aggregatorsPromise; }

      aggregatorsPromise =  this._get('/api/aggregators').then(function(result) {
        if (result.data && _.isArray(result.data)) {
<<<<<<< c81196ad0d8b96a4053549a00b13308b32356a48
          return result.data.sort();
        }
        return [];
      });
      return aggregatorsPromise;
    };

    function transformMetricData(md, groupByTags, target, options) {
      var metricLabel = createMetricLabel(md, target, groupByTags, options);
=======
    OpenTSDBDatasource.prototype.performAggregatorsQuery = function() {
      var options = {
        method: 'GET',
        url: this.url + '/api/aggregators'
      };
      return $http(options).then(function(result) {
        if (result.data instanceof Array) {
=======
>>>>>>> refactor: polishing OpenTSDB related PR #1646, added caching of aggregators request so only one call is made
          return result.data.sort();
        }
        return [];
      });
      return aggregatorsPromise;
    };

    OpenTSDBDatasource.prototype.performAggregatorsQuery = function() {
      var options = {
        method: 'GET',
        url: this.url + '/api/aggregators'
      };
      return $http(options).then(function(result) {
        if (result.data instanceof Array) {
          return result.data.sort();
        } else {
          return result.data;
        }
      });
    };

    function transformMetricData(md, groupByTags, options) {
      var metricLabel = createMetricLabel(md, options, groupByTags);
>>>>>>> Instead of hard-coding the OpenTsdb aggregators list, pull the supported
      var dps = [];

      // TSDB returns datapoints has a hash of ts => value.
      // Can't use _.pairs(invert()) because it stringifies keys/values
      _.each(md.dps, function (v, k) {
        dps.push([v, k * 1000]);
      });

      return { target: metricLabel, datapoints: dps };
    }

    function createMetricLabel(md, target, groupByTags, options) {
      if (target.alias) {
        var scopedVars = _.clone(options.scopedVars || {});
        _.each(md.tags, function(value, key) {
          scopedVars['tag_' + key] = {value: value};
        });
        return templateSrv.replace(target.alias, scopedVars);
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

    function convertTargetToQuery(target, options) {
      if (!target.metric || target.hide) {
        return null;
      }

      var query = {
        metric: templateSrv.replace(target.metric, options.scopedVars),
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
        var interval =  templateSrv.replace(target.downsampleInterval || options.interval);

        if (interval.match(/\.[0-9]+s/)) {
          interval = parseFloat(interval)*1000 + "ms";
        }

        query.downsample = interval + "-" + target.downsampleAggregator;
      }

      query.tags = angular.copy(target.tags);
      if(query.tags){
        for(var key in query.tags){
          query.tags[key] = templateSrv.replace(query.tags[key], options.scopedVars);
        }
      }

      return query;
    }

    function mapMetricsToTargets(metrics, options) {
      var interpolatedTagValue;
      return _.map(metrics, function(metricData) {
        return _.findIndex(options.targets, function(target) {
          return target.metric === metricData.metric &&
            _.all(target.tags, function(tagV, tagK) {
            interpolatedTagValue = templateSrv.replace(tagV, options.scopedVars);
            return metricData.tags[tagK] === interpolatedTagValue || interpolatedTagValue === "*";
          });
        });
      });
    }

    function convertToTSDBTime(date, roundUp) {
      if (date === 'now') {
        return null;
      }

      date = dateMath.parse(date, roundUp);
      return date.valueOf();
    }

    return OpenTSDBDatasource;
  });

});
