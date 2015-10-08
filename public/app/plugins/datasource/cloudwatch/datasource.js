define([
  'angular',
  'lodash',
  'moment',
  './query_ctrl',
  './directives',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('CloudWatchDatasource', function($q, backendSrv, templateSrv) {

    function CloudWatchDatasource(datasource) {
      this.type = 'cloudwatch';
      this.name = datasource.name;
      this.supportMetrics = true;
      this.proxyUrl = datasource.url;
      this.defaultRegion = datasource.jsonData.defaultRegion;
    }

    CloudWatchDatasource.prototype.query = function(options) {
      var start = convertToCloudWatchTime(options.range.from);
      var end = convertToCloudWatchTime(options.range.to);

      var queries = [];
      _.each(options.targets, _.bind(function(target) {
        if (target.hide || !target.namespace || !target.metricName || _.isEmpty(target.statistics)) {
          return;
        }

        var query = {};
        query.region = templateSrv.replace(target.region, options.scopedVars);
        query.namespace = templateSrv.replace(target.namespace, options.scopedVars);
        query.metricName = templateSrv.replace(target.metricName, options.scopedVars);
        query.dimensions = convertDimensionFormat(target.dimensions);
        query.statistics = getActivatedStatistics(target.statistics);
        query.period = parseInt(target.period, 10);

        var range = end - start;
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

      var allQueryPromise = _.map(queries, function(query) {
        return this.performTimeSeriesQuery(query, start, end);
      }, this);

      return $q.all(allQueryPromise).then(function(allResponse) {
        var result = [];

        _.each(allResponse, function(response, index) {
          var metrics = transformMetricData(response, options.targets[index]);
          result = result.concat(metrics);
        });

        return { data: result };
      });
    };

    CloudWatchDatasource.prototype.performTimeSeriesQuery = function(query, start, end) {
      return this.awsRequest({
        region: query.region,
        action: 'GetMetricStatistics',
        parameters:  {
          namespace: query.namespace,
          metricName: query.metricName,
          dimensions: query.dimensions,
          statistics: query.statistics,
          startTime: start,
          endTime: end,
          period: query.period
        }
      });
    };

    CloudWatchDatasource.prototype.getRegions = function() {
      return this.awsRequest({action: '__GetRegions'});
    };

    CloudWatchDatasource.prototype.getNamespaces = function() {
      return this.awsRequest({action: '__GetNamespaces'});
    };

    CloudWatchDatasource.prototype.getMetrics = function(namespace) {
      return this.awsRequest({
        action: '__GetMetrics',
        parameters: {
          namespace: templateSrv.replace(namespace)
        }
      });
    };

    CloudWatchDatasource.prototype.getDimensionKeys = function(namespace) {
      return this.awsRequest({
        action: '__GetDimensions',
        parameters: {
          namespace: templateSrv.replace(namespace)
        }
      });
    };

    CloudWatchDatasource.prototype.getDimensionValues = function(region, namespace, metricName, dimensions) {
      var request = {
        region: templateSrv.replace(region),
        action: 'ListMetrics',
        parameters: {
          namespace: templateSrv.replace(namespace),
          metricName: templateSrv.replace(metricName),
          dimensions: convertDimensionFormat(dimensions),
        }
      };

      return this.awsRequest(request).then(function(result) {
        return _.chain(result.Metrics).map(function(metric) {
          return _.pluck(metric.Dimensions, 'Value');
        }).flatten().uniq().sortBy(function(name) {
          return name;
        }).map(function(value) {
          return {value: value, text: value};
        }).value();
      });
    };

    CloudWatchDatasource.prototype.performEC2DescribeInstances = function(region, filters, instanceIds) {
      return this.awsRequest({
        region: region,
        action: 'DescribeInstances',
        parameters: { filter: filters, instanceIds: instanceIds }
      });
    };

    CloudWatchDatasource.prototype.metricFindQuery = function(query) {
      var region;
      var namespace;
      var metricName;

      var transformSuggestData = function(suggestData) {
        return _.map(suggestData, function(v) {
          return { text: v };
        });
      };

      var regionQuery = query.match(/^regions\(\)/);
      if (regionQuery) {
        return this.getRegions();
      }

      var namespaceQuery = query.match(/^namespaces\(\)/);
      if (namespaceQuery) {
        return this.getNamespaces();
      }

      var metricNameQuery = query.match(/^metrics\(([^\)]+?)\)/);
      if (metricNameQuery) {
        return this.getMetrics(metricNameQuery[1]);
      }

      var dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)\)/);
      if (dimensionKeysQuery) {
        return this.getDimensionKeys(dimensionKeysQuery[1]);
      }

      var dimensionValuesQuery = query.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?([^)]*))?\)/);
      if (dimensionValuesQuery) {
        region = templateSrv.replace(dimensionValuesQuery[1]);
        namespace = templateSrv.replace(dimensionValuesQuery[2]);
        metricName = templateSrv.replace(dimensionValuesQuery[3]);
        var dimensionPart = templateSrv.replace(dimensionValuesQuery[5]);

        var dimensions = {};
        if (!_.isEmpty(dimensionPart)) {
          _.each(dimensionPart.split(','), function(v) {
            var t = v.split('=');
            if (t.length !== 2) {
              throw new Error('Invalid query format');
            }
            dimensions[t[0]] = t[1];
          });
        }

        return this.getDimensionValues(region, namespace, metricName, dimensions).then(transformSuggestData);
      }

      var ebsVolumeIdsQuery = query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
      if (ebsVolumeIdsQuery) {
        region = templateSrv.replace(ebsVolumeIdsQuery[1]);
        var instanceId = templateSrv.replace(ebsVolumeIdsQuery[2]);
        var instanceIds = [
          instanceId
        ];

        return this.performEC2DescribeInstances(region, [], instanceIds).then(function(result) {
          var volumeIds = _.map(result.Reservations[0].Instances[0].BlockDeviceMappings, function(mapping) {
            return mapping.EBS.VolumeID;
          });

          return transformSuggestData(volumeIds);
        });
      }

      return $q.when([]);
    };

    CloudWatchDatasource.prototype.testDatasource = function() {
      /* use billing metrics for test */
      var region = 'us-east-1';
      var namespace = 'AWS/Billing';
      var metricName = 'EstimatedCharges';
      var dimensions = {};

      return this.getDimensionValues(region, namespace, metricName, dimensions).then(function () {
        return { status: 'success', message: 'Data source is working', title: 'Success' };
      });
    };

    CloudWatchDatasource.prototype.awsRequest = function(data) {
      var options = {
        method: 'POST',
        url: this.proxyUrl,
        data: data
      };

      return backendSrv.datasourceRequest(options).then(function(result) {
        return result.data;
      });
    };

    CloudWatchDatasource.prototype.getDefaultRegion = function() {
      return this.defaultRegion;
    };

    function transformMetricData(md, options) {
      var result = [];

      console.log(options);
      var dimensionPart = templateSrv.replace(JSON.stringify(options.dimensions));
      _.each(getActivatedStatistics(options.statistics), function(s) {
        var originalSettings = _.templateSettings;
        _.templateSettings = {
          interpolate: /\{\{(.+?)\}\}/g
        };
        var template = _.template(options.legendFormat);

        var metricLabel;
        if (_.isEmpty(options.legendFormat)) {
          metricLabel = md.Label + '_' + s + dimensionPart;
        } else {
          var d = convertDimensionFormat(options.dimensions);
          metricLabel = template({
            Region: templateSrv.replace(options.region),
            Namespace: templateSrv.replace(options.namespace),
            MetricName: templateSrv.replace(options.metricName),
            Dimensions: d,
            Statistics: s
          });
        }

        _.templateSettings = originalSettings;

        var dps = _.map(md.Datapoints, function(value) {
          return [value[s], new Date(value.Timestamp).getTime()];
        });
        dps = _.sortBy(dps, function(dp) { return dp[1]; });

        result.push({ target: metricLabel, datapoints: dps });
      });

      return result;
    }

    function getActivatedStatistics(statistics) {
      var activatedStatistics = [];
      _.each(statistics, function(v, k) {
        if (v) {
          activatedStatistics.push(k);
        }
      });
      return activatedStatistics;
    }

    function convertToCloudWatchTime(date) {
      return Math.round(date.valueOf() / 1000);
    }

    function convertDimensionFormat(dimensions) {
      return _.map(_.keys(dimensions), function(key) {
        return {
          Name: templateSrv.replace(key),
          Value: templateSrv.replace(dimensions[key])
        };
      });
    }

    return CloudWatchDatasource;
  });

});
