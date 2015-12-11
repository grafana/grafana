package cloudwatch

import (
	"encoding/json"
	"sort"

	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/util"
)

var metricsMap map[string][]string
var dimensionsMap map[string][]string

func init() {
	metricsMap = map[string][]string{
		"AWS/AutoScaling": {"GroupMinSize", "GroupMaxSize", "GroupDesiredCapacity", "GroupInServiceInstances", "GroupPendingInstances", "GroupStandbyInstances", "GroupTerminatingInstances", "GroupTotalInstances"},
		"AWS/Billing":     {"EstimatedCharges"},
		"AWS/CloudFront":  {"Requests", "BytesDownloaded", "BytesUploaded", "TotalErrorRate", "4xxErrorRate", "5xxErrorRate"},
		"AWS/CloudSearch": {"SuccessfulRequests", "SearchableDocuments", "IndexUtilization", "Partitions"},
		"AWS/DynamoDB":    {"ConditionalCheckFailedRequests", "ConsumedReadCapacityUnits", "ConsumedWriteCapacityUnits", "OnlineIndexConsumedWriteCapacity", "OnlineIndexPercentageProgress", "OnlineIndexThrottleEvents", "ProvisionedReadCapacityUnits", "ProvisionedWriteCapacityUnits", "ReadThrottleEvents", "ReturnedItemCount", "SuccessfulRequestLatency", "SystemErrors", "ThrottledRequests", "UserErrors", "WriteThrottleEvents"},
		"AWS/ECS":         {"CPUUtilization", "MemoryUtilization"},
		"AWS/ElastiCache": {
			"CPUUtilization", "FreeableMemory", "NetworkBytesIn", "NetworkBytesOut", "SwapUsage",
			"BytesUsedForCacheItems", "BytesReadIntoMemcached", "BytesWrittenOutFromMemcached", "CasBadval", "CasHits", "CasMisses", "CmdFlush", "CmdGet", "CmdSet", "CurrConnections", "CurrItems", "DecrHits", "DecrMisses", "DeleteHits", "DeleteMisses", "Evictions", "GetHits", "GetMisses", "IncrHits", "IncrMisses", "Reclaimed",
			"BytesUsedForHash", "CmdConfigGet", "CmdConfigSet", "CmdTouch", "CurrConfig", "EvictedUnfetched", "ExpiredUnfetched", "SlabsMoved", "TouchHits", "TouchMisses",
			"NewConnections", "NewItems", "UnusedMemory",
			"BytesUsedForCache", "CacheHits", "CacheMisses", "CurrConnections", "Evictions", "HyperLogLogBasedCmds", "NewConnections", "Reclaimed", "ReplicationBytes", "ReplicationLag", "SaveInProgress",
			"CurrItems", "GetTypeCmds", "HashBasedCmds", "KeyBasedCmds", "ListBasedCmds", "SetBasedCmds", "SetTypeCmds", "SortedSetBasedCmds", "StringBasedCmds",
		},
		"AWS/EBS": {"VolumeReadBytes", "VolumeWriteBytes", "VolumeReadOps", "VolumeWriteOps", "VolumeTotalReadTime", "VolumeTotalWriteTime", "VolumeIdleTime", "VolumeQueueLength", "VolumeThroughputPercentage", "VolumeConsumedReadWriteOps"},
		"AWS/EC2": {"CPUCreditUsage", "CPUCreditBalance", "CPUUtilization", "DiskReadOps", "DiskWriteOps", "DiskReadBytes", "DiskWriteBytes", "NetworkIn", "NetworkOut", "StatusCheckFailed", "StatusCheckFailed_Instance", "StatusCheckFailed_System"},
		"AWS/ELB": {"HealthyHostCount", "UnHealthyHostCount", "RequestCount", "Latency", "HTTPCode_ELB_4XX", "HTTPCode_ELB_5XX", "HTTPCode_Backend_2XX", "HTTPCode_Backend_3XX", "HTTPCode_Backend_4XX", "HTTPCode_Backend_5XX", "BackendConnectionErrors", "SurgeQueueLength", "SpilloverCount"},
		"AWS/ElasticMapReduce": {"IsIdle", "JobsRunning", "JobsFailed",
			"MapTasksRunning", "MapTasksRemaining", "MapSlotsOpen", "RemainingMapTasksPerSlot", "ReduceTasksRunning", "ReduceTasksRemaining", "ReduceSlotsOpen",
			"CoreNodesRunning", "CoreNodesPending", "LiveDataNodes", "TaskNodesRunning", "TaskNodesPending", "LiveTaskTrackers",
			"S3BytesWritten", "S3BytesRead", "HDFSUtilization", "HDFSBytesRead", "HDFSBytesWritten", "MissingBlocks", "TotalLoad",
			"BackupFailed", "MostRecentBackupDuration", "TimeSinceLastSuccessfulBackup",
			"IsIdle", "ContainerAllocated", "ContainerReserved", "ContainerPending", "AppsCompleted", "AppsFailed", "AppsKilled", "AppsPending", "AppsRunning", "AppsSubmitted",
			"CoreNodesRunning", "CoreNodesPending", "LiveDataNodes", "MRTotalNodes", "MRActiveNodes", "MRLostNodes", "MRUnhealthyNodes", "MRDecommissionedNodes", "MRRebootedNodes",
			"S3BytesWritten", "S3BytesRead", "HDFSUtilization", "HDFSBytesRead", "HDFSBytesWritten", "MissingBlocks", "CorruptBlocks", "TotalLoad", "MemoryTotalMB", "MemoryReservedMB", "MemoryAvailableMB", "MemoryAllocatedMB", "PendingDeletionBlocks", "UnderReplicatedBlocks", "DfsPendingReplicationBlocks", "CapacityRemainingGB",
			"HbaseBackupFailed", "MostRecentBackupDuration", "TimeSinceLastSuccessfulBackup"},
		"AWS/ES":       {"ClusterStatus.green", "ClusterStatus.yellow", "ClusterStatus.red", "Nodes", "SearchableDocuments", "DeletedDocuments", "CPUUtilization", "FreeStorageSpace", "JVMMemoryPressure", "AutomatedSnapshotFailure", "MasterCPUUtilization", "MasterFreeStorageSpace", "MasterJVMMemoryPressure", "ReadLatency", "WriteLatency", "ReadThroughput", "WriteThroughput", "DiskQueueLength", "ReadIOPS", "WriteIOPS"},
		"AWS/Kinesis":  {"PutRecord.Bytes", "PutRecord.Latency", "PutRecord.Success", "PutRecords.Bytes", "PutRecords.Latency", "PutRecords.Records", "PutRecords.Success", "IncomingBytes", "IncomingRecords", "GetRecords.Bytes", "GetRecords.IteratorAgeMilliseconds", "GetRecords.Latency", "GetRecords.Success"},
		"AWS/Lambda":   {"Invocations", "Errors", "Duration", "Throttles"},
		"AWS/ML":       {"PredictCount", "PredictFailureCount"},
		"AWS/OpsWorks": {"cpu_idle", "cpu_nice", "cpu_system", "cpu_user", "cpu_waitio", "load_1", "load_5", "load_15", "memory_buffers", "memory_cached", "memory_free", "memory_swap", "memory_total", "memory_used", "procs"},
		"AWS/Redshift": {"CPUUtilization", "DatabaseConnections", "HealthStatus", "MaintenanceMode", "NetworkReceiveThroughput", "NetworkTransmitThroughput", "PercentageDiskSpaceUsed", "ReadIOPS", "ReadLatency", "ReadThroughput", "WriteIOPS", "WriteLatency", "WriteThroughput"},
		"AWS/RDS":      {"BinLogDiskUsage", "CPUUtilization", "CPUCreditUsage", "CPUCreditBalance", "DatabaseConnections", "DiskQueueDepth", "FreeableMemory", "FreeStorageSpace", "ReplicaLag", "SwapUsage", "ReadIOPS", "WriteIOPS", "ReadLatency", "WriteLatency", "ReadThroughput", "WriteThroughput", "NetworkReceiveThroughput", "NetworkTransmitThroughput"},
		"AWS/Route53":  {"HealthCheckStatus", "HealthCheckPercentageHealthy"},
		"AWS/SNS":      {"NumberOfMessagesPublished", "PublishSize", "NumberOfNotificationsDelivered", "NumberOfNotificationsFailed"},
		"AWS/SQS":      {"NumberOfMessagesSent", "SentMessageSize", "NumberOfMessagesReceived", "NumberOfEmptyReceives", "NumberOfMessagesDeleted", "ApproximateNumberOfMessagesDelayed", "ApproximateNumberOfMessagesVisible", "ApproximateNumberOfMessagesNotVisible"},
		"AWS/S3":       {"BucketSizeBytes", "NumberOfObjects"},
		"AWS/SWF": {"DecisionTaskScheduleToStartTime", "DecisionTaskStartToCloseTime", "DecisionTasksCompleted", "StartedDecisionTasksTimedOutOnClose", "WorkflowStartToCloseTime", "WorkflowsCanceled", "WorkflowsCompleted", "WorkflowsContinuedAsNew", "WorkflowsFailed", "WorkflowsTerminated", "WorkflowsTimedOut",
			"ActivityTaskScheduleToCloseTime", "ActivityTaskScheduleToStartTime", "ActivityTaskStartToCloseTime", "ActivityTasksCanceled", "ActivityTasksCompleted", "ActivityTasksFailed", "ScheduledActivityTasksTimedOutOnClose", "ScheduledActivityTasksTimedOutOnStart", "StartedActivityTasksTimedOutOnClose", "StartedActivityTasksTimedOutOnHeartbeat"},
		"AWS/StorageGateway": {"CacheHitPercent", "CachePercentUsed", "CachePercentDirty", "CloudBytesDownloaded", "CloudDownloadLatency", "CloudBytesUploaded", "UploadBufferFree", "UploadBufferPercentUsed", "UploadBufferUsed", "QueuedWrites", "ReadBytes", "ReadTime", "TotalCacheSize", "WriteBytes", "WriteTime", "TimeSinceLastRecoveryPoint", "WorkingStorageFree", "WorkingStoragePercentUsed", "WorkingStorageUsed",
			"CacheHitPercent", "CachePercentUsed", "CachePercentDirty", "ReadBytes", "ReadTime", "WriteBytes", "WriteTime", "QueuedWrites"},
		"AWS/WAF":        {"AllowedRequests", "BlockedRequests", "CountedRequests"},
		"AWS/WorkSpaces": {"Available", "Unhealthy", "ConnectionAttempt", "ConnectionSuccess", "ConnectionFailure", "SessionLaunchTime", "InSessionLatency", "SessionDisconnect"},
	}
	dimensionsMap = map[string][]string{
		"AWS/AutoScaling":      {"AutoScalingGroupName"},
		"AWS/Billing":          {"ServiceName", "LinkedAccount", "Currency"},
		"AWS/CloudFront":       {"DistributionId", "Region"},
		"AWS/CloudSearch":      {},
		"AWS/DynamoDB":         {"TableName", "GlobalSecondaryIndexName", "Operation"},
		"AWS/ECS":              {"ClusterName", "ServiceName"},
		"AWS/ElastiCache":      {"CacheClusterId", "CacheNodeId"},
		"AWS/EBS":              {"VolumeId"},
		"AWS/EC2":              {"AutoScalingGroupName", "ImageId", "InstanceId", "InstanceType"},
		"AWS/ELB":              {"LoadBalancerName", "AvailabilityZone"},
		"AWS/ElasticMapReduce": {"ClusterId", "JobFlowId", "JobId"},
		"AWS/ES":               {},
		"AWS/Kinesis":          {"StreamName"},
		"AWS/Lambda":           {"FunctionName"},
		"AWS/ML":               {"MLModelId", "RequestMode"},
		"AWS/OpsWorks":         {"StackId", "LayerId", "InstanceId"},
		"AWS/Redshift":         {"NodeID", "ClusterIdentifier"},
		"AWS/RDS":              {"DBInstanceIdentifier", "DatabaseClass", "EngineName"},
		"AWS/Route53":          {"HealthCheckId"},
		"AWS/SNS":              {"Application", "Platform", "TopicName"},
		"AWS/SQS":              {"QueueName"},
		"AWS/S3":               {"BucketName", "StorageType"},
		"AWS/SWF":              {"Domain", "WorkflowTypeName", "WorkflowTypeVersion", "ActivityTypeName", "ActivityTypeVersion"},
		"AWS/StorageGateway":   {"GatewayId", "GatewayName", "VolumeId"},
		"AWS/WAF":              {"Rule", "WebACL"},
		"AWS/WorkSpaces":       {"DirectoryId", "WorkspaceId"},
	}
}

