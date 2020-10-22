package cloudwatch

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// Known AWS regions.
var knownRegions = []string{
	"af-south-1", "ap-east-1", "ap-northeast-1", "ap-northeast-2", "ap-northeast-3", "ap-south-1", "ap-southeast-1",
	"ap-southeast-2", "ca-central-1", "cn-north-1", "cn-northwest-1", "eu-central-1", "eu-north-1", "eu-west-1",
	"eu-west-2", "eu-west-3", "me-south-1", "sa-east-1", "us-east-1", "us-east-2", "us-gov-east-1", "us-gov-west-1",
	"us-iso-east-1", "us-isob-east-1", "us-west-1", "us-west-2",
}

type suggestData struct {
	Text  string
	Value string
}

type customMetricsCache struct {
	Expire time.Time
	Cache  []string
}

var customMetricsMetricsMap = make(map[string]map[string]map[string]*customMetricsCache)
var customMetricsDimensionsMap = make(map[string]map[string]map[string]*customMetricsCache)
var metricsMap = map[string][]string{
	"AWS/ACMPrivateCA":            {"CRLGenerated", "Failure", "MisconfiguredCRLBucket", "Success", "Time"},
	"AWS/AmazonMQ":                {"BurstBalance", "ConsumerCount", "CpuCreditBalance", "CpuUtilization", "CurrentConnectionsCount", "DequeueCount", "DispatchCount", "EnqueueCount", "EnqueueTime", "EstablishedConnectionsCount", "ExpiredCount", "HeapUsage", "InactiveDurableTopicSubscribersCount", "InFlightCount", "JobSchedulerStorePercentUsage", "JournalFilesForFastRecovery", "JournalFilesForFullRecovery", "MemoryUsage", "NetworkIn", "NetworkOut", "OpenTransactionCount", "ProducerCount", "QueueSize", "ReceiveCount", "StorePercentUsage", "TempPercentUsage", "TotalConsumerCount", "TotalDequeueCount", "TotalEnqueueCount", "TotalMessageCount", "TotalProducerCount", "VolumeReadOps", "VolumeWriteOps"},
	"AWS/ApiGateway":              {"4XXError", "5XXError", "CacheHitCount", "CacheMissCount", "Count", "IntegrationLatency", "Latency"},
	"AWS/AppStream":               {"ActualCapacity", "AvailableCapacity", "CapacityUtilization", "DesiredCapacity", "InUseCapacity", "InsufficientCapacityError", "PendingCapacity", "RunningCapacity"},
	"AWS/AppSync":                 {"4XXError", "5XXError", "Latency"},
	"AWS/ApplicationELB":          {"ActiveConnectionCount", "ClientTLSNegotiationErrorCount", "ConsumedLCUs", "ELBAuthError", "ELBAuthFailure", "ELBAuthLatency", "ELBAuthRefreshTokenSuccess", "ELBAuthSuccess", "ELBAuthUserClaimsSizeExceeded", "HTTPCode_ELB_3XX_Count", "HTTPCode_ELB_4XX_Count", "HTTPCode_ELB_5XX_Count", "HTTPCode_Target_2XX_Count", "HTTPCode_Target_3XX_Count", "HTTPCode_Target_4XX_Count", "HTTPCode_Target_5XX_Count", "HTTP_Fixed_Response_Count", "HTTP_Redirect_Count", "HTTP_Redirect_Url_Limit_Exceeded_Count", "HealthyHostCount", "IPv6ProcessedBytes", "IPv6RequestCount", "LambdaInternalError", "LambdaTargetProcessedBytes", "LambdaUserError", "NewConnectionCount", "NonStickyRequestCount", "ProcessedBytes", "RejectedConnectionCount", "RequestCount", "RequestCountPerTarget", "RuleEvaluations", "StandardProcessedBytes", "TargetConnectionErrorCount", "TargetResponseTime", "TargetTLSNegotiationErrorCount", "UnHealthyHostCount"},
	"AWS/Athena":                  {"EngineExecutionTime", "QueryPlanningTime", "QueryQueueTime", "ProcessedBytes", "ServiceProcessingTime", "TotalExecutionTime"},
	"AWS/AutoScaling":             {"GroupDesiredCapacity", "GroupInServiceInstances", "GroupMaxSize", "GroupMinSize", "GroupPendingInstances", "GroupStandbyInstances", "GroupTerminatingInstances", "GroupTotalInstances"},
	"AWS/Billing":                 {"EstimatedCharges"},
	"AWS/Chatbot":                 {"EventsThrottled", "EventsProcessed", "MessageDeliverySuccess", "MessageDeliveryFailure", "UnsupportedEvents"},
	"AWS/CloudFront":              {"4xxErrorRate", "5xxErrorRate", "BytesDownloaded", "BytesUploaded", "Requests", "TotalErrorRate", "CacheHitRate", "OriginLatency", "401ErrorRate", "403ErrorRate", "404ErrorRate", "502ErrorRate", "503ErrorRate", "504ErrorRate"},
	"AWS/CloudHSM":                {"HsmKeysSessionOccupied", "HsmKeysTokenOccupied", "HsmSessionCount", "HsmSslCtxsOccupied", "HsmTemperature", "HsmUnhealthy", "HsmUsersAvailable", "HsmUsersMax", "InterfaceEth2OctetsInput", "InterfaceEth2OctetsOutput"},
	"AWS/CloudSearch":             {"IndexUtilization", "Partitions", "SearchableDocuments", "SuccessfulRequests"},
	"AWS/CodeBuild":               {"BuildDuration", "Builds", "DownloadSourceDuration", "Duration", "FailedBuilds", "FinalizingDuration", "InstallDuration", "PostBuildDuration", "PreBuildDuration", "ProvisioningDuration", "QueuedDuration", "SubmittedDuration", "SucceededBuilds", "UploadArtifactsDuration"},
	"AWS/Cognito":                 {"AccountTakeOverRisk", "CompromisedCredentialsRisk", "NoRisk", "OverrideBlock", "Risk"},
	"AWS/Connect":                 {"CallBackNotDialableNumber", "CallRecordingUploadError", "CallsBreachingConcurrencyQuota", "CallsPerInterval", "ConcurrentCalls", "ConcurrentCallsPercentage", "ContactFlowErrors", "ContactFlowFatalErrors", "LongestQueueWaitTime", "MisconfiguredPhoneNumbers", "MissedCalls", "PublicSigningKeyUsage", "QueueCapacityExceededError", "QueueSize", "ThrottledCalls", "ToInstancePacketLossRate"},
	"AWS/DataSync":                {"BytesVerifiedSource", "BytesPreparedSource", "FilesVerifiedSource", "FilesPreparedSource", "BytesVerifiedDestination", "BytesPreparedDestination", "FilesVerifiedDestination", "FilesPreparedDestination", "FilesTransferred", "BytesTransferred", "BytesWritten"},
	"AWS/DDoSProtection":          {"DDoSDetected", "DDoSAttackBitsPerSecond", "DDoSAttackPacketsPerSecond", "DDoSAttackRequestsPerSecond"},
	"AWS/DMS":                     {"CDCChangesDiskSource", "CDCChangesDiskTarget", "CDCChangesMemorySource", "CDCChangesMemoryTarget", "CDCIncomingChanges", "CDCLatencySource", "CDCLatencyTarget", "CDCThroughputBandwidthSource", "CDCThroughputBandwidthTarget", "CDCThroughputRowsSource", "CDCThroughputRowsTarget", "CPUUtilization", "FreeStorageSpace", "FreeableMemory", "FullLoadThroughputBandwidthSource", "FullLoadThroughputBandwidthTarget", "FullLoadThroughputRowsSource", "FullLoadThroughputRowsTarget", "NetworkReceiveThroughput", "NetworkTransmitThroughput", "ReadIOPS", "ReadLatency", "ReadThroughput", "SwapUsage", "WriteIOPS", "WriteLatency", "WriteThroughput"},
	"AWS/DocDB":                   {"BackupRetentionPeriodStorageUsed", "BufferCacheHitRatio", "ChangeStreamLogSize", "CPUUtilization", "DatabaseConnections", "DBInstanceReplicaLag", "DBClusterReplicaLagMaximum", "DBClusterReplicaLagMinimum", "DiskQueueDepth", "EngineUptime", "FreeableMemory", "FreeLocalStorage", "NetworkReceiveThroughput", "NetworkThroughput", "NetworkTransmitThroughput", "ReadIOPS", "ReadLatency", "ReadThroughput", "SnapshotStorageUsed", "SwapUsage", "TotalBackupStorageBilled", "VolumeBytesUsed", "VolumeReadIOPs", "VolumeWriteIOPs", "WriteIOPS", "WriteLatency", "WriteThroughput"},
	"AWS/DX":                      {"ConnectionBpsEgress", "ConnectionBpsIngress", "ConnectionCRCErrorCount", "ConnectionLightLevelRx", "ConnectionLightLevelTx", "ConnectionPpsEgress", "ConnectionPpsIngress", "ConnectionState", "VirtualInterfaceBpsEgress", "VirtualInterfaceBpsIngress", "VirtualInterfacePpsEgress", "VirtualInterfacePpsIngress"},
	"AWS/DAX":                     {"CPUUtilization", "NetworkPacketsIn", "NetworkPacketsOut", "GetItemRequestCount", "BatchGetItemRequestCount", "BatchWriteItemRequestCount", "DeleteItemRequestCount", "PutItemRequestCount", "UpdateItemRequestCount", "TransactWriteItemsCount", "TransactGetItemsCount", "ItemCacheHits", "ItemCacheMisses", "QueryCacheHits", "QueryCacheMisses", "ScanCacheHits", "ScanCacheMisses", "TotalRequestCount", "ErrorRequestCount", "FaultRequestCount", "FailedRequestCount", "QueryRequestCount", "ScanRequestCount", "ClientConnections", "EstimatedDbSize", "EvictedSize"},
	"AWS/DynamoDB":                {"ConditionalCheckFailedRequests", "ConsumedReadCapacityUnits", "ConsumedWriteCapacityUnits", "OnlineIndexConsumedWriteCapacity", "OnlineIndexPercentageProgress", "OnlineIndexThrottleEvents", "PendingReplicationCount", "ProvisionedReadCapacityUnits", "ProvisionedWriteCapacityUnits", "ReadThrottleEvents", "ReplicationLatency", "ReturnedBytes", "ReturnedItemCount", "ReturnedRecordsCount", "SuccessfulRequestLatency", "SystemErrors", "ThrottledRequests", "TimeToLiveDeletedItemCount", "UserErrors", "WriteThrottleEvents"},
	"AWS/EBS":                     {"BurstBalance", "VolumeConsumedReadWriteOps", "VolumeIdleTime", "VolumeQueueLength", "VolumeReadBytes", "VolumeReadOps", "VolumeThroughputPercentage", "VolumeTotalReadTime", "VolumeTotalWriteTime", "VolumeWriteBytes", "VolumeWriteOps"},
	"AWS/EC2":                     {"CPUCreditBalance", "CPUCreditUsage", "CPUSurplusCreditBalance", "CPUSurplusCreditsCharged", "CPUUtilization", "DiskReadBytes", "DiskReadOps", "DiskWriteBytes", "DiskWriteOps", "EBSByteBalance%", "EBSIOBalance%", "EBSReadBytes", "EBSReadOps", "EBSWriteBytes", "EBSWriteOps", "NetworkIn", "NetworkOut", "NetworkPacketsIn", "NetworkPacketsOut", "StatusCheckFailed", "StatusCheckFailed_Instance", "StatusCheckFailed_System"},
	"AWS/EC2/API":                 {"ClientErrors", "RequestLimitExceeded", "ServerErrors", "SuccessfulCalls"},
	"AWS/EC2CapacityReservations": {"AvailableInstanceCount", "InstanceUtilization", "TotalInstanceCount", "UsedInstanceCount"},
	"AWS/EC2Spot":                 {"AvailableInstancePoolsCount", "BidsSubmittedForCapacity", "EligibleInstancePoolCount", "FulfilledCapacity", "MaxPercentCapacityAllocation", "PendingCapacity", "PercentCapacityAllocation", "TargetCapacity", "TerminatingCapacity"},
	"AWS/ECS":                     {"CPUReservation", "CPUUtilization", "GPUReservation", "MemoryReservation", "MemoryUtilization"},
	"AWS/EFS":                     {"BurstCreditBalance", "ClientConnections", "DataReadIOBytes", "DataWriteIOBytes", "MetadataIOBytes", "PercentIOLimit", "PermittedThroughput", "TotalIOBytes"},
	"AWS/ELB":                     {"BackendConnectionErrors", "EstimatedALBActiveConnectionCount", "EstimatedALBConsumedLCUs", "EstimatedALBNewConnectionCount", "EstimatedProcessedBytes", "HTTPCode_Backend_2XX", "HTTPCode_Backend_3XX", "HTTPCode_Backend_4XX", "HTTPCode_Backend_5XX", "HTTPCode_ELB_4XX", "HTTPCode_ELB_5XX", "HealthyHostCount", "Latency", "RequestCount", "SpilloverCount", "SurgeQueueLength", "UnHealthyHostCount"},
	"AWS/ES":                      {"AutomatedSnapshotFailure", "CPUCreditBalance", "CPUUtilization", "ClusterIndexWritesBlocked", "ClusterStatus.green", "ClusterStatus.red", "ClusterStatus.yellow", "ClusterUsedSpace", "DeletedDocuments", "DiskQueueDepth", "ElasticsearchRequests", "FreeStorageSpace", "IndexingLatency", "IndexingRate", "InvalidHostHeaderRequests", "JVMGCOldCollectionCount", "JVMGCOldCollectionTime", "JVMGCYoungCollectionCount", "JVMGCYoungCollectionTime", "JVMMemoryPressure", "KMSKeyError", "KMSKeyInaccessible", "KibanaHealthyNodes", "MasterCPUCreditBalance", "MasterCPUUtilization", "MasterFreeStorageSpace", "MasterJVMMemoryPressure", "MasterReachableFromNode", "Nodes", "ReadIOPS", "ReadLatency", "ReadThroughput", "RequestCount", "SearchLatency", "SearchRate", "SearchableDocuments", "SysMemoryUtilization", "ThreadpoolBulkQueue", "ThreadpoolBulkRejected", "ThreadpoolBulkThreads", "ThreadpoolForce_mergeQueue", "ThreadpoolForce_mergeRejected", "ThreadpoolForce_mergeThreads", "ThreadpoolIndexQueue", "ThreadpoolIndexRejected", "ThreadpoolIndexThreads", "ThreadpoolSearchQueue", "ThreadpoolSearchRejected", "ThreadpoolSearchThreads", "WriteIOPS", "WriteLatency", "WriteThroughput"},
	"AWS/ElastiCache":             {"ActiveDefragHits", "BytesReadIntoMemcached", "BytesUsedForCache", "BytesUsedForCacheItems", "BytesUsedForHash", "BytesWrittenOutFromMemcached", "CPUUtilization", "CacheHitRate", "CacheHits", "CacheMisses", "CasBadval", "CasHits", "CasMisses", "CmdConfigGet", "CmdConfigSet", "CmdFlush", "CmdGet", "CmdSet", "CmdTouch", "CurrConfig", "CurrConnections", "CurrItems", "DB0AverageTTL", "DatabaseMemoryUsagePercentage", "DecrHits", "DecrMisses", "DeleteHits", "DeleteMisses", "EngineCPUUtilization", "EvalBasedCmds", "EvalBasedCmdsLatency", "EvictedUnfetched", "Evictions", "ExpiredUnfetched", "FreeableMemory", "GeoSpatialBasedCmds", "GeoSpatialBasedCmdsLatency", "GetHits", "GetMisses", "GetTypeCmds", "GetTypeCmdsLatency", "HashBasedCmds", "HashBasedCmdsLatency", "HyperLogLogBasedCmds", "HyperLogLogBasedCmdsLatency", "IncrHits", "IncrMisses", "KeyBasedCmds", "KeyBasedCmdsLatency", "ListBasedCmds", "ListBasedCmdsLatency", "MasterLinkHealthStatus", "MemoryFragmentationRatio", "NetworkBytesIn", "NetworkBytesOut", "NewConnections", "NewItems", "PubSubBasedCmds", "PubSubBasedCmdsLatency", "Reclaimed", "ReplicationBytes", "ReplicationLag", "SaveInProgress", "SetBasedCmds", "SetBasedCmdsLatency", "SetTypeCmds", "SetTypeCmdsLatency", "SlabsMoved", "SortedSetBasedCmds", "SortedSetBasedCmdsLatency", "StreamBasedCmds", "StreamBasedCmdsLatency", "StringBasedCmds", "StringBasedCmdsLatency", "SwapUsage", "TouchHits", "TouchMisses", "UnusedMemory"},
	"AWS/ElasticBeanstalk":        {"ApplicationLatencyP10", "ApplicationLatencyP50", "ApplicationLatencyP75", "ApplicationLatencyP85", "ApplicationLatencyP90", "ApplicationLatencyP95", "ApplicationLatencyP99", "ApplicationLatencyP99.9", "ApplicationRequests2xx", "ApplicationRequests3xx", "ApplicationRequests4xx", "ApplicationRequests5xx", "ApplicationRequestsTotal", "CPUIdle", "CPUIowait", "CPUIrq", "CPUNice", "CPUSoftirq", "CPUSystem", "CPUUser", "EnvironmentHealth", "InstanceHealth", "InstancesDegraded", "InstancesInfo", "InstancesNoData", "InstancesOk", "InstancesPending", "InstancesSevere", "InstancesUnknown", "InstancesWarning", "LoadAverage1min", "LoadAverage5min", "RootFilesystemUtil"},
	"AWS/ElasticInference":        {"AcceleratorHealthCheckFailed", "AcceleratorMemoryUsage", "ConnectivityCheckFailed"},
	"AWS/ElasticMapReduce":        {"AppsCompleted", "AppsFailed", "AppsKilled", "AppsPending", "AppsRunning", "AppsSubmitted", "BackupFailed", "CapacityRemainingGB", "Cluster Status", "ContainerAllocated", "ContainerPending", "ContainerPendingRatio", "ContainerReserved", "CoreNodesPending", "CoreNodesRunning", "CorruptBlocks", "DfsPendingReplicationBlocks", "HBase", "HDFSBytesRead", "HDFSBytesWritten", "HDFSUtilization", "HbaseBackupFailed", "IO", "IsIdle", "JobsFailed", "JobsRunning", "LiveDataNodes", "LiveTaskTrackers", "MRActiveNodes", "MRDecommissionedNodes", "MRLostNodes", "MRRebootedNodes", "MRTotalNodes", "MRUnhealthyNodes", "Map/Reduce", "MapSlotsOpen", "MapTasksRemaining", "MapTasksRunning", "MemoryAllocatedMB", "MemoryAvailableMB", "MemoryReservedMB", "MemoryTotalMB", "MissingBlocks", "MostRecentBackupDuration", "Node Status", "PendingDeletionBlocks", "ReduceSlotsOpen", "ReduceTasksRemaining", "ReduceTasksRunning", "RemainingMapTasksPerSlot", "S3BytesRead", "S3BytesWritten", "TaskNodesPending", "TaskNodesRunning", "TimeSinceLastSuccessfulBackup", "TotalLoad", "UnderReplicatedBlocks", "YARNMemoryAvailablePercentage"},
	"AWS/ElasticTranscoder":       {"Billed Audio Output", "Billed HD Output", "Billed SD Output", "Errors", "Jobs Completed", "Jobs Errored", "Outputs per Job", "Standby Time", "Throttles"},
	"AWS/Events":                  {"DeadLetterInvocations", "FailedInvocations", "Invocations", "MatchedEvents", "ThrottledRules", "TriggeredRules"},
	"AWS/FSx":                     {"DataReadBytes", "DataReadOperations", "DataWriteBytes", "DataWriteOperations", "FreeDataStorageCapacity", "FreeStorageCapacity", "MetadataOperations"},
	"AWS/Firehose":                {"BackupToS3.Bytes", "BackupToS3.DataFreshness", "BackupToS3.Records", "BackupToS3.Success", "DataReadFromKinesisStream.Bytes", "DataReadFromKinesisStream.Records", "DeliveryToElasticsearch.Bytes", "DeliveryToElasticsearch.Records", "DeliveryToElasticsearch.Success", "DeliveryToRedshift.Bytes", "DeliveryToRedshift.Records", "DeliveryToRedshift.Success", "DeliveryToS3.Bytes", "DeliveryToS3.DataFreshness", "DeliveryToS3.Records", "DeliveryToS3.Success", "DeliveryToSplunk.Bytes", "DeliveryToSplunk.DataFreshness", "DeliveryToSplunk.Records", "DeliveryToSplunk.Success", "DescribeDeliveryStream.Latency", "DescribeDeliveryStream.Requests", "ExecuteProcessing.Duration", "ExecuteProcessing.Success", "FailedConversion.Bytes", "FailedConversion.Records", "IncomingBytes", "IncomingRecords", "KinesisMillisBehindLatest", "ListDeliveryStreams.Latency", "ListDeliveryStreams.Requests", "PutRecord.Bytes", "PutRecord.Latency", "PutRecord.Requests", "PutRecordBatch.Bytes", "PutRecordBatch.Latency", "PutRecordBatch.Records", "PutRecordBatch.Requests", "SucceedConversion.Bytes", "SucceedConversion.Records", "SucceedProcessing.Bytes", "SucceedProcessing.Records", "ThrottledDescribeStream", "ThrottledGetRecords", "ThrottledGetShardIterator", "UpdateDeliveryStream.Latency", "UpdateDeliveryStream.Requests"},
	"AWS/GameLift":                {"ActivatingGameSessions", "ActiveGameSessions", "ActiveInstances", "ActiveServerProcesses", "AvailableGameSessions", "AverageWaitTime", "CurrentPlayerSessions", "CurrentTickets", "DesiredInstances", "FirstChoiceNotViable", "FirstChoiceOutOfCapacity", "GameSessionInterruptions", "HealthyServerProcesses", "IdleInstances", "InstanceInterruptions", "LowestLatencyPlacement", "LowestPricePlacement", "MatchAcceptancesTimedOut", "MatchesAccepted", "MatchesCreated", "MatchesPlaced", "MatchesRejected", "MaxInstances", "MinInstances", "PercentAvailableGameSessions", "PercentHealthyServerProcesses", "PercentIdleInstances", "Placement", "PlacementsCanceled", "PlacementsFailed", "PlacementsStarted", "PlacementsSucceeded", "PlacementsTimedOut", "PlayerSessionActivations", "PlayersStarted", "QueueDepth", "RuleEvaluationsFailed", "RuleEvaluationsPassed", "ServerProcessAbnormalTerminations", "ServerProcessActivations", "ServerProcessTerminations", "TicketsFailed", "TicketsStarted", "TicketsTimedOut", "TimeToMatch", "TimeToTicketSuccess"},
	"AWS/Glue":                    {"glue.driver.BlockManager.disk.diskSpaceUsed_MB", "glue.driver.ExecutorAllocationManager.executors.numberAllExecutors", "glue.driver.ExecutorAllocationManager.executors.numberMaxNeededExecutors", "glue.driver.aggregate.bytesRead", "glue.driver.aggregate.elapsedTime", "glue.driver.aggregate.numCompletedStages", "glue.driver.aggregate.numCompletedTasks", "glue.driver.aggregate.numFailedTasks", "glue.driver.aggregate.numKilledTasks", "glue.driver.aggregate.recordsRead", "glue.driver.aggregate.shuffleBytesWritten", "glue.driver.aggregate.shuffleLocalBytesRead", "glue.driver.jvm.heap.usage  glue.executorId.jvm.heap.usage  glue.ALL.jvm.heap.usage", "glue.driver.jvm.heap.used  glue.executorId.jvm.heap.used  glue.ALL.jvm.heap.used", "glue.driver.s3.filesystem.read_bytes  glue.executorId.s3.filesystem.read_bytes  glue.ALL.s3.filesystem.read_bytes", "glue.driver.s3.filesystem.write_bytes  glue.executorId.s3.filesystem.write_bytes  glue.ALL.s3.filesystem.write_bytes", "glue.driver.system.cpuSystemLoad  glue.executorId.system.cpuSystemLoad  glue.ALL.system.cpuSystemLoad"},
	"AWS/Inspector":               {"TotalAssessmentRunFindings", "TotalAssessmentRuns", "TotalHealthyAgents", "TotalMatchingAgents"},
	"AWS/IoT":                     {"CanceledJobExecutionCount", "CanceledJobExecutionTotalCount", "ClientError", "Connect.AuthError", "Connect.ClientError", "Connect.ServerError", "Connect.Success", "Connect.Throttle", "DeleteThingShadow.Accepted", "FailedJobExecutionCount", "FailedJobExecutionTotalCount", "Failure", "GetThingShadow.Accepted", "InProgressJobExecutionCount", "InProgressJobExecutionTotalCount", "NonCompliantResources", "NumLogBatchesFailedToPublishThrottled", "NumLogEventsFailedToPublishThrottled", "ParseError", "Ping.Success", "PublishIn.AuthError", "PublishIn.ClientError", "PublishIn.ServerError", "PublishIn.Success", "PublishIn.Throttle", "PublishOut.AuthError", "PublishOut.ClientError", "PublishOut.Success", "QueuedJobExecutionCount", "QueuedJobExecutionTotalCount", "RejectedJobExecutionCount", "RejectedJobExecutionTotalCount", "RemovedJobExecutionCount", "RemovedJobExecutionTotalCount", "ResourcesEvaluated", "RuleMessageThrottled", "RuleNotFound", "RulesExecuted", "ServerError", "Subscribe.AuthError", "Subscribe.ClientError", "Subscribe.ServerError", "Subscribe.Success", "Subscribe.Throttle", "SuccededJobExecutionCount", "SuccededJobExecutionTotalCount", "Success", "TopicMatch", "Unsubscribe.ClientError", "Unsubscribe.ServerError", "Unsubscribe.Success", "Unsubscribe.Throttle", "UpdateThingShadow.Accepted", "Violations", "ViolationsCleared", "ViolationsInvalidated"},
	"AWS/IoTAnalytics":            {"ActionExecution", "ActivityExecutionError", "IncomingMessages"},
	"AWS/KMS":                     {"SecondsUntilKeyMaterialExpiration"},
	"AWS/Kafka":                   {"ActiveControllerCount", "BytesInPerSec", "BytesOutPerSec", "CpuIdle", "CpuSystem", "CpuUser", "FetchConsumerLocalTimeMsMean", "FetchConsumerRequestQueueTimeMsMean", "FetchConsumerResponseQueueTimeMsMean", "FetchConsumerResponseSendTimeMsMean", "FetchConsumerTotalTimeMsMean", "FetchFollowerLocalTimeMsMean", "FetchFollowerRequestQueueTimeMsMean", "FetchFollowerResponseQueueTimeMsMean", "FetchFollowerResponseSendTimeMsMean", "FetchFollowerTotalTimeMsMean", "FetchMessageConversionsPerSec", "FetchThrottleByteRate", "FetchThrottleQueueSize", "FetchThrottleTime", "GlobalPartitionCount", "GlobalTopicCount", "KafkaAppLogsDiskUsed", "KafkaDataLogsDiskUsed", "LeaderCount", "MemoryBuffered", "MemoryCached", "MemoryFree", "MemoryUsed", "MessagesInPerSec", "NetworkProcessorAvgIdlePercent", "NetworkRxDropped", "NetworkRxErrors", "NetworkRxPackets", "NetworkTxDropped", "NetworkTxErrors", "NetworkTxPackets", "OfflinePartitionsCount", "PartitionCount", "ProduceLocalTimeMsMean", "ProduceMessageConversionsPerSec", "ProduceMessageConversionsTimeMsMean", "ProduceRequestQueueTimeMsMean", "ProduceResponseQueueTimeMsMean", "ProduceResponseSendTimeMsMean", "ProduceThrottleByteRate", "ProduceThrottleQueueSize", "ProduceThrottleTime", "ProduceTotalTimeMsMean", "RequestBytesMean", "RequestExemptFromThrottleTime", "RequestHandlerAvgIdlePercent", "RequestThrottleQueueSize", "RequestThrottleTime", "RequestTime", "RootDiskUsed", "SwapFree", "SwapUsed", "UnderMinIsrPartitionCount", "UnderReplicatedPartitions", "ZooKeeperRequestLatencyMsMean", "ZooKeeperSessionState"},
	"AWS/Kinesis":                 {"GetRecords.Bytes", "GetRecords.IteratorAge", "GetRecords.IteratorAgeMilliseconds", "GetRecords.Latency", "GetRecords.Records", "GetRecords.Success", "IncomingBytes", "IncomingRecords", "IteratorAgeMilliseconds", "OutgoingBytes", "OutgoingRecords", "PutRecord.Bytes", "PutRecord.Latency", "PutRecord.Success", "PutRecords.Bytes", "PutRecords.Latency", "PutRecords.Records", "PutRecords.Success", "ReadProvisionedThroughputExceeded", "SubscribeToShard.RateExceeded", "SubscribeToShard.Success", "SubscribeToShardEvent.Bytes", "SubscribeToShardEvent.MillisBehindLatest", "SubscribeToShardEvent.Records", "SubscribeToShardEvent.Success", "WriteProvisionedThroughputExceeded"},
	"AWS/KinesisAnalytics":        {"Bytes", "InputProcessing.DroppedRecords", "InputProcessing.Duration", "InputProcessing.OkBytes", "InputProcessing.OkRecords", "InputProcessing.ProcessingFailedRecords", "InputProcessing.Success", "KPUs", "LambdaDelivery.DeliveryFailedRecords", "LambdaDelivery.Duration", "LambdaDelivery.OkRecords", "MillisBehindLatest", "Records", "Success"},
	"AWS/KinesisVideo":            {"GetHLSMasterPlaylist.Latency", "GetHLSMasterPlaylist.Requests", "GetHLSMasterPlaylist.Success", "GetHLSMediaPlaylist.Latency", "GetHLSMediaPlaylist.Requests", "GetHLSMediaPlaylist.Success", "GetHLSStreamingSessionURL.Latency", "GetHLSStreamingSessionURL.Requests", "GetHLSStreamingSessionURL.Success", "GetMP4InitFragment.Latency", "GetMP4InitFragment.Requests", "GetMP4InitFragment.Success", "GetMP4MediaFragment.Latency", "GetMP4MediaFragment.OutgoingBytes", "GetMP4MediaFragment.Requests", "GetMP4MediaFragment.Success", "GetMedia.ConnectionErrors", "GetMedia.MillisBehindNow", "GetMedia.OutgoingBytes", "GetMedia.OutgoingFragments", "GetMedia.OutgoingFrames", "GetMedia.Requests", "GetMedia.Success", "GetMediaForFragmentList.OutgoingBytes", "GetMediaForFragmentList.OutgoingFragments", "GetMediaForFragmentList.OutgoingFrames", "GetMediaForFragmentList.Requests", "GetMediaForFragmentList.Success", "GetTSFragment.Latency", "GetTSFragment.OutgoingBytes", "GetTSFragment.Requests", "GetTSFragment.Success", "ListFragments.Latency", "PutMedia.ActiveConnections", "PutMedia.BufferingAckLatency", "PutMedia.ConnectionErrors", "PutMedia.ErrorAckCount", "PutMedia.FragmentIngestionLatency", "PutMedia.FragmentPersistLatency", "PutMedia.IncomingBytes", "PutMedia.IncomingFragments", "PutMedia.IncomingFrames", "PutMedia.Latency", "PutMedia.PersistedAckLatency", "PutMedia.ReceivedAckLatency", "PutMedia.Requests", "PutMedia.Success"},
	"AWS/Lambda":                  {"ConcurrentExecutions", "DeadLetterErrors", "Duration", "Errors", "Invocations", "IteratorAge", "Throttles", "UnreservedConcurrentExecutions"},
	"AWS/Lex":                     {"BotChannelAuthErrors", "BotChannelConfigurationErrors", "BotChannelInboundThrottledEvents", "BotChannelOutboundThrottledEvents", "BotChannelRequestCount", "BotChannelResponseCardErrors", "BotChannelSystemErrors", "MissedUtteranceCount", "RuntimeInvalidLambdaResponses", "RuntimeLambdaErrors", "RuntimePollyErrors", "RuntimeRequestCount", "RuntimeSucessfulRequestLatency", "RuntimeSystemErrors", "RuntimeThrottledEvents", "RuntimeUserErrors"},
	"AWS/Logs":                    {"DeliveryErrors", "DeliveryThrottling", "ForwardedBytes", "ForwardedLogEvents", "IncomingBytes", "IncomingLogEvents"},
	"AWS/ML":                      {"PredictCount", "PredictFailureCount"},
	"AWS/MediaConnect":            {"ARQRecovered", "ARQRequests", "BitRate", "CATError", "CRCError", "Connected", "ConnectedOutputs", "ContinuityCounter", "Disconnections", "DroppedPackets", "FECPackets", "FECRecovered", "NotRecoveredPackets", "OutputConnected", "OutputDisconnections", "OverflowPackets", "PATError", "PCRAccuracyError", "PCRError", "PIDError", "PMTError", "PTSError", "PacketLossPercent", "RecoveredPackets", "RoundTripTime", "SourceARQRecovered", "SourceARQRequests", "SourceBitRate", "SourceCATError", "SourceCRCError", "SourceConnected", "SourceContinuityCounter", "SourceDisconnections", "SourceDroppedPackets", "SourceFECPackets", "SourceFECRecovered", "SourceNotRecoveredPackets", "SourceOverflowPackets", "SourcePATError", "SourcePCRAccuracyError", "SourcePCRError", "SourcePIDError", "SourcePMTError", "SourcePTSError", "SourcePacketLossPercent", "SourceRecoveredPackets", "SourceRoundTripTime", "SourceTSByteError", "SourceTSSyncLoss", "SourceTotalPackets", "SourceTransportError", "TSByteError", "TSSyncLoss", "TotalPackets", "TransportError"},
	"AWS/MediaConvert":            {"AudioOutputSeconds", "Errors", "HDOutputSeconds", "JobsCompletedCount", "JobsErroredCount", "SDOutputSeconds", "StandbyTime", "TranscodingTime", "UHDOutputSeconds"},
	"AWS/MediaPackage":            {"ActiveInput", "EgressBytes", "EgressRequestCount", "EgressResponseTime", "IngressBytes", "IngressResponseTime"},
	"AWS/MediaStore":              {"RequestCount", "4xxErrorCount", "5xxErrorCount", "BytesUploaded", "BytesDownloaded", "TotalTime", "TurnaroundTime"},
	"AWS/MediaTailor":             {"AdDecisionServer.Ads", "AdDecisionServer.Duration", "AdDecisionServer.Errors", "AdDecisionServer.FillRate", "AdDecisionServer.Timeouts", "AdNotReady", "Avails.Duration", "Avails.FillRate", "Avails.FilledDuration", "GetManifest.Errors", "Origin.Errors", "Origin.Timeouts"},
	"AWS/NATGateway":              {"ActiveConnectionCount", "BytesInFromDestination", "BytesInFromSource", "BytesOutToDestination", "BytesOutToSource", "ConnectionAttemptCount", "ConnectionEstablishedCount", "ErrorPortAllocation", "IdleTimeoutCount", "PacketsDropCount", "PacketsInFromDestination", "PacketsInFromSource", "PacketsOutToDestination", "PacketsOutToSource"},
	"AWS/Neptune":                 {"CPUUtilization", "ClusterReplicaLag", "ClusterReplicaLagMaximum", "ClusterReplicaLagMinimum", "EngineUptime", "FreeLocalStorage", "FreeableMemory", "GremlinErrors", "GremlinHttp1xx", "GremlinHttp2xx", "GremlinHttp4xx", "GremlinHttp5xx", "GremlinRequests", "GremlinRequestsPerSec", "GremlinWebSocketAvailableConnections", "GremlinWebSocketClientErrors", "GremlinWebSocketServerErrors", "GremlinWebSocketSuccess", "Http100", "Http101", "Http1xx", "Http200", "Http2xx", "Http400", "Http403", "Http405", "Http413", "Http429", "Http4xx", "Http500", "Http501", "Http5xx", "LoaderErrors", "LoaderRequests", "NetworkReceiveThroughput", "NetworkThroughput", "NetworkTransmitThroughput", "SparqlErrors", "SparqlHttp1xx", "SparqlHttp2xx", "SparqlHttp4xx", "SparqlHttp5xx", "SparqlRequests", "SparqlRequestsPerSec", "StatusErrors", "StatusRequests", "VolumeBytesUsed", "VolumeReadIOPs", "VolumeWriteIOPs"},
	"AWS/NetworkELB":              {"ActiveFlowCount", "ActiveFlowCount_TLS", "ClientTLSNegotiationErrorCount", "ConsumedLCUs", "HealthyHostCount", "NewFlowCount", "NewFlowCount_TLS", "ProcessedBytes", "ProcessedBytes_TLS", "TCP_Client_Reset_Count", "TCP_ELB_Reset_Count", "TCP_Target_Reset_Count", "TargetTLSNegotiationErrorCount", "UnHealthyHostCount"},
	"AWS/OpsWorks":                {"cpu_idle", "cpu_nice", "cpu_steal", "cpu_system", "cpu_user", "cpu_waitio", "load_1", "load_15", "load_5", "memory_buffers", "memory_cached", "memory_free", "memory_swap", "memory_total", "memory_used", "procs"},
	"AWS/Polly":                   {"2XXCount", "4XXCount", "5XXCount", "RequestCharacters", "ResponseLatency"},
	"AWS/RDS":                     {"ActiveTransactions", "AuroraBinlogReplicaLag", "AuroraGlobalDBDataTransferBytes", "AuroraGlobalDBReplicatedWriteIO", "AuroraGlobalDBReplicationLag", "AuroraReplicaLag", "AuroraReplicaLagMaximum", "AuroraReplicaLagMinimum", "BacktrackChangeRecordsCreationRate", "BacktrackChangeRecordsStored", "BacktrackWindowActual", "BacktrackWindowAlert", "BackupRetentionPeriodStorageUsed", "BinLogDiskUsage", "BlockedTransactions", "BufferCacheHitRatio", "BurstBalance", "CPUCreditBalance", "CPUCreditUsage", "CPUUtilization", "CommitLatency", "CommitThroughput", "DDLLatency", "DDLThroughput", "DMLLatency", "DMLThroughput", "DatabaseConnections", "Deadlocks", "DeleteLatency", "DeleteThroughput", "DiskQueueDepth", "EngineUptime", "FailedSQLServerAgentJobsCount", "FreeLocalStorage", "FreeStorageSpace", "FreeableMemory", "InsertLatency", "InsertThroughput", "LoginFailures", "MaximumUsedTransactionIDs", "NetworkReceiveThroughput", "NetworkThroughput", "NetworkTransmitThroughput", "OldestReplicationSlotLag", "Queries", "RDSToAuroraPostgreSQLReplicaLag", "ReadIOPS", "ReadLatency", "ReadThroughput", "ReplicaLag", "ReplicationSlotDiskUsage", "ResultSetCacheHitRatio", "SelectLatency", "SelectThroughput", "ServerlessDatabaseCapacity", "SnapshotStorageUsed", "SwapUsage", "TotalBackupStorageBilled", "TransactionLogsDiskUsage", "TransactionLogsGeneration", "UpdateLatency", "UpdateThroughput", "VolumeBytesUsed", "VolumeReadIOPs", "VolumeWriteIOPs", "WriteIOPS", "WriteLatency", "WriteThroughput"},
	"AWS/Redshift":                {"CPUUtilization", "DatabaseConnections", "HealthStatus", "MaintenanceMode", "NetworkReceiveThroughput", "NetworkTransmitThroughput", "PercentageDiskSpaceUsed", "QueriesCompletedPerSecond", "QueryDuration", "QueryRuntimeBreakdown", "ReadIOPS", "ReadLatency", "ReadThroughput", "TotalTableCount", "WLMQueriesCompletedPerSecond", "WLMQueryDuration", "WLMQueueLength", "WriteIOPS", "WriteLatency", "WriteThroughput"},
	"AWS/Route53":                 {"ChildHealthCheckHealthyCount", "ConnectionTime", "DNSQueries", "HealthCheckPercentageHealthy", "HealthCheckStatus", "SSLHandshakeTime", "TimeToFirstByte"},
	"AWS/Route53Resolver":         {"InboundQueryVolume", "OutboundQueryVolume", "OutboundQueryAggregatedVolume"},
	"AWS/S3":                      {"4xxErrors", "5xxErrors", "AllRequests", "BucketSizeBytes", "BytesDownloaded", "BytesUploaded", "DeleteRequests", "FirstByteLatency", "GetRequests", "HeadRequests", "ListRequests", "NumberOfObjects", "PostRequests", "PutRequests", "SelectRequests", "SelectReturnedBytes", "SelectScannedBytes", "TotalRequestLatency"},
	"AWS/SDKMetrics":              {"CallCount", "ClientErrorCount", "EndToEndLatency", "ConnectionErrorCount", "ServerErrorCount", "ThrottleCount"},
	"AWS/ServiceCatalog":          {"ProvisionedProductLaunch"},
	"AWS/SES":                     {"Bounce", "Clicks", "Complaint", "Delivery", "Opens", "Reject", "Rendering Failures", "Reputation.BounceRate", "Reputation.ComplaintRate", "Send"},
	"AWS/SNS":                     {"NumberOfMessagesPublished", "NumberOfNotificationsDelivered", "NumberOfNotificationsFailed", "NumberOfNotificationsFilteredOut", "NumberOfNotificationsFilteredOut-InvalidAttributes", "NumberOfNotificationsFilteredOut-NoMessageAttributes", "PublishSize", "SMSMonthToDateSpentUSD", "SMSSuccessRate"},
	"AWS/SQS":                     {"ApproximateAgeOfOldestMessage", "ApproximateNumberOfMessagesDelayed", "ApproximateNumberOfMessagesNotVisible", "ApproximateNumberOfMessagesVisible", "NumberOfEmptyReceives", "NumberOfMessagesDeleted", "NumberOfMessagesReceived", "NumberOfMessagesSent", "SentMessageSize"},
	"AWS/SWF":                     {"ActivityTaskScheduleToCloseTime", "ActivityTaskScheduleToStartTime", "ActivityTaskStartToCloseTime", "ActivityTasksCanceled", "ActivityTasksCompleted", "ActivityTasksFailed", "ConsumedCapacity", "DecisionTaskScheduleToStartTime", "DecisionTaskStartToCloseTime", "DecisionTasksCompleted", "PendingTasks", "ProvisionedBucketSize", "ProvisionedRefillRate", "ScheduledActivityTasksTimedOutOnClose", "ScheduledActivityTasksTimedOutOnStart", "StartedActivityTasksTimedOutOnClose", "StartedActivityTasksTimedOutOnHeartbeat", "StartedDecisionTasksTimedOutOnClose", "ThrottledEvents", "WorkflowStartToCloseTime", "WorkflowsCanceled", "WorkflowsCompleted", "WorkflowsContinuedAsNew", "WorkflowsFailed", "WorkflowsTerminated", "WorkflowsTimedOut"},
	"AWS/SageMaker":               {"CPUUtilization", "DatasetObjectsAutoAnnotated", "DatasetObjectsHumanAnnotated", "DatasetObjectsLabelingFailed", "DiskUtilization", "GPUMemoryUtilization", "GPUUtilization", "Invocation4XXErrors", "Invocation5XXErrors", "Invocations", "InvocationsPerInstance", "JobsFailed", "JobsStopped", "JobsSucceeded", "MemoryUtilization", "ModelLatency", "OverheadLatency", "TotalDatasetObjectsLabeled"},
	"AWS/States":                  {"ActivitiesFailed", "ActivitiesHeartbeatTimedOut", "ActivitiesScheduled", "ActivitiesStarted", "ActivitiesSucceeded", "ActivitiesTimedOut", "ActivityRunTime", "ActivityScheduleTime", "ActivityTime", "ConsumedCapacity", "ExecutionThrottled", "ExecutionTime", "ExecutionsAborted", "ExecutionsFailed", "ExecutionsStarted", "ExecutionsSucceeded", "ExecutionsTimedOut", "LambdaFunctionRunTime", "LambdaFunctionScheduleTime", "LambdaFunctionTime", "LambdaFunctionsFailed", "LambdaFunctionsHeartbeatTimedOut", "LambdaFunctionsScheduled", "LambdaFunctionsStarted", "LambdaFunctionsSucceeded", "LambdaFunctionsTimedOut", "ProvisionedBucketSize", "ProvisionedRefillRate", "ThrottledEvents"},
	"AWS/StorageGateway":          {"CacheFree", "CacheHitPercent", "CachePercentDirty", "CachePercentUsed", "CacheUsed", "CloudBytesDownloaded", "CloudBytesUploaded", "CloudDownloadLatency", "QueuedWrites", "ReadBytes", "ReadTime", "TimeSinceLastRecoveryPoint", "TotalCacheSize", "UploadBufferFree", "UploadBufferPercentUsed", "UploadBufferUsed", "WorkingStorageFree", "WorkingStoragePercentUsed", "WorkingStorageUsed", "WriteBytes", "WriteTime"},
	"AWS/Textract":                {"ResponseTime", "ServerErrorCount", "SuccessfulRequestCount", "ThrottledCount", "UserErrorCount"},
	"AWS/ThingsGraph":             {"EventStoreQueueSize", "FlowExecutionTime", "FlowExecutionsFailed", "FlowExecutionsStarted", "FlowExecutionsSucceeded", "FlowStepExecutionTime", "FlowStepExecutionsFailed", "FlowStepExecutionsStarted", "FlowStepExecutionsSucceeded"},
	"AWS/TransitGateway":          {"BytesIn", "BytesOut", "PacketDropCountBlackhole", "PacketDropCountNoRoute", "PacketsIn", "PacketsOut"},
	"AWS/Translate":               {"CharacterCount", "ResponseTime", "ServerErrorCount", "SuccessfulRequestCount", "ThrottledCount", "UserErrorCount"},
	"AWS/TrustedAdvisor":          {"GreenChecks", "RedChecks", "RedResources", "ServiceLimitUsage", "YellowChecks", "YellowResources"},
	"AWS/Usage":                   {"CallCount", "ResourceCount"},
	"AWS/VPN":                     {"TunnelDataIn", "TunnelDataOut", "TunnelState"},
	"AWS/WAF":                     {"AllowedRequests", "BlockedRequests", "CountedRequests", "PassedRequests"},
	"AWS/WAFV2":                   {"AllowedRequests", "BlockedRequests", "CountedRequests", "PassedRequests"},
	"AWS/WorkSpaces":              {"Available", "ConnectionAttempt", "ConnectionFailure", "ConnectionSuccess", "InSessionLatency", "Maintenance", "SessionDisconnect", "SessionLaunchTime", "Stopped", "Unhealthy", "UserConnected"},
	"ECS/ContainerInsights":       {"ContainerInstanceCount", "CpuUtilized", "CpuReserved", "DeploymentCount", "DesiredTaskCount", "MemoryUtilized", "MemoryReserved", "NetworkRxBytes", "NetworkTxBytes", "PendingTaskCount", "RunningTaskCount", "ServiceCount", "StorageReadBytes", "StorageWriteBytes", "TaskCount", "TaskSetCount", "instance_cpu_limit", "instance_cpu_reserved_capacity", "instance_cpu_usage_total", "instance_cpu_utilization", "instance_filesystem_utilization", "instance_memory_limit", "instance_memory_reserved_capacity", "instance_memory_utliization", "instance_memory_working_set", "instance_network_total_bytes", "instance_number_of_running_tasks"},
	"ContainerInsights":           {"cluster_failed_node_count", "cluster_node_count", "namespace_number_of_running_pods", "node_cpu_limit", "node_cpu_reserved_capacity", "node_cpu_usage_total", "node_cpu_utilization", "node_filesystem_utilization", "node_memory_limit", "node_memory_reserved_capacity", "node_memory_utilization", "node_memory_working_set", "node_network_total_bytes", "node_number_of_running_containers", "node_number_of_running_pods", "pod_cpu_reserved_capacity", "pod_cpu_utilization", "pod_cpu_utilization_over_pod_limit", "pod_memory_reserved_capacity", "pod_memory_utilization", "pod_memory_utilization_over_pod_limit", "pod_number_of_container_restarts", "pod_network_rx_bytes", "pod_network_tx_bytes", "service_number_of_running_pods"},
	"Rekognition":                 {"DetectedFaceCount", "DetectedLabelCount", "ResponseTime", "ServerErrorCount", "SuccessfulRequestCount", "ThrottledCount", "UserErrorCount"},
	"AWS/Cassandra":               {"AccountMaxReads", "AccountMaxTableLevelReads", "AccountMaxTableLevelWrites", "AccountMaxWrites", "AccountProvisionedReadCapacityUtilization", "AccountProvisionedWriteCapacityUtilization", "ConditionalCheckFailedRequests", "ConsumedReadCapacityUnits", "ConsumedWriteCapacityUnits", "MaxProvisionedTableReadCapacityUtilization", "MaxProvisionedTableWriteCapacityUtilization", "ReturnedItemCount", "ReturnedItemCountBySelect", "SuccessfulRequestCount", "SuccessfulRequestLatency", "SystemErrors", "UserErrors"},
}

