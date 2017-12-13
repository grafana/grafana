define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/datemath',
  'app/core/utils/kbn',
  'app/features/templating/variable',
],
function (angular, _, moment, dateMath, kbn, templatingVariable) {
  'use strict';

  kbn = kbn.default;

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
        item.region = templateSrv.replace(self.getActualRegion(item.region), options.scopedVars);
        item.namespace = templateSrv.replace(item.namespace, options.scopedVars);
        item.metricName = templateSrv.replace(item.metricName, options.scopedVars);
        item.dimensions = self.convertDimensionFormat(item.dimensions, options.scopeVars);
        item.period = String(self.getPeriod(item, options)); // use string format for period in graph query, and alerting

        return _.extend({
          refId: item.refId,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: self.instanceSettings.id,
          type: 'timeSeriesQuery',
        }, item);
      });

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var request = {
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
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
      return this.awsRequest('/api/tsdb/query', request).then(function (res) {
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

    this.doMetricQueryRequest = function (subtype, parameters) {
      var range = timeSrv.timeRange();
      return this.awsRequest('/api/tsdb/query', {
        from: range.from.valueOf().toString(),
        to: range.to.valueOf().toString(),
        queries: [
          _.extend({
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: subtype
          }, parameters)
        ]
      }).then(function (r) { return transformSuggestDataFromTable(r); });
    };

    this.getRegions = function () {
      return this.doMetricQueryRequest('regions', null);
    };

    this.getNamespaces = function() {
      return this.doMetricQueryRequest('namespaces', null);
    };

    this.getMetrics = function (namespace, region) {
      return this.doMetricQueryRequest('metrics', {
        region: templateSrv.replace(this.getActualRegion(region)),
        namespace: templateSrv.replace(namespace)
      });
    };

    this.getDimensionKeys = function(namespace, region) {
      return this.doMetricQueryRequest('dimension_keys', {
        region: templateSrv.replace(this.getActualRegion(region)),
        namespace: templateSrv.replace(namespace)
      });
    };

    this.getDimensionValues = function(region, namespace, metricName, dimensionKey, filterDimensions) {
      return this.doMetricQueryRequest('dimension_values', {
        region: templateSrv.replace(this.getActualRegion(region)),
        namespace: templateSrv.replace(namespace),
        metricName: templateSrv.replace(metricName),
        dimensionKey: templateSrv.replace(dimensionKey),
        dimensions: this.convertDimensionFormat(filterDimensions, {}),
      });
    };

    this.getEbsVolumeIds = function(region, instanceId) {
      return this.doMetricQueryRequest('ebs_volume_ids', {
        region: templateSrv.replace(this.getActualRegion(region)),
        instanceId: templateSrv.replace(instanceId)
      });
    };

    this.getEc2InstanceAttribute = function(region, attributeName, filters) {
      return this.doMetricQueryRequest('ec2_instance_attribute', {
        region: templateSrv.replace(this.getActualRegion(region)),
        attributeName: templateSrv.replace(attributeName),
        filters: filters
      });
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
        namespace = metricNameQuery[1];
        region = metricNameQuery[3];
        return this.getMetrics(namespace, region);
      }

      var dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
      if (dimensionKeysQuery) {
        namespace = dimensionKeysQuery[1];
        region = dimensionKeysQuery[3];
        return this.getDimensionKeys(namespace, region);
      }

      var dimensionValuesQuery = query.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/);
      if (dimensionValuesQuery) {
        region = dimensionValuesQuery[1];
        namespace = dimensionValuesQuery[2];
        metricName = dimensionValuesQuery[3];
        var dimensionKey = dimensionValuesQuery[4];

        return this.getDimensionValues(region, namespace, metricName, dimensionKey, {});
      }

      var ebsVolumeIdsQuery = query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
      if (ebsVolumeIdsQuery) {
        region = ebsVolumeIdsQuery[1];
        var instanceId = ebsVolumeIdsQuery[2];
        return this.getEbsVolumeIds(region, instanceId);
      }

      var ec2InstanceAttributeQuery = query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
      if (ec2InstanceAttributeQuery) {
        region = ec2InstanceAttributeQuery[1];
        var targetAttributeName = ec2InstanceAttributeQuery[2];
        var filterJson = JSON.parse(templateSrv.replace(ec2InstanceAttributeQuery[3]));
        return this.getEc2InstanceAttribute(region, targetAttributeName, filterJson);
      }

      return $q.when([]);
    };

    this.annotationQuery = function (options) {
      var annotation = options.annotation;
      var statistics = _.map(annotation.statistics, function (s) { return templateSrv.replace(s); });
      var defaultPeriod = annotation.prefixMatching ? '' : '300';
      var period = annotation.period || defaultPeriod;
      period = parseInt(period, 10);
      var parameters = {
        prefixMatching: annotation.prefixMatching,
        region: templateSrv.replace(this.getActualRegion(annotation.region)),
        namespace: templateSrv.replace(annotation.namespace),
        metricName: templateSrv.replace(annotation.metricName),
        dimensions: this.convertDimensionFormat(annotation.dimensions, {}),
        statistics: statistics,
        period: period,
        actionPrefix: annotation.actionPrefix || '',
        alarmNamePrefix: annotation.alarmNamePrefix || ''
      };

      return this.awsRequest('/api/tsdb/query', {
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries: [
          _.extend({
            refId: 'annotationQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'annotationQuery'
          }, parameters)
        ]
      }).then(function (r) {
        return _.map(r.results['annotationQuery'].tables[0].rows, function (v) {
          return {
            annotation: annotation,
            time: Date.parse(v[0]),
            title: v[1],
            tags: [v[2]],
            text: v[3]
          };
        });
      });
    };

    this.targetContainsTemplate = function(target) {
      return templateSrv.variableExists(target.region) ||
      templateSrv.variableExists(target.namespace) ||
      templateSrv.variableExists(target.metricName) ||
      _.find(target.dimensions, function(v, k) {
        return templateSrv.variableExists(k) || templateSrv.variableExists(v);
      });
    };

    this.testDatasource = function() {
      /* use billing metrics for test */
      var region = this.defaultRegion;
      var namespace = 'AWS/Billing';
      var metricName = 'EstimatedCharges';
      var dimensions = {};

      return this.getDimensionValues(region, namespace, metricName, 'ServiceName', dimensions).then(function () {
        return { status: 'success', message: 'Data source is working' };
      }, function (err) {
        return { status: 'error', message: err.message };
      });
    };

    this.awsRequest = function(url, data) {
      var options = {
        method: 'POST',
        url: url,
        data: data
      };

      return backendSrv.datasourceRequest(options).then(function(result) {
        return result.data;
      });
    };

    this.getDefaultRegion = function() {
      return this.defaultRegion;
    };

    this.getActualRegion = function(region) {
      if (region === 'default' || _.isEmpty(region)) {
        return this.getDefaultRegion();
      }
      return region;
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
        t.refId = target.refId + '_' + v.value;
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
      var convertedDimensions = {};
      _.each(dimensions, function (value, key) {
        convertedDimensions[templateSrv.replace(key, scopedVars)] = templateSrv.replace(value, scopedVars);
      });
      return convertedDimensions;
    };

  }

  return CloudWatchDatasource;
});
