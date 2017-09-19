define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/datemath',
  'app/core/utils/kbn',
  'app/features/templating/variable',
  './annotation_query',
],
function (angular, _, moment, dateMath, kbn, templatingVariable, CloudWatchAnnotationQuery) {
  'use strict';

  /** @ngInject */
  function CloudWatchDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv) {
    this.type = 'cloudwatch';
    this.name = instanceSettings.name;
    this.supportMetrics = true;
    this.proxyUrl = instanceSettings.url;
    this.defaultRegion = instanceSettings.jsonData.defaultRegion;
    this.instanceSettings = instanceSettings;
    this.standardStatistics = [
      'Average',
      'Maximum',
      'Minimum',
      'Sum',
      'SampleCount'
    ];

    var self = this;
    this.query = function(options) {
      options = angular.copy(options);
      options.targets = this.expandTemplateVariable(options.targets, options.scopedVars, templateSrv);

      var queries = _.filter(options.targets, function (item) {
        return item.hide !== true &&
          !!item.region &&
          !!item.namespace &&
          !!item.metricName &&
          !_.isEmpty(item.statistics);
      }).map(function (item) {
        item.region = templateSrv.replace(item.region, options.scopedVars);
        item.namespace = templateSrv.replace(item.namespace, options.scopedVars);
        item.metricName = templateSrv.replace(item.metricName, options.scopedVars);
        var dimensions = {};
        _.each(item.dimensions, function (value, key) {
          dimensions[templateSrv.replace(key, options.scopedVars)] = templateSrv.replace(value, options.scopedVars);
        });
        item.dimensions = dimensions;
        item.period = self.getPeriod(item, options);

        return {
          refId: item.refId,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: self.instanceSettings.id,
          type: 'timeSeriesQuery',
          parameters: item
        };
      });

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var request = {
        from: options.rangeRaw.from,
        to: options.rangeRaw.to,
        queries: queries
      };

      return this.performTimeSeriesQuery(request);
    };

    this.getPeriod = function(target, options, now) {
      var start = this.convertToCloudWatchTime(options.range.from, false);
      var end = this.convertToCloudWatchTime(options.range.to, true);
      now = Math.round((now || Date.now()) / 1000);

      var period;
      var range = end - start;

      var hourSec = 60 * 60;
      var daySec = hourSec * 24;
      var periodUnit = 60;
      if (!target.period) {
        if (now - start <= (daySec * 15)) { // until 15 days ago
          if (target.namespace === 'AWS/EC2') {
            periodUnit = period = 300;
          } else {
            periodUnit = period = 60;
          }
        } else if (now - start <= (daySec * 63)) { // until 63 days ago
          periodUnit = period = 60 * 5;
        } else if (now - start <= (daySec * 455)) { // until 455 days ago
          periodUnit = period = 60 * 60;
        } else { // over 455 days, should return error, but try to long period
          periodUnit = period = 60 * 60;
        }
      } else {
        if (/^\d+$/.test(target.period)) {
          period = parseInt(target.period, 10);
        } else {
          period = kbn.interval_to_seconds(templateSrv.replace(target.period, options.scopedVars));
        }
      }
      if (period < 1) {
        period = 1;
      }
      if (range / period >= 1440) {
        period = Math.ceil(range / 1440 / periodUnit) * periodUnit;
      }

      return period;
    };

    this.performTimeSeriesQuery = function(request) {
      return backendSrv.post('/api/tsdb/query', request).then(function (res) {
        var data = [];

        if (res.results) {
          _.forEach(res.results, function (queryRes) {
            _.forEach(queryRes.series, function (series) {
              data.push({target: series.name, datapoints: series.points});
            });
          });
        }

        return {data: data};
      });
    };

    function transformSuggestDataFromTable(suggestData) {
      return _.map(suggestData.results['metricFindQuery'].tables[0].rows, function (v) {
        return {
          text: v[0],
          value: v[1]
        };
      });
    }

    this.getRegions = function () {
      var range = timeSrv.timeRange();
      return backendSrv.post('/api/tsdb/query', {
        from: range.from,
        to: range.to,
        queries: [
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: 'regions'
          }
        ]
      }).then(function (r) { return transformSuggestDataFromTable(r); });
    };

    this.getNamespaces = function() {
      var range = timeSrv.timeRange();
      return backendSrv.post('/api/tsdb/query', {
        from: range.from,
        to: range.to,
        queries: [
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: 'namespaces'
          }
        ]
      }).then(function (r) { return transformSuggestDataFromTable(r); });
    };

    this.getMetrics = function (namespace, region) {
      var range = timeSrv.timeRange();
      return backendSrv.post('/api/tsdb/query', {
        from: range.from,
        to: range.to,
        queries: [
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: 'metrics',
            parameters: {
              region: region,
              namespace: templateSrv.replace(namespace)
            }
          }
        ]
      }).then(function (r) { return transformSuggestDataFromTable(r); });
    };

    this.getDimensionKeys = function(namespace, region) {
      var range = timeSrv.timeRange();
      return backendSrv.post('/api/tsdb/query', {
        from: range.from,
        to: range.to,
        queries: [
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: 'dimension_keys',
            parameters: {
              region: region,
              namespace: templateSrv.replace(namespace)
            }
          }
        ]
      }).then(function (r) { return transformSuggestDataFromTable(r); });
    };

    this.getDimensionValues = function(region, namespace, metricName, dimensionKey, filterDimensions) {
      var range = timeSrv.timeRange();
      return backendSrv.post('/api/tsdb/query', {
        from: range.from,
        to: range.to,
        queries: [
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: 'dimension_values',
            parameters: {
              region: region,
              namespace: templateSrv.replace(namespace),
              metricName: templateSrv.replace(metricName),
              dimensionKey: templateSrv.replace(dimensionKey),
              dimensions: this.convertDimensionFormat(filterDimensions, {}),
            }
          }
        ]
      }).then(function (r) { return transformSuggestDataFromTable(r); });
    };

    this.getEbsVolumeIds = function(region, instanceId) {
      var range = timeSrv.timeRange();
      return backendSrv.post('/api/tsdb/query', {
        from: range.from,
        to: range.to,
        queries: [
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: 'ebs_volume_ids',
            parameters: {
              region: region,
              instanceId: instanceId
            }
          }
        ]
      }).then(function (r) { return transformSuggestDataFromTable(r); });
    };

    this.getEc2InstanceAttribute = function(region, attributeName, filters) {
      var range = timeSrv.timeRange();
      return backendSrv.post('/api/tsdb/query', {
        from: range.from,
        to: range.to,
        queries: [
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: 'ec2_instance_attribute',
            parameters: {
              region: region,
              attributeName: attributeName,
              filters: filters
            }
          }
        ]
      }).then(function (r) { return transformSuggestDataFromTable(r); });
    };

    this.metricFindQuery = function(query) {
      var region;
      var namespace;
      var metricName;

      var regionQuery = query.match(/^regions\(\)/);
      if (regionQuery) {
        return this.getRegions();
      }

      var namespaceQuery = query.match(/^namespaces\(\)/);
      if (namespaceQuery) {
        return this.getNamespaces();
      }

      var metricNameQuery = query.match(/^metrics\(([^\)]+?)(,\s?([^,]+?))?\)/);
      if (metricNameQuery) {
        return this.getMetrics(templateSrv.replace(metricNameQuery[1]), templateSrv.replace(metricNameQuery[3]));
      }

      var dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
      if (dimensionKeysQuery) {
        return this.getDimensionKeys(templateSrv.replace(dimensionKeysQuery[1]), templateSrv.replace(dimensionKeysQuery[3]));
      }

      var dimensionValuesQuery = query.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/);
      if (dimensionValuesQuery) {
        region = templateSrv.replace(dimensionValuesQuery[1]);
        namespace = templateSrv.replace(dimensionValuesQuery[2]);
        metricName = templateSrv.replace(dimensionValuesQuery[3]);
        var dimensionKey = templateSrv.replace(dimensionValuesQuery[4]);

        return this.getDimensionValues(region, namespace, metricName, dimensionKey, {});
      }

      var ebsVolumeIdsQuery = query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
      if (ebsVolumeIdsQuery) {
        region = templateSrv.replace(ebsVolumeIdsQuery[1]);
        var instanceId = templateSrv.replace(ebsVolumeIdsQuery[2]);
        return this.getEbsVolumeIds(region, instanceId);
      }

      var ec2InstanceAttributeQuery = query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
      if (ec2InstanceAttributeQuery) {
        region = templateSrv.replace(ec2InstanceAttributeQuery[1]);
        var targetAttributeName = templateSrv.replace(ec2InstanceAttributeQuery[2]);
        var filterJson = JSON.parse(templateSrv.replace(ec2InstanceAttributeQuery[3]));
        return this.getEc2InstanceAttribute(region, targetAttributeName, filterJson);
      }

      return $q.when([]);
    };

    this.performDescribeAlarms = function(region, actionPrefix, alarmNamePrefix, alarmNames, stateValue) {
      return this.awsRequest({
        region: region,
        action: 'DescribeAlarms',
        parameters: { actionPrefix: actionPrefix, alarmNamePrefix: alarmNamePrefix, alarmNames: alarmNames, stateValue: stateValue }
      });
    };

    this.performDescribeAlarmsForMetric = function(region, namespace, metricName, dimensions, statistic, period) {
      var s = _.includes(self.standardStatistics, statistic) ? statistic : '';
      var es = _.includes(self.standardStatistics, statistic) ? '' : statistic;
      return this.awsRequest({
        region: region,
        action: 'DescribeAlarmsForMetric',
        parameters: {
          namespace: namespace,
          metricName: metricName,
          dimensions: dimensions,
          statistic: s,
          extendedStatistic: es,
          period: period
        }
      });
    };

    this.performDescribeAlarmHistory = function(region, alarmName, startDate, endDate) {
      return this.awsRequest({
        region: region,
        action: 'DescribeAlarmHistory',
        parameters: { alarmName: alarmName, startDate: startDate, endDate: endDate }
      });
    };

    this.annotationQuery = function(options) {
      var annotationQuery = new CloudWatchAnnotationQuery(this, options.annotation, $q, templateSrv);
      return annotationQuery.process(options.range.from, options.range.to);
    };

    this.testDatasource = function() {
      /* use billing metrics for test */
      var region = this.defaultRegion;
      var namespace = 'AWS/Billing';
      var metricName = 'EstimatedCharges';
      var dimensions = {};

      return this.getDimensionValues(region, namespace, metricName, 'ServiceName', dimensions).then(function () {
        return { status: 'success', message: 'Data source is working' };
      });
    };

    this.awsRequest = function(data) {
      var options = {
        method: 'POST',
        url: this.proxyUrl,
        data: data
      };

      return backendSrv.datasourceRequest(options).then(function(result) {
        return result.data;
      });
    };

    this.getDefaultRegion = function() {
      return this.defaultRegion;
    };

    this.getExpandedVariables = function(target, dimensionKey, variable, templateSrv) {
      /* if the all checkbox is marked we should add all values to the targets */
      var allSelected = _.find(variable.options, {'selected': true, 'text': 'All'});
      return _.chain(variable.options)
      .filter(function(v) {
        if (allSelected) {
          return v.text !== 'All';
        } else {
          return v.selected;
        }
      })
      .map(function(v) {
        var t = angular.copy(target);
        var scopedVar = {};
        scopedVar[variable.name] = v;
        t.dimensions[dimensionKey] = templateSrv.replace(t.dimensions[dimensionKey], scopedVar);
        return t;
      }).value();
    };

    this.expandTemplateVariable = function(targets, scopedVars, templateSrv) {
      var self = this;
      return _.chain(targets)
      .map(function(target) {
        var dimensionKey = _.findKey(target.dimensions, function(v) {
          return templateSrv.variableExists(v) && !_.has(scopedVars, templateSrv.getVariableName(v));
        });

        if (dimensionKey) {
          var multiVariable = _.find(templateSrv.variables, function(variable) {
            return templatingVariable.containsVariable(target.dimensions[dimensionKey], variable.name) && variable.multi;
          });
          var variable = _.find(templateSrv.variables, function(variable) {
            return templatingVariable.containsVariable(target.dimensions[dimensionKey], variable.name);
          });
          return self.getExpandedVariables(target, dimensionKey, multiVariable || variable, templateSrv);
        } else {
          return [target];
        }
      }).flatten().value();
    };

    this.convertToCloudWatchTime = function(date, roundUp) {
      if (_.isString(date)) {
        date = dateMath.parse(date, roundUp);
      }
      return Math.round(date.valueOf() / 1000);
    };

    this.convertDimensionFormat = function(dimensions, scopedVars) {
      return _.map(dimensions, function(value, key) {
        return {
          Name: templateSrv.replace(key, scopedVars),
          Value: templateSrv.replace(value, scopedVars)
        };
      });
    };

  }

  return CloudWatchDatasource;
});
