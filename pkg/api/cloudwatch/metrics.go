package cloudwatch

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/util"
)

var metricsMap map[string][]string
var dimensionsMap map[string][]string

func init() {
	metricsMap = map[string][]string{
		"AWS/AutoScaling": []string{"GroupMinSize", "GroupMaxSize", "GroupDesiredCapacity", "GroupInServiceInstances", "GroupPendingInstances", "GroupStandbyInstances", "GroupTerminatingInstances", "GroupTotalInstances"},
		"AWS/Billing":     []string{"EstimatedCharges"},
		"AWS/EC2":         []string{"CPUCreditUsage", "CPUCreditBalance", "CPUUtilization", "DiskReadOps", "DiskWriteOps", "DiskReadBytes", "DiskWriteBytes", "NetworkIn", "NetworkOut", "StatusCheckFailed", "StatusCheckFailed_Instance", "StatusCheckFailed_System"},
		"AWS/CloudFront":  []string{"Requests", "BytesDownloaded", "BytesUploaded", "TotalErrorRate", "4xxErrorRate", "5xxErrorRate"},
		"AWS/CloudSearch": []string{"SuccessfulRequests", "SearchableDocuments", "IndexUtilization", "Partitions"},
		"AWS/DynamoDB":    []string{"ConditionalCheckFailedRequests", "ConsumedReadCapacityUnits", "ConsumedWriteCapacityUnits", "OnlineIndexConsumedWriteCapacity", "OnlineIndexPercentageProgress", "OnlineIndexThrottleEvents", "ProvisionedReadCapacityUnits", "ProvisionedWriteCapacityUnits", "ReadThrottleEvents", "ReturnedItemCount", "SuccessfulRequestLatency", "SystemErrors", "ThrottledRequests", "UserErrors", "WriteThrottleEvents"},
		"AWS/ElastiCache": []string{
			"CPUUtilization", "SwapUsage", "FreeableMemory", "NetworkBytesIn", "NetworkBytesOut",
			"BytesUsedForCacheItems", "BytesReadIntoMemcached", "BytesWrittenOutFromMemcached", "CasBadval", "CasHits", "CasMisses", "CmdFlush", "CmdGet", "CmdSet", "CurrConnections", "CurrItems", "DecrHits", "DecrMisses", "DeleteHits", "DeleteMisses", "Evictions", "GetHits", "GetMisses", "IncrHits", "IncrMisses", "Reclaimed",
			"CurrConnections", "Evictions", "Reclaimed", "NewConnections", "BytesUsedForCache", "CacheHits", "CacheMisses", "ReplicationLag", "GetTypeCmds", "SetTypeCmds", "KeyBasedCmds", "StringBasedCmds", "HashBasedCmds", "ListBasedCmds", "SetBasedCmds", "SortedSetBasedCmds", "CurrItems",
		},
		"AWS/EBS":              []string{"VolumeReadBytes", "VolumeWriteBytes", "VolumeReadOps", "VolumeWriteOps", "VolumeTotalReadTime", "VolumeTotalWriteTime", "VolumeIdleTime", "VolumeQueueLength", "VolumeThroughputPercentage", "VolumeConsumedReadWriteOps"},
		"AWS/ELB":              []string{"HealthyHostCount", "UnHealthyHostCount", "RequestCount", "Latency", "HTTPCode_ELB_4XX", "HTTPCode_ELB_5XX", "HTTPCode_Backend_2XX", "HTTPCode_Backend_3XX", "HTTPCode_Backend_4XX", "HTTPCode_Backend_5XX", "BackendConnectionErrors", "SurgeQueueLength", "SpilloverCount"},
		"AWS/ElasticMapReduce": []string{"CoreNodesPending", "CoreNodesRunning", "HBaseBackupFailed", "HBaseMostRecentBackupDuration", "HBaseTimeSinceLastSuccessfulBackup", "HDFSBytesRead", "HDFSBytesWritten", "HDFSUtilization", "IsIdle", "JobsFailed", "JobsRunning", "LiveDataNodes", "LiveTaskTrackers", "MapSlotsOpen", "MissingBlocks", "ReduceSlotsOpen", "RemainingMapTasks", "RemainingMapTasksPerSlot", "RemainingReduceTasks", "RunningMapTasks", "RunningReduceTasks", "S3BytesRead", "S3BytesWritten", "TaskNodesPending", "TaskNodesRunning", "TotalLoad"},
		"AWS/Kinesis":          []string{"PutRecord.Bytes", "PutRecord.Latency", "PutRecord.Success", "PutRecords.Bytes", "PutRecords.Latency", "PutRecords.Records", "PutRecords.Success", "IncomingBytes", "IncomingRecords", "GetRecords.Bytes", "GetRecords.IteratorAgeMilliseconds", "GetRecords.Latency", "GetRecords.Success"},
		"AWS/ML":               []string{"PredictCount", "PredictFailureCount"},
		"AWS/OpsWorks":         []string{"cpu_idle", "cpu_nice", "cpu_system", "cpu_user", "cpu_waitio", "load_1", "load_5", "load_15", "memory_buffers", "memory_cached", "memory_free", "memory_swap", "memory_total", "memory_used", "procs"},
		"AWS/Redshift":         []string{"CPUUtilization", "DatabaseConnections", "HealthStatus", "MaintenanceMode", "NetworkReceiveThroughput", "NetworkTransmitThroughput", "PercentageDiskSpaceUsed", "ReadIOPS", "ReadLatency", "ReadThroughput", "WriteIOPS", "WriteLatency", "WriteThroughput"},
		"AWS/RDS":              []string{"BinLogDiskUsage", "CPUUtilization", "DatabaseConnections", "DiskQueueDepth", "FreeableMemory", "FreeStorageSpace", "ReplicaLag", "SwapUsage", "ReadIOPS", "WriteIOPS", "ReadLatency", "WriteLatency", "ReadThroughput", "WriteThroughput", "NetworkReceiveThroughput", "NetworkTransmitThroughput"},
		"AWS/Route53":          []string{"HealthCheckStatus", "HealthCheckPercentageHealthy"},
		"AWS/SNS":              []string{"NumberOfMessagesPublished", "PublishSize", "NumberOfNotificationsDelivered", "NumberOfNotificationsFailed"},
		"AWS/SQS":              []string{"NumberOfMessagesSent", "SentMessageSize", "NumberOfMessagesReceived", "NumberOfEmptyReceives", "NumberOfMessagesDeleted", "ApproximateNumberOfMessagesDelayed", "ApproximateNumberOfMessagesVisible", "ApproximateNumberOfMessagesNotVisible"},
		"AWS/S3":               []string{"BucketSizeBytes", "NumberOfObjects"},
		"AWS/SWF":              []string{"DecisionTaskScheduleToStartTime", "DecisionTaskStartToCloseTime", "DecisionTasksCompleted", "StartedDecisionTasksTimedOutOnClose", "WorkflowStartToCloseTime", "WorkflowsCanceled", "WorkflowsCompleted", "WorkflowsContinuedAsNew", "WorkflowsFailed", "WorkflowsTerminated", "WorkflowsTimedOut"},
		"AWS/StorageGateway":   []string{"CacheHitPercent", "CachePercentUsed", "CachePercentDirty", "CloudBytesDownloaded", "CloudDownloadLatency", "CloudBytesUploaded", "UploadBufferFree", "UploadBufferPercentUsed", "UploadBufferUsed", "QueuedWrites", "ReadBytes", "ReadTime", "TotalCacheSize", "WriteBytes", "WriteTime", "WorkingStorageFree", "WorkingStoragePercentUsed", "WorkingStorageUsed", "CacheHitPercent", "CachePercentUsed", "CachePercentDirty", "ReadBytes", "ReadTime", "WriteBytes", "WriteTime", "QueuedWrites"},
		"AWS/WorkSpaces":       []string{"Available", "Unhealthy", "ConnectionAttempt", "ConnectionSuccess", "ConnectionFailure", "SessionLaunchTime", "InSessionLatency", "SessionDisconnect"},
	}
	dimensionsMap = map[string][]string{
		"AWS/AutoScaling":      []string{"AutoScalingGroupName"},
		"AWS/Billing":          []string{"ServiceName", "LinkedAccount", "Currency"},
		"AWS/CloudFront":       []string{"DistributionId", "Region"},
		"AWS/CloudSearch":      []string{},
		"AWS/DynamoDB":         []string{"TableName", "GlobalSecondaryIndexName", "Operation"},
		"AWS/ElastiCache":      []string{"CacheClusterId", "CacheNodeId"},
		"AWS/EBS":              []string{"VolumeId"},
		"AWS/EC2":              []string{"AutoScalingGroupName", "ImageId", "InstanceId", "InstanceType"},
		"AWS/ELB":              []string{"LoadBalancerName", "AvailabilityZone"},
		"AWS/ElasticMapReduce": []string{"ClusterId", "JobId"},
		"AWS/Kinesis":          []string{"StreamName"},
		"AWS/ML":               []string{"MLModelId", "RequestMode"},
		"AWS/OpsWorks":         []string{"StackId", "LayerId", "InstanceId"},
		"AWS/Redshift":         []string{"NodeID", "ClusterIdentifier"},
		"AWS/RDS":              []string{"DBInstanceIdentifier", "DatabaseClass", "EngineName"},
		"AWS/Route53":          []string{"HealthCheckId"},
		"AWS/SNS":              []string{"Application", "Platform", "TopicName"},
		"AWS/SQS":              []string{"QueueName"},
		"AWS/S3":               []string{"BucketName", "StorageType"},
		"AWS/SWF":              []string{"Domain", "ActivityTypeName", "ActivityTypeVersion"},
		"AWS/StorageGateway":   []string{"GatewayId", "GatewayName", "VolumeId"},
		"AWS/WorkSpaces":       []string{"DirectoryId", "WorkspaceId"},
	}
}

func handleGetRegions(req *cwRequest, c *middleware.Context) {
	regions := []string{
		"us-west-2", "us-west-1", "eu-west-1", "eu-central-1", "ap-southeast-1",
		"ap-southeast-2", "ap-northeast-1", "sa-east-1",
	}

	result := []interface{}{}
	for _, region := range regions {
		result = append(result, util.DynMap{"text": region, "value": region})
	}

	c.JSON(200, result)
}

func handleGetNamespaces(req *cwRequest, c *middleware.Context) {
	result := []interface{}{}
	for key, _ := range metricsMap {
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

	result := []interface{}{}
	for _, name := range dimensionValues {
		result = append(result, util.DynMap{"text": name, "value": name})
	}

	c.JSON(200, result)
}