var dimensionsMap = map[string][]string{
	"AWS/ACMPrivateCA":            {},
	"AWS/AmazonMQ":                {"Broker", "NetworkConnector", "Queue", "Topic"},
	"AWS/ApiGateway":              {"ApiName", "Method", "Resource", "Stage"},
	"AWS/AppStream":               {"Fleet"},
	"AWS/AppSync":                 {"GraphQLAPIId"},
	"AWS/ApplicationELB":          {"AvailabilityZone", "LoadBalancer", "TargetGroup"},
	"AWS/Athena":                  {"QueryState", "QueryType", "WorkGroup"},
	"AWS/AutoScaling":             {"AutoScalingGroupName"},
	"AWS/Billing":                 {"Currency", "LinkedAccount", "ServiceName"},
	"AWS/Chatbot":                 {"ConfigurationName"},
	"AWS/CloudFront":              {"DistributionId", "Region"},
	"AWS/CloudHSM":                {"ClusterId", "HsmId", "Region"},
	"AWS/CloudSearch":             {"ClientId", "DomainName"},
	"AWS/CodeBuild":               {"ProjectName"},
	"AWS/Cognito":                 {"Operation", "RiskLevel", "UserPoolId"},
	"AWS/Connect":                 {"InstanceId", "MetricGroup", "Participant", "QueueName", "Stream Type", "Type of Connection"},
	"AWS/DataSync":                {"AgentId", "TaskId"},
	"AWS/DDoSProtection":          {"ResourceArn", "AttackVector"},
	"AWS/DMS":                     {"ReplicationInstanceIdentifier", "ReplicationTaskIdentifier"},
	"AWS/DocDB":                   {"DBClusterIdentifier", "DBInstanceIdentifier", "Role"},
	"AWS/DX":                      {"ConnectionId", "OpticalLaneNumber", "VirtualInterfaceId"},
	"AWS/DAX":                     {"Account", "ClusterId", "NodeId"},
	"AWS/DynamoDB":                {"GlobalSecondaryIndexName", "Operation", "ReceivingRegion", "StreamLabel", "TableName"},
	"AWS/EBS":                     {"VolumeId"},
	"AWS/EC2":                     {"AutoScalingGroupName", "ImageId", "InstanceId", "InstanceType"},
	"AWS/EC2/API":                 {},
	"AWS/EC2CapacityReservations": {"CapacityReservationId"},
	"AWS/EC2Spot":                 {"AvailabilityZone", "FleetRequestId", "InstanceType"},
	"AWS/ECS":                     {"ClusterName", "ServiceName"},
	"AWS/EFS":                     {"FileSystemId"},
	"AWS/ELB":                     {"AvailabilityZone", "LoadBalancerName"},
	"AWS/ES":                      {"ClientId", "DomainName"},
	"AWS/ElastiCache":             {"CacheClusterId", "CacheNodeId"},
	"AWS/ElasticBeanstalk":        {"EnvironmentName", "InstanceId"},
	"AWS/ElasticInference":        {"ElasticInferenceAcceleratorId", "InstanceId"},
	"AWS/ElasticMapReduce":        {"ClusterId", "JobFlowId", "JobId"},
	"AWS/ElasticTranscoder":       {"Operation", "PipelineId"},
	"AWS/Events":                  {"RuleName"},
	"AWS/FSx":                     {"FileSystemId"},
	"AWS/Firehose":                {"DeliveryStreamName"},
	"AWS/GameLift":                {"FleetId", "InstanceType", "MatchmakingConfigurationName", "MatchmakingConfigurationName-RuleName", "MetricGroups", "OperatingSystem", "QueueName"},
	"AWS/Glue":                    {"JobName", "JobRunId", "Type"},
	"AWS/Inspector":               {},
	"AWS/IoT":                     {"ActionType", "BehaviorName", "CheckName", "JobId", "Protocol", "RuleName", "ScheduledAuditName", "SecurityProfileName"},
	"AWS/IoTAnalytics":            {"ActionType", "ChannelName", "DatasetName", "DatastoreName", "PipelineActivityName", "PipelineActivityType", "PipelineName"},
	"AWS/KMS":                     {"KeyId"},
	"AWS/Kafka":                   {"Broker ID", "Cluster Name", "Topic"},
	"AWS/Kinesis":                 {"ShardId", "StreamName"},
	"AWS/KinesisAnalytics":        {"Application", "Flow", "Id"},
	"AWS/KinesisVideo":            {},
	"AWS/Lambda":                  {"Alias", "ExecutedVersion", "FunctionName", "Resource"},
	"AWS/Lex":                     {"BotAlias", "BotChannelName", "BotName", "BotVersion", "InputMode", "Operation", "Source"},
	"AWS/Logs":                    {"DestinationType", "FilterName", "LogGroupName"},
	"AWS/ML":                      {"MLModelId", "RequestMode"},
	"AWS/MediaConnect":            {"AvailabilityZone", "FlowARN", "SourceARN", "OutputARN"},
	"AWS/MediaConvert":            {"Job", "Operation", "Queue"},
	"AWS/MediaPackage":            {"Channel", "No Dimension", "OriginEndpoint", "StatusCodeRange"},
	"AWS/MediaStore":              {"ContainerName", "ObjectGroupName", "RequestType"},
	"AWS/MediaTailor":             {"Configuration Name"},
	"AWS/NATGateway":              {"NatGatewayId"},
	"AWS/Neptune":                 {"DBClusterIdentifier", "DatabaseClass", "EngineName", "Role"},
	"AWS/NetworkELB":              {"AvailabilityZone", "LoadBalancer", "TargetGroup"},
	"AWS/OpsWorks":                {"InstanceId", "LayerId", "StackId"},
	"AWS/Polly":                   {"Operation"},
	"AWS/RDS":                     {"DBClusterIdentifier", "DBInstanceIdentifier", "DatabaseClass", "DbClusterIdentifier", "EngineName", "Role", "SourceRegion"},
	"AWS/Redshift":                {"ClusterIdentifier", "NodeID", "service class", "stage", "latency", "wlmid"},
	"AWS/Route53":                 {"HealthCheckId", "Region", "HostedZoneId"},
	"AWS/Route53Resolver":         {"EndpointId"},
	"AWS/S3":                      {"BucketName", "FilterId", "StorageType"},
	"AWS/SDKMetrics":              {"DestinationRegion", "Service"},
	"AWS/ServiceCatalog":          {"State", "ProductId", "ProvisioningArtifactId"},
	"AWS/SES":                     {},
	"AWS/SNS":                     {"Application", "Country", "Platform", "SMSType", "TopicName"},
	"AWS/SQS":                     {"QueueName"},
	"AWS/SWF":                     {"APIName", "ActivityTypeName", "ActivityTypeVersion", "DecisionName", "Domain", "TaskListName", "WorkflowTypeName", "WorkflowTypeVersion"},
	"AWS/SageMaker":               {"EndpointName", "Host", "LabelingJobName", "VariantName"},
	"AWS/States":                  {"APIName", "ActivityArn", "LambdaFunctionArn", "StateMachineArn", "StateTransition"},
	"AWS/StorageGateway":          {"GatewayId", "GatewayName", "VolumeId"},
	"AWS/Textract":                {},
	"AWS/ThingsGraph":             {"FlowTemplateId", "StepName", "SystemTemplateId"},
	"AWS/TransitGateway":          {"TransitGateway", "TransitGatewayAttachment"},
	"AWS/Translate":               {"LanguagePair", "Operation"},
	"AWS/TrustedAdvisor":          {},
	"AWS/Usage":                   {"Class", "Resource", "Service", "Type"},
	"AWS/VPN":                     {"TunnelIpAddress", "VpnId"},
	"AWS/WAF":                     {"Region", "Rule", "RuleGroup", "WebACL"},
	"AWS/WAFV2":                   {"Region", "Rule", "RuleGroup", "WebACL"},
	"AWS/WorkSpaces":              {"DirectoryId", "WorkspaceId"},
	"ECS/ContainerInsights":       {"ClusterName", "ServiceName", "TaskDefinitionFamily", "EC2InstanceId", "ContainerInstanceId"},
	"ContainerInsights":           {"ClusterName", "NodeName", "Namespace", "InstanceId", "PodName", "Service"},
	"Rekognition":                 {},
	"AWS/Cassandra":               {"Keyspace", "Operation", "TableName"},
}

