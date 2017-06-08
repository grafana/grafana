define([
  'angular',
  'lodash',
  './directives',
  './query_ctrl',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('BosunDatasource', function($q, backendSrv, templateSrv) {

    function BosunDatasource(datasource) {
      this.type = 'bosun';
      this.editorSrc = 'app/features/bosun/partials/query.editor.html';
      this.name = datasource.name;
      this.supportMetrics = true;
      this.url = datasource.url;
      this.lastErrors = {};
    }

    BosunDatasource.prototype._request = function(method, url, data) {
      var options = {
        url: this.url + url,
        method: method,
        data: data,
      };

      return backendSrv.datasourceRequest(options);
    };

    // Called once per panel (graph)
    BosunDatasource.prototype.query = function(options) {
      var queries = [];
      // Get time values to replace $start
      // The end time is what bosun regards as 'now'
      var secondsAgo = options.range.to.diff(options.range.from.utc(), 'seconds');
      secondsAgo += 's';
      _.each(options.targets, _.bind(function(target) {
        if (!target.expr || target.hide) {
          return;
        }
        var query = {};
        query = templateSrv.replace(target.expr, options.scopedVars);
        query = query.replace('$start', secondsAgo);
        query = query.replace('$ds', options.interval);
        queries.push(query);
      }, this));

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var allQueryPromise = _.map(queries, _.bind(function(query, index) {
        return this.performTimeSeriesQuery(query, options.targets[index], options);
      }, this));

      return $q.all(allQueryPromise)
        .then(function(allResponse) {
          var result = [];
          _.each(allResponse, function(response) {
            _.each(response.data, function(d) {
              result.push(d);
            });
          });
          return { data: result };
        });
    };

    BosunDatasource.prototype.performTimeSeriesQuery = function(query, target, options) {
      var exprDate = options.range.to.utc().format('YYYY-MM-DD');
      var exprTime = options.range.to.utc().format('HH:mm:ss');
      var url = '/api/expr?date=' + encodeURIComponent(exprDate) + '&time=' + encodeURIComponent(exprTime);
      return this._request('POST', url, query).then(function(response) {
        if (response.data.Type !== 'series') {
          throw 'Bosun response type must be a series';
        }
        var result = _.map(response.data.Results, function(result) {
          return transformMetricData(result, target, options);
        });
        return { data: result };
      });
    };

    function transformMetricData(result, target, options) {
      var tagData = [];
      _.each(result.Group, function(v, k) {
        tagData.push({'value': v, 'key': k});
      });
      var sortedTags = _.sortBy(tagData, 'key');
      var metricLabel = "";
      if (target.alias) {
        var scopedVars = _.clone(options.scopedVars || {});
        _.each(sortedTags, function(value) {
          scopedVars['tag_' + value.key] = {"value": value.value};
        });
        metricLabel = templateSrv.replace(target.alias, scopedVars);
      } else {
        tagData = [];
        _.each(sortedTags, function(tag) {
          tagData.push(tag.key + '=' + tag.value);
        });
        metricLabel = '{' + tagData.join(', ') + '}';
      }
      var dps = [];
      _.each(result.Value, function (v, k) {
        dps.push([v, parseInt(k) * 1000]);
      });
      return { target: metricLabel, datapoints: dps };
    }

    return BosunDatasource;
  });

});
