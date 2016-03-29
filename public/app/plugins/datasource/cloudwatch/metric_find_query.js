define([
  'lodash',
],
function (_) {
  'use strict';

  function CloudWatchMetricFindQuery(datasource, query, $q, templateSrv) {
    this.datasource = datasource;
    this.query = query;
    this.$q = $q;
    this.templateSrv = templateSrv;
  }

  CloudWatchMetricFindQuery.prototype.process = function() {
    var region;
    var namespace;
    var metricName;

    var regionQuery = this.query.match(/^regions\(\)/);
    var namespaceQuery = this.query.match(/^namespaces\(\)/);
    var metricNameQuery = this.query.match(/^metrics\(([^\)]+?)(,\s?([^,]+?))?\)/);
    var dimensionKeysQuery = this.query.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
    var dimensionValuesQuery = this.query.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/);
    var ebsVolumeIdsQuery = this.query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
    var ec2InstanceAttributeQuery = this.query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);

    if (regionQuery) {
      return this.regionQuery();
    }

    if (namespaceQuery) {
      return this.namespaceQuery();
    }

    if (metricNameQuery) {
      return this.metricNameQuery(metricNameQuery[1], metricNameQuery[3]);
    }

    if (dimensionKeysQuery) {
      return this.dimensionKeysQuery(dimensionKeysQuery[1], dimensionKeysQuery[3]);
    }

    if (dimensionValuesQuery) {
      region = this.templateSrv.replace(dimensionValuesQuery[1]);
      namespace = this.templateSrv.replace(dimensionValuesQuery[2]);
      metricName = this.templateSrv.replace(dimensionValuesQuery[3]);
      var dimensionKey = this.templateSrv.replace(dimensionValuesQuery[4]);

      return this.dimensionValuesQuery(region, namespace, metricName, dimensionKey, {});
    }

    if (ebsVolumeIdsQuery) {
      region = this.templateSrv.replace(ebsVolumeIdsQuery[1]);
      var instanceId = this.templateSrv.replace(ebsVolumeIdsQuery[2]);
      return this.ebsVolumeIdsQuery(region, instanceId);
    }

    if (ec2InstanceAttributeQuery) {
      region = this.templateSrv.replace(ec2InstanceAttributeQuery[1]);
      var targetAttributeName = this.templateSrv.replace(ec2InstanceAttributeQuery[2]);
      var filterJson = JSON.parse(this.templateSrv.replace(ec2InstanceAttributeQuery[3]));
      return this.ec2InstanceAttributeQuery(region, targetAttributeName, filterJson);
    }

    return this.$q.when([]);
  };

  CloudWatchMetricFindQuery.prototype.transformSuggestData = function(suggestData) {
    return _.map(suggestData, function(v) {
      return { text: v };
    });
  };

  CloudWatchMetricFindQuery.prototype.regionQuery = function() {
    return this.datasource.getRegions();
  };

  CloudWatchMetricFindQuery.prototype.namespaceQuery = function() {
    return this.datasource.getNamespaces();
  };

  CloudWatchMetricFindQuery.prototype.metricNameQuery = function(namespace, region) {
    return this.datasource.getMetrics(namespace, region);
  };

  CloudWatchMetricFindQuery.prototype.dimensionKeysQuery = function(namespace, region) {
    return this.datasource.getDimensionKeys(namespace, region);
  };

  CloudWatchMetricFindQuery.prototype.dimensionValuesQuery = function(region, namespace, metricName, dimensionKey, filterDimensions) {
    return this.datasource.getDimensionValues(region, namespace, metricName, dimensionKey, filterDimensions);
  };

  CloudWatchMetricFindQuery.prototype.ebsVolumeIdsQuery = function(region, instanceId) {
    var instanceIds = [
      instanceId
    ];

    var self = this;
    return this.datasource.performEC2DescribeInstances(region, [], instanceIds).then(function(result) {
      var volumeIds = _.map(result.Reservations[0].Instances[0].BlockDeviceMappings, function(mapping) {
        return mapping.Ebs.VolumeId;
      });

      return self.transformSuggestData(volumeIds);
    });
  };

  CloudWatchMetricFindQuery.prototype.ec2InstanceAttributeQuery = function(region, targetAttributeName, filterJson) {
    var filters = _.map(filterJson, function(values, name) {
      return {
        Name: name,
        Values: values
      };
    });

    var self = this;
    return this.datasource.performEC2DescribeInstances(region, filters, null).then(function(result) {
      var attributes = _.chain(result.Reservations)
      .map(function(reservations) {
        return _.pluck(reservations.Instances, targetAttributeName);
      })
      .flatten().uniq().sortBy().value();
      return self.transformSuggestData(attributes);
    });
  };

  return CloudWatchMetricFindQuery;
});