var regionCache sync.Map

func (e *cloudWatchExecutor) executeMetricFindQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	firstQuery := queryContext.Queries[0]

	parameters := firstQuery.Model
	subType := firstQuery.Model.Get("subtype").MustString()
	var data []suggestData
	var err error
	switch subType {
	case "regions":
		data, err = e.handleGetRegions(ctx, parameters, queryContext)
	case "namespaces":
		data, err = e.handleGetNamespaces(ctx, parameters, queryContext)
	case "metrics":
		data, err = e.handleGetMetrics(ctx, parameters, queryContext)
	case "dimension_keys":
		data, err = e.handleGetDimensions(ctx, parameters, queryContext)
	case "dimension_values":
		data, err = e.handleGetDimensionValues(ctx, parameters, queryContext)
	case "ebs_volume_ids":
		data, err = e.handleGetEbsVolumeIds(ctx, parameters, queryContext)
	case "ec2_instance_attribute":
		data, err = e.handleGetEc2InstanceAttribute(ctx, parameters, queryContext)
	case "resource_arns":
		data, err = e.handleGetResourceArns(ctx, parameters, queryContext)
	}
	if err != nil {
		return nil, err
	}

	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: firstQuery.RefId}
	transformToTable(data, queryResult)
	result := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			firstQuery.RefId: queryResult,
		},
	}
	return result, nil
}

