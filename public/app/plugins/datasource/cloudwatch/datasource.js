/* global AWS */
define([
  'angular',
  'lodash',
  'kbn',
  'moment',
  './queryCtrl',
  'aws-sdk',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('CloudWatchDatasource', function($q, $http, templateSrv) {

    function CloudWatchDatasource(datasource) {
      this.type = 'cloudwatch';
      this.name = datasource.name;
      this.supportMetrics = true;

      AWS.config.update({ region: datasource.jsonData.region });
      this.cloudwatch = new AWS.CloudWatch({
        accessKeyId: datasource.jsonData.accessKeyId,
        secretAccessKey: datasource.jsonData.secretAccessKey,
      });
    }

    // Called once per panel (graph)
    CloudWatchDatasource.prototype.query = function(options) {
      var start = convertToCloudWatchTime(options.range.from);
      var end = convertToCloudWatchTime(options.range.to);

      var queries = [];
      _.each(options.targets, _.bind(function(target) {
        if (!target.namespace || !target.metricName || _.isEmpty(target.dimensions) || _.isEmpty(target.statistics)) {
          return;
        }

        var query = {};
        query.namespace = templateSrv.replace(target.namespace, options.scopedVars);
        query.metricName = templateSrv.replace(target.metricName, options.scopedVars);
        query.dimensions = _.map(_.keys(target.dimensions), function(key) {
          return {
            Name: key,
            Value: target.dimensions[key]
          };
        });
        query.statistics = _.keys(target.statistics);
        query.period = target.period;

        var range = (end.getTime() - start.getTime()) / 1000;
        // CloudWatch limit datapoints up to 1440
        if (range / query.period >= 1440) {
          query.period = Math.floor(range / 1440 / 60) * 60;
        }

        queries.push(query);
      }, this));

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var allQueryPromise = _.map(queries, _.bind(function(query) {
        return this.performTimeSeriesQuery(query, start, end);
      }, this));

      return $q.all(allQueryPromise)
        .then(function(allResponse) {
          var result = [];

          _.each(allResponse, function(response, index) {
            var metrics = transformMetricData(response, options.targets[index]);
            _.each(metrics, function(m) {
              result.push(m);
            });
          });

          return { data: result };
        });
    };

    CloudWatchDatasource.prototype.performTimeSeriesQuery = function(query, start, end) {
      var params = {
        Namespace: query.namespace,
        MetricName: query.metricName,
        Dimensions: query.dimensions,
        Statistics: query.statistics,
        StartTime: start,
        EndTime: end,
        Period: query.period
      };

      var d = $q.defer();
      this.cloudwatch.getMetricStatistics(params, function(err, data) {
        if (err) {
          return d.reject(err);
        }
        return d.resolve(data);
      });

      return d.promise;
    };

    CloudWatchDatasource.prototype.performSuggestQuery = function(params) {
      var d = $q.defer();

      this.cloudwatch.listMetrics(params, function(err, data) {
        if (err) {
          return d.reject(err);
        }

        return d.resolve(data);
      });

      return d.promise;
    };

    CloudWatchDatasource.prototype.testDatasource = function() {
      return this.performSuggestQuery({}).then(function () {
        return { status: 'success', message: 'Data source is working', title: 'Success' };
      });
    };

    function transformMetricData(md, options) {
      var result = [];

      var dimensionPart = JSON.stringify(options.dimensions);
      _.each(_.keys(options.statistics), function(s) {
        var metricLabel = md.Label + '_' + s + dimensionPart;

        var dps = _.map(md.Datapoints, function(value) {
          return [value[s], new Date(value.Timestamp).getTime()];
        });
        dps = _.sortBy(dps, function(dp) { return dp[1]; });

        result.push({ target: metricLabel, datapoints: dps });
      });

      return result;
    }

    function convertToCloudWatchTime(date) {
      return kbn.parseDate(date);
    }

    return CloudWatchDatasource;
  });

});