// Whenever this list is updated, frontend list should also be updated.
// Please update the region list in public/app/plugins/datasource/cloudwatch/partials/config.html
func handleGetRegions(req *cwRequest, c *middleware.Context) {
	regions := []string{
		"ap-northeast-1", "ap-southeast-1", "ap-southeast-2", "cn-north-1",
		"eu-central-1", "eu-west-1", "sa-east-1", "us-east-1", "us-west-1", "us-west-2",
	}

	result := []interface{}{}
	for _, region := range regions {
		result = append(result, util.DynMap{"text": region, "value": region})
	}

	c.JSON(200, result)
}

func handleGetNamespaces(req *cwRequest, c *middleware.Context) {
	keys := []string{}
	for key := range metricsMap {
		keys = append(keys, key)
	}
	sort.Sort(sort.StringSlice(keys))

	result := []interface{}{}
	for _, key := range keys {
		result = append(result, util.DynMap{"text": key, "value": key})
	}

	c.JSON(200, result)
}

func handleGetMetrics(req *cwRequest, c *middleware.Context) {
	reqParam := &struct {
		Parameters struct {
			Namespace string `json:"namespace"`
		} `json:"parameters"`
	}{}

	json.Unmarshal(req.Body, reqParam)

	namespaceMetrics, exists := metricsMap[reqParam.Parameters.Namespace]
	if !exists {
		c.JsonApiErr(404, "Unable to find namespace "+reqParam.Parameters.Namespace, nil)
		return
	}
	sort.Sort(sort.StringSlice(namespaceMetrics))

	result := []interface{}{}
	for _, name := range namespaceMetrics {
		result = append(result, util.DynMap{"text": name, "value": name})
	}

	c.JSON(200, result)
}

func handleGetDimensions(req *cwRequest, c *middleware.Context) {
	reqParam := &struct {
		Parameters struct {
			Namespace string `json:"namespace"`
		} `json:"parameters"`
	}{}

	json.Unmarshal(req.Body, reqParam)

	dimensionValues, exists := dimensionsMap[reqParam.Parameters.Namespace]
	if !exists {
		c.JsonApiErr(404, "Unable to find dimension "+reqParam.Parameters.Namespace, nil)
		return
	}
	sort.Sort(sort.StringSlice(dimensionValues))

	result := []interface{}{}
	for _, name := range dimensionValues {
		result = append(result, util.DynMap{"text": name, "value": name})
	}

	c.JSON(200, result)
}