func transformToTable(data []suggestData, result *tsdb.QueryResult) {
	table := &tsdb.Table{
		Columns: []tsdb.TableColumn{
			{
				Text: "text",
			},
			{
				Text: "value",
			},
		},
		Rows: make([]tsdb.RowValues, 0),
	}

	for _, r := range data {
		values := []interface{}{
			r.Text,
			r.Value,
		}
		table.Rows = append(table.Rows, values)
	}
	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", len(data))
}

func parseMultiSelectValue(input string) []string {
	trimmedInput := strings.TrimSpace(input)
	if strings.HasPrefix(trimmedInput, "{") {
		values := strings.Split(strings.TrimRight(strings.TrimLeft(trimmedInput, "{"), "}"), ",")
		trimmedValues := make([]string, len(values))
		for i, v := range values {
			trimmedValues[i] = strings.TrimSpace(v)
		}
		return trimmedValues
	}

	return []string{trimmedInput}
}

// Whenever this list is updated, the frontend list should also be updated.
// Please update the region list in public/app/plugins/datasource/cloudwatch/partials/config.html
func (e *cloudWatchExecutor) handleGetRegions(ctx context.Context, parameters *simplejson.Json,
	queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	dsInfo := e.getDSInfo(defaultRegion)
	profile := dsInfo.Profile
	if cache, ok := regionCache.Load(profile); ok {
		if cache2, ok2 := cache.([]suggestData); ok2 {
			return cache2, nil
		}
	}

	client, err := e.getEC2Client(defaultRegion)
	if err != nil {
		return nil, err
	}
	regions := knownRegions
	r, err := client.DescribeRegions(&ec2.DescribeRegionsInput{})
	if err != nil {
		// ignore error for backward compatibility
		plog.Error("Failed to get regions", "error", err)
	} else {
		for _, region := range r.Regions {
			exists := false

			for _, existingRegion := range regions {
				if existingRegion == *region.RegionName {
					exists = true
					break
				}
			}

			if !exists {
				regions = append(regions, *region.RegionName)
			}
		}
	}
	sort.Strings(regions)

	result := make([]suggestData, 0)
	for _, region := range regions {
		result = append(result, suggestData{Text: region, Value: region})
	}
	regionCache.Store(profile, result)

	return result, nil
}

