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

      this.defaultRegion = datasource.jsonData.defaultRegion;
      this.credentials = {
        accessKeyId: datasource.jsonData.accessKeyId,
        secretAccessKey: datasource.jsonData.secretAccessKey
      };

      /* jshint -W101 */
      this.supportedRegion = [
        'us-east-1', 'us-west-2', 'us-west-1', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'sa-east-1'
      ];

      this.supportedMetrics = {
        'AWS/AutoScaling': [
          'GroupMinSize', 'GroupMaxSize', 'GroupDesiredCapacity', 'GroupInServiceInstances', 'GroupPendingInstances', 'GroupStandbyInstances', 'GroupTerminatingInstances', 'GroupTotalInstances'
        ],
        'AWS/Billing': [
          'EstimatedCharges'
        ],
        'AWS/CloudFront': [
          'Requests', 'BytesDownloaded', 'BytesUploaded', 'TotalErrorRate', '4xxErrorRate', '5xxErrorRate'
        ],
        'AWS/CloudSearch': [
          'SuccessfulRequests', 'SearchableDocuments', 'IndexUtilization', 'Partitions'
        ],
        'AWS/DynamoDB': [
          'ConditionalCheckFailedRequests', 'ConsumedReadCapacityUnits', 'ConsumedWriteCapacityUnits', 'OnlineIndexConsumedWriteCapacity', 'OnlineIndexPercentageProgress', 'OnlineIndexThrottleEvents', 'ProvisionedReadCapacityUnits', 'ProvisionedWriteCapacityUnits', 'ReadThrottleEvents', 'ReturnedItemCount', 'SuccessfulRequestLatency', 'SystemErrors', 'ThrottledRequests', 'UserErrors', 'WriteThrottleEvents'
        ],
        'AWS/ElastiCache': [
          'CPUUtilization', 'SwapUsage', 'FreeableMemory', 'NetworkBytesIn', 'NetworkBytesOut',
          'BytesUsedForCacheItems', 'BytesReadIntoMemcached', 'BytesWrittenOutFromMemcached', 'CasBadval', 'CasHits', 'CasMisses', 'CmdFlush', 'CmdGet', 'CmdSet', 'CurrConnections', 'CurrItems', 'DecrHits', 'DecrMisses', 'DeleteHits', 'DeleteMisses', 'Evictions', 'GetHits', 'GetMisses', 'IncrHits', 'IncrMisses', 'Reclaimed',
          'CurrConnections', 'Evictions', 'Reclaimed', 'NewConnections', 'BytesUsedForCache', 'CacheHits', 'CacheMisses', 'ReplicationLag', 'GetTypeCmds', 'SetTypeCmds', 'KeyBasedCmds', 'StringBasedCmds', 'HashBasedCmds', 'ListBasedCmds', 'SetBasedCmds', 'SortedSetBasedCmds', 'CurrItems'
        ],
        'AWS/EBS': [
          'VolumeReadBytes', 'VolumeWriteBytes', 'VolumeReadOps', 'VolumeWriteOps', 'VolumeTotalReadTime', 'VolumeTotalWriteTime', 'VolumeIdleTime', 'VolumeQueueLength', 'VolumeThroughputPercentage', 'VolumeConsumedReadWriteOps'
        ],
        'AWS/EC2': [
          'CPUCreditUsage', 'CPUCreditBalance', 'CPUUtilization', 'DiskReadOps', 'DiskWriteOps', 'DiskReadBytes', 'DiskWriteBytes', 'NetworkIn', 'NetworkOut', 'StatusCheckFailed', 'StatusCheckFailed_Instance', 'StatusCheckFailed_System'
        ],
        'AWS/ELB': [
          'HealthyHostCount', 'UnHealthyHostCount', 'RequestCount', 'Latency', 'HTTPCode_ELB_4XX', 'HTTPCode_ELB_5XX', 'HTTPCode_Backend_2XX', 'HTTPCode_Backend_3XX', 'HTTPCode_Backend_4XX', 'HTTPCode_Backend_5XX', 'BackendConnectionErrors', 'SurgeQueueLength', 'SpilloverCount'
        ],
        'AWS/ElasticMapReduce': [
          'CoreNodesPending', 'CoreNodesRunning', 'HBaseBackupFailed', 'HBaseMostRecentBackupDuration', 'HBaseTimeSinceLastSuccessfulBackup', 'HDFSBytesRead', 'HDFSBytesWritten', 'HDFSUtilization', 'IsIdle', 'JobsFailed', 'JobsRunning', 'LiveDataNodes', 'LiveTaskTrackers', 'MapSlotsOpen', 'MissingBlocks', 'ReduceSlotsOpen', 'RemainingMapTasks', 'RemainingMapTasksPerSlot', 'RemainingReduceTasks', 'RunningMapTasks', 'RunningReduceTasks', 'S3BytesRead', 'S3BytesWritten', 'TaskNodesPending', 'TaskNodesRunning', 'TotalLoad'
        ],
        'AWS/Kinesis': [
          'PutRecord.Bytes', 'PutRecord.Latency', 'PutRecord.Success', 'PutRecords.Bytes', 'PutRecords.Latency', 'PutRecords.Records', 'PutRecords.Success', 'IncomingBytes', 'IncomingRecords', 'GetRecords.Bytes', 'GetRecords.IteratorAgeMilliseconds', 'GetRecords.Latency', 'GetRecords.Success'
        ],
        'AWS/ML': [
          'PredictCount', 'PredictFailureCount'
        ],
        'AWS/OpsWorks': [
          'cpu_idle', 'cpu_nice', 'cpu_system', 'cpu_user', 'cpu_waitio', 'load_1', 'load_5', 'load_15', 'memory_buffers', 'memory_cached', 'memory_free', 'memory_swap', 'memory_total', 'memory_used', 'procs'
        ],
        'AWS/Redshift': [
          'CPUUtilization', 'DatabaseConnections', 'HealthStatus', 'MaintenanceMode', 'NetworkReceiveThroughput', 'NetworkTransmitThroughput', 'PercentageDiskSpaceUsed', 'ReadIOPS', 'ReadLatency', 'ReadThroughput', 'WriteIOPS', 'WriteLatency', 'WriteThroughput'
        ],
        'AWS/RDS': [
          'BinLogDiskUsage', 'CPUUtilization', 'DatabaseConnections', 'DiskQueueDepth', 'FreeableMemory', 'FreeStorageSpace', 'ReplicaLag', 'SwapUsage', 'ReadIOPS', 'WriteIOPS', 'ReadLatency', 'WriteLatency', 'ReadThroughput', 'WriteThroughput', 'NetworkReceiveThroughput', 'NetworkTransmitThroughput'
        ],
        'AWS/Route53': [
          'HealthCheckStatus', 'HealthCheckPercentageHealthy'
        ],
        'AWS/SNS': [
          'NumberOfMessagesPublished', 'PublishSize', 'NumberOfNotificationsDelivered', 'NumberOfNotificationsFailed'
        ],
        'AWS/SQS': [
          'NumberOfMessagesSent', 'SentMessageSize', 'NumberOfMessagesReceived', 'NumberOfEmptyReceives', 'NumberOfMessagesDeleted', 'ApproximateNumberOfMessagesDelayed', 'ApproximateNumberOfMessagesVisible', 'ApproximateNumberOfMessagesNotVisible'
        ],
        'AWS/S3': [
          'BucketSizeBytes', 'NumberOfObjects'
        ],
        'AWS/SWF': [
          'DecisionTaskScheduleToStartTime', 'DecisionTaskStartToCloseTime', 'DecisionTasksCompleted', 'StartedDecisionTasksTimedOutOnClose', 'WorkflowStartToCloseTime', 'WorkflowsCanceled', 'WorkflowsCompleted', 'WorkflowsContinuedAsNew', 'WorkflowsFailed', 'WorkflowsTerminated', 'WorkflowsTimedOut'
        ],
        'AWS/StorageGateway': [
          'CacheHitPercent', 'CachePercentUsed', 'CachePercentDirty', 'CloudBytesDownloaded', 'CloudDownloadLatency', 'CloudBytesUploaded', 'UploadBufferFree', 'UploadBufferPercentUsed', 'UploadBufferUsed', 'QueuedWrites', 'ReadBytes', 'ReadTime', 'TotalCacheSize', 'WriteBytes', 'WriteTime', 'WorkingStorageFree', 'WorkingStoragePercentUsed', 'WorkingStorageUsed', 'CacheHitPercent', 'CachePercentUsed', 'CachePercentDirty', 'ReadBytes', 'ReadTime', 'WriteBytes', 'WriteTime', 'QueuedWrites'
        ],
        'AWS/WorkSpaces': [
          'Available', 'Unhealthy', 'ConnectionAttempt', 'ConnectionSuccess', 'ConnectionFailure', 'SessionLaunchTime', 'InSessionLatency', 'SessionDisconnect'
        ],
      };

      this.supportedDimensions = {
        'AWS/AutoScaling': [
          'AutoScalingGroupName'
        ],
        'AWS/Billing': [
          'ServiceName', 'LinkedAccount', 'Currency'
        ],
        'AWS/CloudFront': [
          'DistributionId', 'Region'
        ],
        'AWS/CloudSearch': [

        ],
        'AWS/DynamoDB': [
          'TableName', 'GlobalSecondaryIndexName', 'Operation'
        ],
        'AWS/ElastiCache': [
          'CacheClusterId', 'CacheNodeId'
        ],
        'AWS/EBS': [
          'VolumeId'
        ],
        'AWS/EC2': [
          'AutoScalingGroupName', 'ImageId', 'InstanceId', 'InstanceType'
        ],
        'AWS/ELB': [
          'LoadBalancerName', 'AvailabilityZone'
        ],
        'AWS/ElasticMapReduce': [
          'ClusterId', 'JobId'
        ],
        'AWS/Kinesis': [
          'StreamName'
        ],
        'AWS/ML': [
          'MLModelId', 'RequestMode'
        ],
        'AWS/OpsWorks': [
          'StackId', 'LayerId', 'InstanceId'
        ],
        'AWS/Redshift': [
          'NodeID', 'ClusterIdentifier'
        ],
        'AWS/RDS': [
          'DBInstanceIdentifier', 'DatabaseClass', 'EngineName'
        ],
        'AWS/Route53': [
          'HealthCheckId'
        ],
        'AWS/SNS': [
          'Application', 'Platform', 'TopicName'
        ],
        'AWS/SQS': [
          'QueueName'
        ],
        'AWS/S3': [
          'BucketName', 'StorageType'
        ],
        'AWS/SWF': [
          'Domain', 'ActivityTypeName', 'ActivityTypeVersion'
        ],
        'AWS/StorageGateway': [
          'GatewayId', 'GatewayName', 'VolumeId'
        ],
        'AWS/WorkSpaces': [
          'DirectoryId', 'WorkspaceId'
        ],
      };
      /* jshint +W101 */
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
        query.region = templateSrv.replace(target.region, options.scopedVars);
        query.namespace = templateSrv.replace(target.namespace, options.scopedVars);
        query.metricName = templateSrv.replace(target.metricName, options.scopedVars);
        query.dimensions = _.map(_.keys(target.dimensions), function(key) {
          return {
            Name: templateSrv.replace(key, options.scopedVars),
            Value: templateSrv.replace(target.dimensions[key], options.scopedVars)
          };
        });
        query.statistics = getActivatedStatistics(target.statistics);
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
      var cloudwatch = this.getCloudWatchClient(query.region);

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
      cloudwatch.getMetricStatistics(params, function(err, data) {
        if (err) {
          return d.reject(err);
        }
        return d.resolve(data);
      });

      return d.promise;
    };

    CloudWatchDatasource.prototype.performSuggestRegion = function() {
      return this.supportedRegion;
    };

    CloudWatchDatasource.prototype.performSuggestNamespace = function() {
      return _.keys(this.supportedMetrics);
    };

    CloudWatchDatasource.prototype.performSuggestMetrics = function(namespace) {
      namespace = templateSrv.replace(namespace);
      return this.supportedMetrics[namespace] || [];
    };

    CloudWatchDatasource.prototype.performSuggestDimensionKeys = function(namespace) {
      namespace = templateSrv.replace(namespace);
      return this.supportedDimensions[namespace] || [];
    };

    CloudWatchDatasource.prototype.performSuggestDimensionValues = function(region, namespace, metricName, dimensions) {
      region = templateSrv.replace(region);
      namespace = templateSrv.replace(namespace);
      metricName = templateSrv.replace(metricName);

      var cloudwatch = this.getCloudWatchClient(region);

      var params = {
        Namespace: namespace,
        MetricName: metricName
      };
      if (!_.isEmpty(dimensions)) {
        params.Dimensions = _.map(_.keys(dimensions), function(key) {
          return {
            Name: templateSrv.replace(key),
            Value: templateSrv.replace(dimensions[key])
          };
        });
      }

      var d = $q.defer();

      cloudwatch.listMetrics(params, function(err, data) {
        if (err) {
          return d.reject(err);
        }

        var suggestData = _.chain(data.Metrics)
        .map(function(metric) {
          return metric.Dimensions;
        })
        .value();

        return d.resolve(suggestData);
      });

      return d.promise;
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

      var d = $q.defer();

      var regionQuery = query.match(/^region\(\)/);
      if (regionQuery) {
        d.resolve(transformSuggestData(this.performSuggestRegion()));
        return d.promise;
      }

      var namespaceQuery = query.match(/^namespace\(\)/);
      if (namespaceQuery) {
        d.resolve(transformSuggestData(this.performSuggestNamespace()));
        return d.promise;
      }

      var metricNameQuery = query.match(/^metrics\(([^\)]+?)\)/);
      if (metricNameQuery) {
        namespace = templateSrv.replace(metricNameQuery[1]);
        d.resolve(transformSuggestData(this.performSuggestMetrics(namespace)));
        return d.promise;
      }

      var dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)\)/);
      if (dimensionKeysQuery) {
        namespace = templateSrv.replace(dimensionKeysQuery[1]);
        d.resolve(transformSuggestData(this.performSuggestDimensionKeys(namespace)));
        return d.promise;
      }

      var dimensionValuesQuery = query.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/);
      if (dimensionValuesQuery) {
        region = templateSrv.replace(dimensionValuesQuery[1]);
        namespace = templateSrv.replace(dimensionValuesQuery[2]);
        metricName = templateSrv.replace(dimensionValuesQuery[3]);
        var dimensions = {};

        return this.performSuggestDimensionValues(region, namespace, metricName, dimensions)
        .then(function(suggestData) {
          return _.map(suggestData, function(dimensions) {
            var result = _.chain(dimensions)
            .sortBy(function(dimension) {
              return dimension.Name;
            })
            .map(function(dimension) {
              return dimension.Name + '=' + dimension.Value;
            })
            .value().join(',');

            return { text: result };
          });
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

      return this.performSuggestDimensionValues(region, namespace, metricName, dimensions).then(function () {
        return { status: 'success', message: 'Data source is working', title: 'Success' };
      });
    };

    CloudWatchDatasource.prototype.getCloudWatchClient = function(region) {
      return new AWS.CloudWatch({
        region: region,
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey
      });
    };

    CloudWatchDatasource.prototype.getDefaultRegion = function() {
      return this.defaultRegion;
    };

    function transformMetricData(md, options) {
      var result = [];

      var dimensionPart = templateSrv.replace(JSON.stringify(options.dimensions));
      _.each(getActivatedStatistics(options.statistics), function(s) {
        var metricLabel = md.Label + '_' + s + dimensionPart;

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
      return kbn.parseDate(date);
    }

    return CloudWatchDatasource;
  });

});
