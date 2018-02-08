import angular from 'angular';
import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';
import kbn from 'app/core/utils/kbn';
import * as templatingVariable from 'app/features/templating/variable';
// import * as moment from 'moment';

export default class CloudWatchDatasource {
  type: any;
  name: any;
  supportMetrics: any;
  proxyUrl: any;
  defaultRegion: any;
  instanceSettings: any;
  standardStatistics: any;
  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv, private timeSrv) {
    this.type = 'cloudwatch';
    this.name = instanceSettings.name;
    this.supportMetrics = true;
    this.proxyUrl = instanceSettings.url;
    this.defaultRegion = instanceSettings.jsonData.defaultRegion;
    this.instanceSettings = instanceSettings;
    this.standardStatistics = ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'];
  }

  query(options) {
    options = angular.copy(options);
    options.targets = this.expandTemplateVariable(options.targets, options.scopedVars, this.templateSrv);

    var queries = _.filter(options.targets, item => {
      return (
        item.hide !== true && !!item.region && !!item.namespace && !!item.metricName && !_.isEmpty(item.statistics)
      );
    }).map(item => {
      item.region = this.templateSrv.replace(this.getActualRegion(item.region), options.scopedVars);
      item.namespace = this.templateSrv.replace(item.namespace, options.scopedVars);
      item.metricName = this.templateSrv.replace(item.metricName, options.scopedVars);
      item.dimensions = this.convertDimensionFormat(item.dimensions, options.scopedVars);
      item.period = String(this.getPeriod(item, options)); // use string format for period in graph query, and alerting

      return _.extend(
        {
          refId: item.refId,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: this.instanceSettings.id,
          type: 'timeSeriesQuery',
        },
        item
      );
    });

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      var d = this.$q.defer();
      d.resolve({ data: [] });
      return d.promise;
    }

    var request = {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: queries,
    };

    return this.performTimeSeriesQuery(request);
  }

  getPeriod(target, options, now?) {
    var start = this.convertToCloudWatchTime(options.range.from, false);
    var end = this.convertToCloudWatchTime(options.range.to, true);
    now = Math.round((now || Date.now()) / 1000);

    var period;
    var range = end - start;

    var hourSec = 60 * 60;
    var daySec = hourSec * 24;
    var periodUnit = 60;
    if (!target.period) {
      if (now - start <= daySec * 15) {
        // until 15 days ago
        if (target.namespace === 'AWS/EC2') {
          periodUnit = period = 300;
        } else {
          periodUnit = period = 60;
        }
      } else if (now - start <= daySec * 63) {
        // until 63 days ago
        periodUnit = period = 60 * 5;
      } else if (now - start <= daySec * 455) {
        // until 455 days ago
        periodUnit = period = 60 * 60;
      } else {
        // over 455 days, should return error, but try to long period
        periodUnit = period = 60 * 60;
      }
    } else {
      if (/^\d+$/.test(target.period)) {
        period = parseInt(target.period, 10);
      } else {
        period = kbn.interval_to_seconds(this.templateSrv.replace(target.period, options.scopedVars));
      }
    }
    if (period < 1) {
      period = 1;
    }
    if (range / period >= 1440) {
      period = Math.ceil(range / 1440 / periodUnit) * periodUnit;
    }

    return period;
  }

  performTimeSeriesQuery(request) {
    return this.awsRequest('/api/tsdb/query', request).then(res => {
      var data = [];

      if (res.results) {
        _.forEach(res.results, queryRes => {
          _.forEach(queryRes.series, series => {
            data.push({ target: series.name, datapoints: series.points });
          });
        });
      }

      return { data: data };
    });
  }

  transformSuggestDataFromTable(suggestData) {
    return _.map(suggestData.results['metricFindQuery'].tables[0].rows, v => {
      return {
        text: v[0],
        value: v[1],
      };
    });
  }

  doMetricQueryRequest(subtype, parameters) {
    var range = this.timeSrv.timeRange();
    return this.awsRequest('/api/tsdb/query', {
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
      queries: [
        _.extend(
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'metricFindQuery',
            subtype: subtype,
          },
          parameters
        ),
      ],
    }).then(r => {
      return this.transformSuggestDataFromTable(r);
    });
  }

  getRegions() {
    return this.doMetricQueryRequest('regions', null);
  }

  getNamespaces() {
    return this.doMetricQueryRequest('namespaces', null);
  }

  getMetrics(namespace, region) {
    return this.doMetricQueryRequest('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  getDimensionKeys(namespace, region) {
    return this.doMetricQueryRequest('dimension_keys', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  getDimensionValues(region, namespace, metricName, dimensionKey, filterDimensions) {
    return this.doMetricQueryRequest('dimension_values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName),
      dimensionKey: this.templateSrv.replace(dimensionKey),
      dimensions: this.convertDimensionFormat(filterDimensions, {}),
    });
  }

  getEbsVolumeIds(region, instanceId) {
    return this.doMetricQueryRequest('ebs_volume_ids', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      instanceId: this.templateSrv.replace(instanceId),
    });
  }

  getEc2InstanceAttribute(region, attributeName, filters) {
    return this.doMetricQueryRequest('ec2_instance_attribute', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      attributeName: this.templateSrv.replace(attributeName),
      filters: filters,
    });
  }

  metricFindQuery(query) {
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
      var filterJson = JSON.parse(this.templateSrv.replace(ec2InstanceAttributeQuery[3]));
      return this.getEc2InstanceAttribute(region, targetAttributeName, filterJson);
    }

    return this.$q.when([]);
  }

  annotationQuery(options) {
    var annotation = options.annotation;
    var statistics = _.map(annotation.statistics, s => {
      return this.templateSrv.replace(s);
    });
    var defaultPeriod = annotation.prefixMatching ? '' : '300';
    var period = annotation.period || defaultPeriod;
    period = parseInt(period, 10);
    var parameters = {
      prefixMatching: annotation.prefixMatching,
      region: this.templateSrv.replace(this.getActualRegion(annotation.region)),
      namespace: this.templateSrv.replace(annotation.namespace),
      metricName: this.templateSrv.replace(annotation.metricName),
      dimensions: this.convertDimensionFormat(annotation.dimensions, {}),
      statistics: statistics,
      period: period,
      actionPrefix: annotation.actionPrefix || '',
      alarmNamePrefix: annotation.alarmNamePrefix || '',
    };

    return this.awsRequest('/api/tsdb/query', {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: [
        _.extend(
          {
            refId: 'annotationQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.instanceSettings.id,
            type: 'annotationQuery',
          },
          parameters
        ),
      ],
    }).then(r => {
      return _.map(r.results['annotationQuery'].tables[0].rows, v => {
        return {
          annotation: annotation,
          time: Date.parse(v[0]),
          title: v[1],
          tags: [v[2]],
          text: v[3],
        };
      });
    });
  }

  targetContainsTemplate(target) {
    return (
      this.templateSrv.variableExists(target.region) ||
      this.templateSrv.variableExists(target.namespace) ||
      this.templateSrv.variableExists(target.metricName) ||
      _.find(target.dimensions, (v, k) => {
        return this.templateSrv.variableExists(k) || this.templateSrv.variableExists(v);
      })
    );
  }

  testDatasource() {
    /* use billing metrics for test */
    var region = this.defaultRegion;
    var namespace = 'AWS/Billing';
    var metricName = 'EstimatedCharges';
    var dimensions = {};

    return this.getDimensionValues(region, namespace, metricName, 'ServiceName', dimensions).then(
      () => {
        return { status: 'success', message: 'Data source is working' };
      },
      err => {
        return { status: 'error', message: err.message };
      }
    );
  }

  awsRequest(url, data) {
    var options = {
      method: 'POST',
      url: url,
      data: data,
    };

    return this.backendSrv.datasourceRequest(options).then(result => {
      return result.data;
    });
  }

  getDefaultRegion() {
    return this.defaultRegion;
  }

  getActualRegion(region) {
    if (region === 'default' || _.isEmpty(region)) {
      return this.getDefaultRegion();
    }
    return region;
  }

  getExpandedVariables(target, dimensionKey, variable, templateSrv) {
    /* if the all checkbox is marked we should add all values to the targets */
    var allSelected = _.find(variable.options, { selected: true, text: 'All' });
    return _.chain(variable.options)
      .filter(v => {
        if (allSelected) {
          return v.text !== 'All';
        } else {
          return v.selected;
        }
      })
      .map(v => {
        var t = angular.copy(target);
        var scopedVar = {};
        scopedVar[variable.name] = v;
        t.refId = target.refId + '_' + v.value;
        t.dimensions[dimensionKey] = templateSrv.replace(t.dimensions[dimensionKey], scopedVar);
        return t;
      })
      .value();
  }

  expandTemplateVariable(targets, scopedVars, templateSrv) {
    return _.chain(targets)
      .map(target => {
        var dimensionKey = _.findKey(target.dimensions, v => {
          return templateSrv.variableExists(v) && !_.has(scopedVars, templateSrv.getVariableName(v));
        });

        if (dimensionKey) {
          var multiVariable = _.find(templateSrv.variables, variable => {
            return (
              templatingVariable.containsVariable(target.dimensions[dimensionKey], variable.name) && variable.multi
            );
          });
          var variable = _.find(templateSrv.variables, variable => {
            return templatingVariable.containsVariable(target.dimensions[dimensionKey], variable.name);
          });
          return this.getExpandedVariables(target, dimensionKey, multiVariable || variable, templateSrv);
        } else {
          return [target];
        }
      })
      .flatten()
      .value();
  }

  convertToCloudWatchTime(date, roundUp) {
    if (_.isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.round(date.valueOf() / 1000);
  }

  convertDimensionFormat(dimensions, scopedVars) {
    var convertedDimensions = {};
    _.each(dimensions, (value, key) => {
      convertedDimensions[this.templateSrv.replace(key, scopedVars)] = this.templateSrv.replace(value, scopedVars);
    });
    return convertedDimensions;
  }
}