func (e *cloudWatchExecutor) handleGetNamespaces(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	keys := []string{}
	for key := range metricsMap {
		keys = append(keys, key)
	}
	customNamespaces := e.DataSource.JsonData.Get("customMetricsNamespaces").MustString()
	if customNamespaces != "" {
		keys = append(keys, strings.Split(customNamespaces, ",")...)
	}
	sort.Strings(keys)

	result := make([]suggestData, 0)
	for _, key := range keys {
		result = append(result, suggestData{Text: key, Value: key})
	}

	return result, nil
}

func (e *cloudWatchExecutor) handleGetMetrics(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	namespace := parameters.Get("namespace").MustString()

	var namespaceMetrics []string
	if !isCustomMetrics(namespace) {
		var exists bool
		if namespaceMetrics, exists = metricsMap[namespace]; !exists {
			return nil, fmt.Errorf("unable to find namespace %q", namespace)
		}
	} else {
		var err error
		if namespaceMetrics, err = e.getMetricsForCustomMetrics(region, namespace); err != nil {
			return nil, errutil.Wrap("unable to call AWS API", err)
		}
	}
	sort.Strings(namespaceMetrics)

	result := make([]suggestData, 0)
	for _, name := range namespaceMetrics {
		result = append(result, suggestData{Text: name, Value: name})
	}

	return result, nil
}

