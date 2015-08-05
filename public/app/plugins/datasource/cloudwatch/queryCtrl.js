define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  /* jshint -W101 */
  var supportedMetrics = {
    "AWS/AutoScaling": [
      "GroupMinSize", "GroupMaxSize", "GroupDesiredCapacity", "GroupInServiceInstances", "GroupPendingInstances", "GroupStandbyInstances", "GroupTerminatingInstances", "GroupTotalInstances"
    ],
    "AWS/Billing": [
      "EstimatedCharges"
    ],
    "AWS/CloudFront": [
      "Requests", "BytesDownloaded", "BytesUploaded", "TotalErrorRate", "4xxErrorRate", "5xxErrorRate"
    ],
    "AWS/CloudSearch": [
      "SuccessfulRequests", "SearchableDocuments", "IndexUtilization", "Partitions"
    ],
    "AWS/DynamoDB": [
      "ConditionalCheckFailedRequests", "ConsumedReadCapacityUnits", "ConsumedWriteCapacityUnits", "OnlineIndexConsumedWriteCapacity", "OnlineIndexPercentageProgress", "OnlineIndexThrottleEvents", "ProvisionedReadCapacityUnits", "ProvisionedWriteCapacityUnits", "ReadThrottleEvents", "ReturnedItemCount", "SuccessfulRequestLatency", "SystemErrors", "ThrottledRequests", "UserErrors", "WriteThrottleEvents"
    ],
    "AWS/ElastiCache": [
      "CPUUtilization", "SwapUsage", "FreeableMemory", "NetworkBytesIn", "NetworkBytesOut",
      "BytesUsedForCacheItems", "BytesReadIntoMemcached", "BytesWrittenOutFromMemcached", "CasBadval", "CasHits", "CasMisses", "CmdFlush", "CmdGet", "CmdSet", "CurrConnections", "CurrItems", "DecrHits", "DecrMisses", "DeleteHits", "DeleteMisses", "Evictions", "GetHits", "GetMisses", "IncrHits", "IncrMisses", "Reclaimed",
      "CurrConnections", "Evictions", "Reclaimed", "NewConnections", "BytesUsedForCache", "CacheHits", "CacheMisses", "ReplicationLag", "GetTypeCmds", "SetTypeCmds", "KeyBasedCmds", "StringBasedCmds", "HashBasedCmds", "ListBasedCmds", "SetBasedCmds", "SortedSetBasedCmds", "CurrItems"
    ],
    "AWS/EBS": [
      "VolumeReadBytes", "VolumeWriteBytes", "VolumeReadOps", "VolumeWriteOps", "VolumeTotalReadTime", "VolumeTotalWriteTime", "VolumeIdleTime", "VolumeQueueLength", "VolumeThroughputPercentage", "VolumeConsumedReadWriteOps",
    ],
    "AWS/EC2": [
      "CPUCreditUsage", "CPUCreditBalance", "CPUUtilization", "DiskReadOps", "DiskWriteOps", "DiskReadBytes", "DiskWriteBytes", "NetworkIn", "NetworkOut", "StatusCheckFailed", "StatusCheckFailed_Instance", "StatusCheckFailed_System"
    ],
    "AWS/ELB": [
      "HealthyHostCount", "UnHealthyHostCount", "RequestCount", "Latency", "HTTPCode_ELB_4XX", "HTTPCode_ELB_5XX", "HTTPCode_Backend_2XX", "HTTPCode_Backend_3XX", "HTTPCode_Backend_4XX", "HTTPCode_Backend_5XX", "BackendConnectionErrors", "SurgeQueueLength", "SpilloverCount"
    ],
    "AWS/ElasticMapReduce": [
      "CoreNodesPending", "CoreNodesRunning", "HBaseBackupFailed", "HBaseMostRecentBackupDuration", "HBaseTimeSinceLastSuccessfulBackup", "HDFSBytesRead", "HDFSBytesWritten", "HDFSUtilization", "IsIdle", "JobsFailed", "JobsRunning", "LiveDataNodes", "LiveTaskTrackers", "MapSlotsOpen", "MissingBlocks", "ReduceSlotsOpen", "RemainingMapTasks", "RemainingMapTasksPerSlot", "RemainingReduceTasks", "RunningMapTasks", "RunningReduceTasks", "S3BytesRead", "S3BytesWritten", "TaskNodesPending", "TaskNodesRunning", "TotalLoad"
    ],
    "AWS/Kinesis": [
      "PutRecord.Bytes", "PutRecord.Latency", "PutRecord.Success", "PutRecords.Bytes", "PutRecords.Latency", "PutRecords.Records", "PutRecords.Success", "IncomingBytes", "IncomingRecords", "GetRecords.Bytes", "GetRecords.IteratorAgeMilliseconds", "GetRecords.Latency", "GetRecords.Success"
    ],
    "AWS/ML": [
      "PredictCount", "PredictFailureCount"
    ],
    "AWS/OpsWorks": [
      "cpu_idle", "cpu_nice", "cpu_system", "cpu_user", "cpu_waitio", "load_1", "load_5", "load_15", "memory_buffers", "memory_cached", "memory_free", "memory_swap", "memory_total", "memory_used", "procs"
    ],
    "AWS/Redshift": [
      "CPUUtilization", "DatabaseConnections", "HealthStatus", "MaintenanceMode", "NetworkReceiveThroughput", "NetworkTransmitThroughput", "PercentageDiskSpaceUsed", "ReadIOPS", "ReadLatency", "ReadThroughput", "WriteIOPS", "WriteLatency", "WriteThroughput"
    ],
    "AWS/RDS": [
      "BinLogDiskUsage", "CPUUtilization", "DatabaseConnections", "DiskQueueDepth", "FreeableMemory", "FreeStorageSpace", "ReplicaLag", "SwapUsage", "ReadIOPS", "WriteIOPS", "ReadLatency", "WriteLatency", "ReadThroughput", "WriteThroughput", "NetworkReceiveThroughput", "NetworkTransmitThroughput"
    ],
    "AWS/Route53": [
      "HealthCheckStatus", "HealthCheckPercentageHealthy"
    ],
    "AWS/SNS": [
      "NumberOfMessagesPublished", "PublishSize", "NumberOfNotificationsDelivered", "NumberOfNotificationsFailed"
    ],
    "AWS/SQS": [
      "NumberOfMessagesSent", "SentMessageSize", "NumberOfMessagesReceived", "NumberOfEmptyReceives", "NumberOfMessagesDeleted", "ApproximateNumberOfMessagesDelayed", "ApproximateNumberOfMessagesVisible", "ApproximateNumberOfMessagesNotVisible"
    ],
    "AWS/S3": [
      "BucketSizeBytes", "NumberOfObjects"
    ],
    "AWS/SWF": [
      "DecisionTaskScheduleToStartTime", "DecisionTaskStartToCloseTime", "DecisionTasksCompleted", "StartedDecisionTasksTimedOutOnClose", "WorkflowStartToCloseTime", "WorkflowsCanceled", "WorkflowsCompleted", "WorkflowsContinuedAsNew", "WorkflowsFailed", "WorkflowsTerminated", "WorkflowsTimedOut"
    ],
    "AWS/StorageGateway": [
      "CacheHitPercent", "CachePercentUsed", "CachePercentDirty", "CloudBytesDownloaded", "CloudDownloadLatency", "CloudBytesUploaded", "UploadBufferFree", "UploadBufferPercentUsed", "UploadBufferUsed", "QueuedWrites", "ReadBytes", "ReadTime", "TotalCacheSize", "WriteBytes", "WriteTime", "WorkingStorageFree", "WorkingStoragePercentUsed", "WorkingStorageUsed", "CacheHitPercent", "CachePercentUsed", "CachePercentDirty", "ReadBytes", "ReadTime", "WriteBytes", "WriteTime", "QueuedWrites"
    ],
    "AWS/WorkSpaces": [
      "Available", "Unhealthy", "ConnectionAttempt", "ConnectionSuccess", "ConnectionFailure", "SessionLaunchTime", "InSessionLatency", "SessionDisconnect"
    ],
  };
  /* jshint +W101 */

  var supportedDimensions = {
    "AWS/AutoScaling": [
      "AutoScalingGroupName"
    ],
    "AWS/Billing": [
      "ServiceName", "LinkedAccount", "Currency"
    ],
    "AWS/CloudFront": [
      "DistributionId", "Region"
    ],
    "AWS/CloudSearch": [

    ],
    "AWS/DynamoDB": [
      "TableName", "GlobalSecondaryIndexName", "Operation"
    ],
    "AWS/ElastiCache": [
      "CacheClusterId", "CacheNodeId"
    ],
    "AWS/EBS": [
      "VolumeId"
    ],
    "AWS/EC2": [
      "AutoScalingGroupName", "ImageId", "InstanceId", "InstanceType"
    ],
    "AWS/ELB": [
      "LoadBalancerName", "AvailabilityZone"
    ],
    "AWS/ElasticMapReduce": [
      "ClusterId", "JobId"
    ],
    "AWS/Kinesis": [
      "StreamName"
    ],
    "AWS/ML": [
      "MLModelId", "RequestMode"
    ],
    "AWS/OpsWorks": [
      "StackId", "LayerId", "InstanceId"
    ],
    "AWS/Redshift": [
      "NodeID", "ClusterIdentifier"
    ],
    "AWS/RDS": [
      "DBInstanceIdentifier", "DatabaseClass", "EngineName"
    ],
    "AWS/Route53": [
      "HealthCheckId"
    ],
    "AWS/SNS": [
      "Application", "Platform", "TopicName"
    ],
    "AWS/SQS": [
      "QueueName"
    ],
    "AWS/S3": [
      "BucketName", "StorageType"
    ],
    "AWS/SWF": [
      "Domain", "ActivityTypeName", "ActivityTypeVersion"
    ],
    "AWS/StorageGateway": [
      "GatewayId", "GatewayName", "VolumeId"
    ],
    "AWS/WorkSpaces": [
      "DirectoryId", "WorkspaceId"
    ],
  };

  module.controller('CloudWatchQueryCtrl', function($scope) {

    $scope.init = function() {
      $scope.target.namespace = $scope.target.namespace || '';
      $scope.target.metricName = $scope.target.metricName || '';
      $scope.target.dimensions = $scope.target.dimensions || {};
      $scope.target.statistics = $scope.target.statistics || {};
      $scope.target.period = $scope.target.period || 60;

      $scope.target.errors = validateTarget();
    };

    $scope.refreshMetricData = function() {
      $scope.target.errors = validateTarget($scope.target);

      // this does not work so good
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    $scope.moveMetricQuery = function(fromIndex, toIndex) {
      _.move($scope.panel.targets, fromIndex, toIndex);
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

    $scope.suggestNamespace = function(query, callback) { // jshint unused:false
      return _.keys(supportedMetrics);
    };

    $scope.suggestMetrics = function(query, callback) { // jshint unused:false
      return supportedMetrics[$scope.target.namespace] || [];
    };

    $scope.suggestDimensionKeys = function(query, callback) { // jshint unused:false
      return supportedDimensions[$scope.target.namespace] || [];
    };

    $scope.suggestDimensionValues = function(query, callback) {
      if (!$scope.target.namespace || !$scope.target.metricName) {
        return callback([]);
      }

      var params = {
        Namespace: $scope.target.namespace,
        MetricName: $scope.target.metricName
      };
      if (!_.isEmpty($scope.target.dimensions)) {
        params.Dimensions = $scope.target.dimensions;
      }

      $scope.datasource
        .performSuggestQuery(params)
        .then(function(result) {
          var suggestData = _.chain(result.Metrics)
          .map(function(metric) {
            return metric.Dimensions;
          })
          .flatten(true)
          .filter(function(dimension) {
            return dimension.Name === $scope.target.currentDimensionKey;
          })
          .map(function(metric) {
            return metric;
          })
          .pluck('Value')
          .uniq()
          .value();

          callback(suggestData);
        }, function() {
          callback([]);
        });
    };

    $scope.addDimension = function() {
      if (!$scope.addDimensionMode) {
        $scope.addDimensionMode = true;
        return;
      }

      if (!$scope.target.dimensions) {
        $scope.target.dimensions = {};
      }

      $scope.target.dimensions[$scope.target.currentDimensionKey] = $scope.target.currentDimensionValue;
      $scope.target.currentDimensionKey = '';
      $scope.target.currentDimensionValue = '';
      $scope.refreshMetricData();

      $scope.addDimensionMode = false;
    };

    $scope.removeDimension = function(key) {
      delete $scope.target.dimensions[key];
      $scope.refreshMetricData();
    };

    $scope.statisticsOptionChanged = function() {
      $scope.refreshMetricData();
    };

    // TODO: validate target
    function validateTarget() {
      var errs = {};

      if ($scope.target.period < 60 || ($scope.target.period % 60) !== 0) {
        errs.period = 'Period must be at least 60 seconds and must be a multiple of 60';
      }

      return errs;
    }

  });

});
