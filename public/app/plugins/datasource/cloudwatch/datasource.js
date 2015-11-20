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
      options = _.clone(options);
      _.each(options.targets, _.bind(function(target) {
        if (target.hide || !target.namespace || !target.metricName || _.isEmpty(target.statistics)) {
          return;
        }

        var query = {};
        query.region = templateSrv.replace(target.region, options.scopedVars);
        query.namespace = templateSrv.replace(target.namespace, options.scopedVars);
        query.metricName = templateSrv.replace(target.metricName, options.scopedVars);
        query.dimensions = convertDimensionFormat(target.dimensions, options.scopedVars);
        query.statistics = target.statistics;

        var range = end - start;
        query.period = parseInt(target.period, 10) || (query.namespace === 'AWS/EC2' ? 300 : 60);
        if (range / query.period >= 1440) {
          query.period = Math.ceil(range / 1440 / 60) * 60;
        }
        target.period = query.period;

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
          dimensions: convertDimensionFormat(dimensions, {}),
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
          return { text: v, value: v };
        });
      };

      var regionQuery = query.match(/^regions\(\)/);
      if (regionQuery) {
        return this.getRegions().then(function(result) {
          return transformSuggestData(result);
        });
      }

      var namespaceQuery = query.match(/^namespaces\(\)/);
      if (namespaceQuery) {
        return this.getNamespaces().then(function(result) {
          return transformSuggestData(result);
        });
      }

      var metricNameQuery = query.match(/^metrics\(([^\)]+?)\)/);
      if (metricNameQuery) {
        return this.getMetrics(metricNameQuery[1]).then(function(result) {
          return transformSuggestData(result);
        });
      }

      var dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)\)/);
      if (dimensionKeysQuery) {
        return this.getDimensionKeys(dimensionKeysQuery[1]).then(function(result) {
          return transformSuggestData(result);
        });
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

        return this.getDimensionValues(region, namespace, metricName, dimensions);
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
            return mapping.Ebs.VolumeId;
          });

          return transformSuggestData(volumeIds);
        });
      }

      return $q.when([]);
    };

    CloudWatchDatasource.prototype.testDatasource = function() {
      /* use billing metrics for test */
      var region = this.defaultRegion;
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
      var aliasRegex = /\{\{(.+?)\}\}/g;
      var aliasPattern = options.alias || '{{metric}}_{{stat}}';
      var aliasData = {
        region: templateSrv.replace(options.region),
        namespace: templateSrv.replace(options.namespace),
        metric: templateSrv.replace(options.metricName),
      };
      _.extend(aliasData, options.dimensions);

      var periodMs = options.period * 1000;
      return _.map(options.statistics, function(stat) {
        var dps = [];
        var lastTimestamp = null;
        _.chain(md.Datapoints)
        .sortBy(function(dp) {
          return dp.Timestamp;
        })
        .each(function(dp) {
          var timestamp = new Date(dp.Timestamp).getTime();
          if (lastTimestamp && (timestamp - lastTimestamp) > periodMs) {
            dps.push([null, lastTimestamp + periodMs]);
          }
          lastTimestamp = timestamp;
          dps.push([dp[stat], timestamp]);
        });

        aliasData.stat = stat;
        var seriesName = aliasPattern.replace(aliasRegex, function(match, g1) {
          if (aliasData[g1]) {
            return aliasData[g1];
          }
          return g1;
        });

        return {target: seriesName, datapoints: dps};
      });
    }

    function convertToCloudWatchTime(date) {
      return Math.round(date.valueOf() / 1000);
    }

    function convertDimensionFormat(dimensions, scopedVars) {
      return _.map(dimensions, function(value, key) {
        return {
          Name: templateSrv.replace(key, scopedVars),
          Value: templateSrv.replace(value, scopedVars)
        };
      });
    }

    return CloudWatchDatasource;
  });

});