func (e *cloudWatchExecutor) handleGetDimensions(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	namespace := parameters.Get("namespace").MustString()

	var dimensionValues []string
	if !isCustomMetrics(namespace) {
		var exists bool
		if dimensionValues, exists = dimensionsMap[namespace]; !exists {
			return nil, fmt.Errorf("unable to find dimension %q", namespace)
		}
	} else {
		var err error
		if dimensionValues, err = e.getDimensionsForCustomMetrics(region, namespace); err != nil {
			return nil, errutil.Wrap("unable to call AWS API", err)
		}
	}
	sort.Strings(dimensionValues)

	result := make([]suggestData, 0)
	for _, name := range dimensionValues {
		result = append(result, suggestData{Text: name, Value: name})
	}

	return result, nil
}

func (e *cloudWatchExecutor) handleGetDimensionValues(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	namespace := parameters.Get("namespace").MustString()
	metricName := parameters.Get("metricName").MustString()
	dimensionKey := parameters.Get("dimensionKey").MustString()
	dimensionsJson := parameters.Get("dimensions").MustMap()

	var dimensions []*cloudwatch.DimensionFilter
	for k, v := range dimensionsJson {
		if vv, ok := v.(string); ok {
			dimensions = append(dimensions, &cloudwatch.DimensionFilter{
				Name:  aws.String(k),
				Value: aws.String(vv),
			})
		} else if vv, ok := v.([]interface{}); ok {
			for _, v := range vv {
				dimensions = append(dimensions, &cloudwatch.DimensionFilter{
					Name:  aws.String(k),
					Value: aws.String(v.(string)),
				})
			}
		}
	}

	metrics, err := e.cloudwatchListMetrics(region, namespace, metricName, dimensions)
	if err != nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	dupCheck := make(map[string]bool)
	for _, metric := range metrics.Metrics {
		for _, dim := range metric.Dimensions {
			if *dim.Name == dimensionKey {
				if _, exists := dupCheck[*dim.Value]; exists {
					continue
				}

				dupCheck[*dim.Value] = true
				result = append(result, suggestData{Text: *dim.Value, Value: *dim.Value})
			}
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Text < result[j].Text
	})

	return result, nil
}

