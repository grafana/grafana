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

    var transformSuggestData = function(suggestData) {
      return _.map(suggestData, function(v) {
        return { text: v };
      });
    };

    var regionQuery = this.query.match(/^regions\(\)/);
    if (regionQuery) {
      return this.datasource.getRegions();
    }

    var namespaceQuery = this.query.match(/^namespaces\(\)/);
    if (namespaceQuery) {
      return this.datasource.getNamespaces();
    }

    var metricNameQuery = this.query.match(/^metrics\(([^\)]+?)(,\s?([^,]+?))?\)/);
    if (metricNameQuery) {
      return this.datasource.getMetrics(metricNameQuery[1], metricNameQuery[3]);
    }

    var dimensionKeysQuery = this.query.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
    if (dimensionKeysQuery) {
      return this.datasource.getDimensionKeys(dimensionKeysQuery[1], dimensionKeysQuery[3]);
    }

    var dimensionValuesQuery = this.query.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/);
    if (dimensionValuesQuery) {
      region = this.templateSrv.replace(dimensionValuesQuery[1]);
      namespace = this.templateSrv.replace(dimensionValuesQuery[2]);
      metricName = this.templateSrv.replace(dimensionValuesQuery[3]);
      var dimensionKey = this.templateSrv.replace(dimensionValuesQuery[4]);

      return this.datasource.getDimensionValues(region, namespace, metricName, dimensionKey, {});
    }

    var ebsVolumeIdsQuery = this.query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
    if (ebsVolumeIdsQuery) {
      region = this.templateSrv.replace(ebsVolumeIdsQuery[1]);
      var instanceId = this.templateSrv.replace(ebsVolumeIdsQuery[2]);
      var instanceIds = [
        instanceId
      ];

      return this.datasource.performEC2DescribeInstances(region, [], instanceIds).then(function(result) {
        var volumeIds = _.map(result.Reservations[0].Instances[0].BlockDeviceMappings, function(mapping) {
          return mapping.Ebs.VolumeId;
        });

        return transformSuggestData(volumeIds);
      });
    }

    var ec2InstanceAttributeQuery = this.query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
    if (ec2InstanceAttributeQuery) {
      region = this.templateSrv.replace(ec2InstanceAttributeQuery[1]);
      var filterJson = JSON.parse(this.templateSrv.replace(ec2InstanceAttributeQuery[3]));
      var filters = _.map(filterJson, function(values, name) {
        return {
          Name: name,
          Values: values
        };
      });
      var targetAttributeName = this.templateSrv.replace(ec2InstanceAttributeQuery[2]);

      return this.datasource.performEC2DescribeInstances(region, filters, null).then(function(result) {
        var attributes = _.chain(result.Reservations)
        .map(function(reservations) {
          return _.pluck(reservations.Instances, targetAttributeName);
        })
        .flatten().uniq().sortBy().value();
        return transformSuggestData(attributes);
      });
    }

    return this.$q.when([]);
  };

  return CloudWatchMetricFindQuery;
});
