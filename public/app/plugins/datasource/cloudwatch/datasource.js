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
  function CloudWatchDatasource(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = 'cloudwatch';
    this.name = instanceSettings.name;
    this.supportMetrics = true;
    this.proxyUrl = instanceSettings.url;
    this.defaultRegion = instanceSettings.jsonData.defaultRegion;
    this.standardStatistics = [
      'Average',
      'Maximum',
      'Minimum',
      'Sum',
      'SampleCount'
    ];

    var self = this;
    this.query = function(options) {
      var start = self.convertToCloudWatchTime(options.range.from, false);
      var end = self.convertToCloudWatchTime(options.range.to, true);

      var queries = [];
      options = angular.copy(options);
      options.targets = this.expandTemplateVariable(options.targets, options.scopedVars, templateSrv);
      _.each(options.targets, function(target) {
        if (target.hide || !target.namespace || !target.metricName || _.isEmpty(target.statistics)) {
          return;
        }

        var query = {};
        query.region = templateSrv.replace(target.region, options.scopedVars);
        query.namespace = templateSrv.replace(target.namespace, options.scopedVars);
        query.metricName = templateSrv.replace(target.metricName, options.scopedVars);
        query.dimensions = self.convertDimensionFormat(target.dimensions, options.scopedVars);
        query.statistics = target.statistics;

        var now = Math.round(Date.now() / 1000);
        var period = this.getPeriod(target, query, options, start, end, now);
        target.period = period;
        query.period = period;

        queries.push(query);
      }.bind(this));

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var allQueryPromise = _.map(queries, function(query) {
        return this.performTimeSeriesQuery(query, start, end);
      }.bind(this));

      return $q.all(allQueryPromise).then(function(allResponse) {
        var result = [];

        _.each(allResponse, function(response, index) {
          var metrics = transformMetricData(response, options.targets[index], options.scopedVars);
          result = result.concat(metrics);
        });

        return {data: result};
      });
    };

    this.getPeriod = function(target, query, options, start, end, now) {
      var period;
      var range = end - start;

      var hourSec = 60 * 60;
      var daySec = hourSec * 24;
      var periodUnit = 60;
      if (!target.period) {
        if (now - start <= (daySec * 15)) { // until 15 days ago
          if (query.namespace === 'AWS/EC2') {
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

    this.performTimeSeriesQuery = function(query, start, end) {
      var statistics = _.filter(query.statistics, function(s) { return _.includes(self.standardStatistics, s); });
      var extendedStatistics = _.reject(query.statistics, function(s) { return _.includes(self.standardStatistics, s); });
      return this.awsRequest({
        region: query.region,
        action: 'GetMetricStatistics',
        parameters:  {
          namespace: query.namespace,
          metricName: query.metricName,
          dimensions: query.dimensions,
          statistics: statistics,
          extendedStatistics: extendedStatistics,
          startTime: start,
          endTime: end,
          period: query.period
        }
      });
    };

    this.getRegions = function() {
      return this.awsRequest({action: '__GetRegions'});
    };

    this.getNamespaces = function() {
      return this.awsRequest({action: '__GetNamespaces'});
    };

    this.getMetrics = function(namespace, region) {
      return this.awsRequest({
        action: '__GetMetrics',
        region: region,
        parameters: {
          namespace: templateSrv.replace(namespace)
        }
      });
    };

    this.getDimensionKeys = function(namespace, region) {
      return this.awsRequest({
        action: '__GetDimensions',
        region: region,
        parameters: {
          namespace: templateSrv.replace(namespace)
        }
      });
    };

    this.getDimensionValues = function(region, namespace, metricName, dimensionKey, filterDimensions) {
      var request = {
        region: templateSrv.replace(region),
        action: 'ListMetrics',
        parameters: {
          namespace: templateSrv.replace(namespace),
          metricName: templateSrv.replace(metricName),
          dimensions: this.convertDimensionFormat(filterDimensions, {}),
        }
      };

      return this.awsRequest(request).then(function(result) {
        return _.chain(result.Metrics)
        .map('Dimensions')
        .flatten()
        .filter(function(dimension) {
          return dimension !== null && dimension.Name === dimensionKey;
        })
        .map('Value')
        .uniq()
        .sortBy()
        .map(function(value) {
          return {value: value, text: value};
        }).value();
      });
    };

    this.performEC2DescribeInstances = function(region, filters, instanceIds) {
      return this.awsRequest({
        region: region,
        action: 'DescribeInstances',
        parameters: { filters: filters, instanceIds: instanceIds }
      });
    };

    this.metricFindQuery = function(query) {
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

      var ec2InstanceAttributeQuery = query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
      if (ec2InstanceAttributeQuery) {
        region = templateSrv.replace(ec2InstanceAttributeQuery[1]);
        var filterJson = JSON.parse(templateSrv.replace(ec2InstanceAttributeQuery[3]));
        var filters = _.map(filterJson, function(values, name) {
          return {
            Name: name,
            Values: values
          };
        });
        var targetAttributeName = templateSrv.replace(ec2InstanceAttributeQuery[2]);

        return this.performEC2DescribeInstances(region, filters, null).then(function(result) {
          var attributes = _.chain(result.Reservations)
          .map(function(reservations) {
            return _.map(reservations.Instances, function(instance) {
              var tags = {};
              _.each(instance.Tags, function(tag) {
                tags[tag.Key] = tag.Value;
              });
              instance.Tags = tags;
              return instance;
            });
          })
          .map(function(instances) {
            return _.map(instances, targetAttributeName);
          })
          .flatten().uniq().sortBy().value();
          return transformSuggestData(attributes);
        });
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

    function transformMetricData(md, options, scopedVars) {
      var aliasRegex = /\{\{(.+?)\}\}/g;
      var aliasPattern = options.alias || '{{metric}}_{{stat}}';
      var aliasData = {
        region: templateSrv.replace(options.region, scopedVars),
        namespace: templateSrv.replace(options.namespace, scopedVars),
        metric: templateSrv.replace(options.metricName, scopedVars),
      };

      var aliasDimensions = {};

      _.each(_.keys(options.dimensions), function(origKey) {
        var key = templateSrv.replace(origKey, scopedVars);
        var value = templateSrv.replace(options.dimensions[origKey], scopedVars);
        aliasDimensions[key] = value;
      });

      _.extend(aliasData, aliasDimensions);

      var periodMs = options.period * 1000;

      return _.map(options.statistics, function(stat) {
        var extended = !_.includes(self.standardStatistics, stat);
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
          if (!extended) {
            dps.push([dp[stat], timestamp]);
          } else {
            dps.push([dp.ExtendedStatistics[stat], timestamp]);
          }
        })
        .value();

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

  return {
    CloudWatchDatasource: CloudWatchDatasource
  };
});