func (e *cloudWatchExecutor) handleGetEbsVolumeIds(ctx context.Context, parameters *simplejson.Json,
	queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	instanceId := parameters.Get("instanceId").MustString()

	instanceIds := aws.StringSlice(parseMultiSelectValue(instanceId))
	instances, err := e.ec2DescribeInstances(region, nil, instanceIds)
	if err != nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	for _, reservation := range instances.Reservations {
		for _, instance := range reservation.Instances {
			for _, mapping := range instance.BlockDeviceMappings {
				result = append(result, suggestData{Text: *mapping.Ebs.VolumeId, Value: *mapping.Ebs.VolumeId})
			}
		}
	}

	return result, nil
}

func (e *cloudWatchExecutor) handleGetEc2InstanceAttribute(ctx context.Context, parameters *simplejson.Json,
	queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	attributeName := parameters.Get("attributeName").MustString()
	filterJson := parameters.Get("filters").MustMap()

	var filters []*ec2.Filter
	for k, v := range filterJson {
		if vv, ok := v.([]interface{}); ok {
			var values []*string
			for _, vvv := range vv {
				if vvvv, ok := vvv.(string); ok {
					values = append(values, &vvvv)
				}
			}
			filters = append(filters, &ec2.Filter{
				Name:   aws.String(k),
				Values: values,
			})
		}
	}

	instances, err := e.ec2DescribeInstances(region, filters, nil)
	if err != nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	dupCheck := make(map[string]bool)
	for _, reservation := range instances.Reservations {
		for _, instance := range reservation.Instances {
			tags := make(map[string]string)
			for _, tag := range instance.Tags {
				tags[*tag.Key] = *tag.Value
			}

			var data string
			if strings.Index(attributeName, "Tags.") == 0 {
				tagName := attributeName[5:]
				data = tags[tagName]
			} else {
				attributePath := strings.Split(attributeName, ".")
				v := reflect.ValueOf(instance)
				for _, key := range attributePath {
					if v.Kind() == reflect.Ptr {
						v = v.Elem()
					}
					if v.Kind() != reflect.Struct {
						return nil, errors.New("invalid attribute path")
					}
					v = v.FieldByName(key)
					if !v.IsValid() {
						return nil, errors.New("invalid attribute path")
					}
				}
				if attr, ok := v.Interface().(*string); ok {
					data = *attr
				} else if attr, ok := v.Interface().(*time.Time); ok {
					data = attr.String()
				} else {
					return nil, errors.New("invalid attribute path")
				}
			}

			if _, exists := dupCheck[data]; exists {
				continue
			}

			dupCheck[data] = true
			result = append(result, suggestData{Text: data, Value: data})
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Text < result[j].Text
	})

	return result, nil
}

func (e *cloudWatchExecutor) handleGetResourceArns(ctx context.Context, parameters *simplejson.Json,
	queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	resourceType := parameters.Get("resourceType").MustString()
	filterJson := parameters.Get("tags").MustMap()

	var filters []*resourcegroupstaggingapi.TagFilter
	for k, v := range filterJson {
		if vv, ok := v.([]interface{}); ok {
			var values []*string
			for _, vvv := range vv {
				if vvvv, ok := vvv.(string); ok {
					values = append(values, &vvvv)
				}
			}
			filters = append(filters, &resourcegroupstaggingapi.TagFilter{
				Key:    aws.String(k),
				Values: values,
			})
		}
	}

	var resourceTypes []*string
	resourceTypes = append(resourceTypes, &resourceType)

	resources, err := e.resourceGroupsGetResources(region, filters, resourceTypes)
	if err != nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	for _, resource := range resources.ResourceTagMappingList {
		data := *resource.ResourceARN
		result = append(result, suggestData{Text: data, Value: data})
	}

	return result, nil
}

func (e *cloudWatchExecutor) cloudwatchListMetrics(region string, namespace string, metricName string,
	dimensions []*cloudwatch.DimensionFilter) (*cloudwatch.ListMetricsOutput, error) {
	svc, err := e.getCWClient(region)
	if err != nil {
		return nil, err
	}

	params := &cloudwatch.ListMetricsInput{
		Namespace:  aws.String(namespace),
		Dimensions: dimensions,
	}

	if metricName != "" {
		params.MetricName = aws.String(metricName)
	}

	var resp cloudwatch.ListMetricsOutput
	if err := svc.ListMetricsPages(params,
		func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
			metrics.MAwsCloudWatchListMetrics.Inc()
			metrics, _ := awsutil.ValuesAtPath(page, "Metrics")
			for _, metric := range metrics {
				resp.Metrics = append(resp.Metrics, metric.(*cloudwatch.Metric))
			}
			return !lastPage
		}); err != nil {
		return nil, fmt.Errorf("failed to call cloudwatch:ListMetrics: %w", err)
	}

	return &resp, nil
}

func (e *cloudWatchExecutor) ec2DescribeInstances(region string, filters []*ec2.Filter, instanceIds []*string) (*ec2.DescribeInstancesOutput, error) {
	params := &ec2.DescribeInstancesInput{
		Filters:     filters,
		InstanceIds: instanceIds,
	}

	client, err := e.getEC2Client(region)
	if err != nil {
		return nil, err
	}

	var resp ec2.DescribeInstancesOutput
	if err := client.DescribeInstancesPages(params, func(page *ec2.DescribeInstancesOutput, lastPage bool) bool {
		resp.Reservations = append(resp.Reservations, page.Reservations...)
		return !lastPage
	}); err != nil {
		return nil, fmt.Errorf("failed to call ec2:DescribeInstances, %w", err)
	}

	return &resp, nil
}

func (e *cloudWatchExecutor) resourceGroupsGetResources(region string, filters []*resourcegroupstaggingapi.TagFilter,
	resourceTypes []*string) (*resourcegroupstaggingapi.GetResourcesOutput, error) {
	params := &resourcegroupstaggingapi.GetResourcesInput{
		ResourceTypeFilters: resourceTypes,
		TagFilters:          filters,
	}

	client, err := e.getRGTAClient(region)
	if err != nil {
		return nil, err
	}

	var resp resourcegroupstaggingapi.GetResourcesOutput
	if err := client.GetResourcesPages(params,
		func(page *resourcegroupstaggingapi.GetResourcesOutput, lastPage bool) bool {
			resp.ResourceTagMappingList = append(resp.ResourceTagMappingList, page.ResourceTagMappingList...)
			return !lastPage
		}); err != nil {
		return nil, fmt.Errorf("failed to call tag:GetResources, %w", err)
	}

	return &resp, nil
}

func (e *cloudWatchExecutor) getAllMetrics(region, namespace string) (cloudwatch.ListMetricsOutput, error) {
	client, err := e.getCWClient(region)
	if err != nil {
		return cloudwatch.ListMetricsOutput{}, err
	}

	params := &cloudwatch.ListMetricsInput{
		Namespace: aws.String(namespace),
	}

	plog.Debug("Listing metrics pages")
	var resp cloudwatch.ListMetricsOutput
	err = client.ListMetricsPages(params, func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
		metrics.MAwsCloudWatchListMetrics.Inc()
		metrics, err := awsutil.ValuesAtPath(page, "Metrics")
		if err != nil {
			return !lastPage
		}

		for _, metric := range metrics {
			resp.Metrics = append(resp.Metrics, metric.(*cloudwatch.Metric))
		}
		return !lastPage
	})

	return resp, err
}

var metricsCacheLock sync.Mutex

func (e *cloudWatchExecutor) getMetricsForCustomMetrics(region, namespace string) ([]string, error) {
	plog.Debug("Getting metrics for custom metrics", "region", region, "namespace", namespace)
	metricsCacheLock.Lock()
	defer metricsCacheLock.Unlock()

	dsInfo := e.getDSInfo(region)

	if _, ok := customMetricsMetricsMap[dsInfo.Profile]; !ok {
		customMetricsMetricsMap[dsInfo.Profile] = make(map[string]map[string]*customMetricsCache)
	}
	if _, ok := customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region]; !ok {
		customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region] = make(map[string]*customMetricsCache)
	}
	if _, ok := customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace]; !ok {
		customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace] = &customMetricsCache{}
		customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache = make([]string, 0)
	}

	if customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Expire.After(time.Now()) {
		return customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache, nil
	}
	result, err := e.getAllMetrics(region, namespace)
	if err != nil {
		return []string{}, err
	}

	customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache = make([]string, 0)
	customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Expire = time.Now().Add(5 * time.Minute)

	for _, metric := range result.Metrics {
		if isDuplicate(customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache, *metric.MetricName) {
			continue
		}
		customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache = append(
			customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache, *metric.MetricName)
	}

	return customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache, nil
}

var dimensionsCacheLock sync.Mutex

func (e *cloudWatchExecutor) getDimensionsForCustomMetrics(region, namespace string) ([]string, error) {
	dimensionsCacheLock.Lock()
	defer dimensionsCacheLock.Unlock()

	dsInfo := e.getDSInfo(region)

	if _, ok := customMetricsDimensionsMap[dsInfo.Profile]; !ok {
		customMetricsDimensionsMap[dsInfo.Profile] = make(map[string]map[string]*customMetricsCache)
	}
	if _, ok := customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region]; !ok {
		customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region] = make(map[string]*customMetricsCache)
	}
	if _, ok := customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace]; !ok {
		customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace] = &customMetricsCache{}
		customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache = make([]string, 0)
	}

	if customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Expire.After(time.Now()) {
		return customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache, nil
	}
	result, err := e.getAllMetrics(region, namespace)
	if err != nil {
		return []string{}, err
	}
	customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache = make([]string, 0)
	customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Expire = time.Now().Add(5 * time.Minute)

	for _, metric := range result.Metrics {
		for _, dimension := range metric.Dimensions {
			if isDuplicate(customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache, *dimension.Name) {
				continue
			}
			customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache = append(
				customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache, *dimension.Name)
		}
	}

	return customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][namespace].Cache, nil
}

func isDuplicate(nameList []string, target string) bool {
	for _, name := range nameList {
		if name == target {
			return true
		}
	}
	return false
}

func isCustomMetrics(namespace string) bool {
	return strings.Index(namespace, "AWS/") != 0
}
