package main

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/russross/blackfriday.v2"
)

func removeDuplicates(e []string) []string {
	result := []string{}

	found := map[string]bool{}
	for v := range e {
		if !found[e[v]] {
			found[e[v]] = true
			result = append(result, e[v])
		}
	}
	return result
}

func main() {
	// https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/aws-services-cloudwatch-metrics.html
	urlMaps := map[string][]string{
		"AWS/ApiGateway": {"https://github.com/awsdocs/amazon-api-gateway-developer-guide/tree/master/doc_source/api-gateway-metrics-and-dimensions.md"},
		"AWS/AppStream":  {"https://github.com/awsdocs/amazon-appstream2-developer-guide/tree/master/doc_source/monitoring.md"},
		"AWS/Athena":     {"https://github.com/awsdocs/amazon-athena-user-guide/tree/master/doc_source/query-metrics-viewing.md"},
		//"AWS/Billing": {"https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html"},
		//"AWS/ACMPrivateCA": {"https://docs.aws.amazon.com/acm-pca/latest/userguide/PcaCloudWatch.html"},
		"AWS/CloudFront":  {"https://github.com/awsdocs/amazon-cloudfront-developer-guide/tree/master/doc_source/monitoring-using-cloudwatch.md"},
		"AWS/CloudSearch": {"https://github.com/awsdocs/amazon-cloudsearch-developer-guide/tree/master/doc_source/cloudwatch-monitoring.md"},
		"AWS/Events":      {"https://github.com/awsdocs/amazon-cloudwatch-events-user-guide/tree/master/doc_source/CloudWatch-Events-Monitoring-CloudWatch-Metrics.md"},
		"AWS/Logs":        {"https://github.com/awsdocs/amazon-cloudwatch-logs-user-guide/tree/master/doc_source/CloudWatch-Logs-Monitoring-CloudWatch-Metrics.md"},
		"AWS/CodeBuild":   {"https://github.com/awsdocs/aws-codebuild-user-guide/tree/master/doc_source/monitoring-builds.md"},
		//"AWS/Cognito": {"https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-viewing-advanced-security-metrics.html"},
		//"AWS/Connect": {"https://docs.aws.amazon.com/connect/latest/adminguide/monitoring-cloudwatch.html"},
		//"AWS/DMS": {"https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Monitoring.html"},
		"AWS/DX":          {"https://docs.aws.amazon.com/directconnect/latest/UserGuide/monitoring-cloudwatch.html"},
		"AWS/DynamoDB":    {"https://github.com/awsdocs/amazon-dynamodb-developer-guide/tree/master/doc_source/metrics-dimensions.md"},
		"AWS/EC2":         {"https://github.com/awsdocs/amazon-ec2-user-guide/tree/master/doc_source/viewing_metrics_with_cloudwatch.md"},
		"AWS/EC2Spot":     {"https://github.com/awsdocs/amazon-ec2-user-guide/tree/master/doc_source/spot-fleet-cloudwatch-metrics.md"},
		"AWS/AutoScaling": {"https://github.com/awsdocs/amazon-ec2-auto-scaling-user-guide/tree/master/doc_source/as-instance-monitoring.md"},
		//"AWS/ElasticBeanstalk": {"https://github.com/awsdocs/aws-elastic-beanstalk-developer-guide/tree/master/doc_source/health-enhanced-cloudwatch.md"},
		"AWS/EBS": {"https://github.com/awsdocs/amazon-ec2-user-guide/tree/master/doc_source/monitoring-volume-status.md"},
		"AWS/ECS": {"https://github.com/awsdocs/amazon-ecs-developer-guide/tree/master/doc_source/cloudwatch-metrics.md"},
		"AWS/EFS": {"https://github.com/awsdocs/amazon-efs-user-guide/tree/master/doc_source/monitoring-cloudwatch.md"},
		//"AWS/ElasticInference": {"https://github.com/awsdocs/amazon-ec2-user-guide/tree/master/doc_source/cloudwatch-metrics-ei.md"},
		"AWS/ApplicationELB":    {"https://github.com/awsdocs/elb-application-load-balancers-user-guide/tree/master/doc_source/load-balancer-cloudwatch-metrics.md"},
		"AWS/ELB":               {"https://github.com/awsdocs/elb-classic-load-balancers-user-guide/tree/master/doc_source/elb-cloudwatch-metrics.md"},
		"AWS/NetworkELB":        {"https://github.com/awsdocs/elb-network-load-balancers-user-guide/tree/master/doc_source/load-balancer-cloudwatch-metrics.md"},
		"AWS/ElasticTranscoder": {"https://github.com/awsdocs/amazon-transcoder-developer-guide/tree/master/doc_source/metrics-dimensions.md"},
		"AWS/ElastiCache": {
			"https://github.com/awsdocs/amazon-elasticache-docs/tree/master/doc_source/memcache/CacheMetrics.HostLevel.md",
			"https://github.com/awsdocs/amazon-elasticache-docs/tree/master/doc_source/memcache/CacheMetrics.Memcached.md",
			"https://github.com/awsdocs/amazon-elasticache-docs/tree/master/doc_source/redis/CacheMetrics.Redis.md",
		},
		"AWS/ES":               {"https://github.com/awsdocs/amazon-elasticsearch-service-developer-guide/tree/master/doc_source/es-managedomains.md"},
		"AWS/ElasticMapReduce": {"https://github.com/awsdocs/amazon-emr-management-guide/tree/master/doc_source/UsingEMR_ViewingMetrics.md"},
		//"AWS/MediaConnect": {"https://docs.aws.amazon.com/mediaconnect/latest/ug/monitor-with-cloudwatch-metrics.html"},
		"AWS/MediaConvert": {"https://github.com/awsdocs/aws-elemental-mediaconvert-user-guide/tree/master/doc_source/MediaConvert-metrics.md"},
		"AWS/MediaPackage": {"https://github.com/awsdocs/aws-elemental-mediapackage-user-guide/tree/master/doc_source/metrics.md"},
		"AWS/MediaTailor":  {"https://github.com/awsdocs/aws-elemental-mediatailor-user-guide/tree/master/doc_source/monitoring-cloudwatch.md"},
		"AWS/FSx":          {"https://github.com/awsdocs/amazon-fsx-lustre-user-guide/tree/master/doc_source/monitoring_overview.md"},
		//"AWS/GameLift": {"https://docs.aws.amazon.com/gamelift/latest/developerguide/monitoring-cloudwatch.html"},
		"AWS/Glue":      {"https://github.com/awsdocs/aws-glue-developer-guide/tree/master/doc_source/monitoring-awsglue-with-cloudwatch-metrics.md"},
		"AWS/Inspector": {"https://github.com/awsdocs/amazon-inspector-user-guide/tree/master/doc_source/using-cloudwatch.md"},
		//"AWS/IoT": {"https://docs.aws.amazon.com/iot/latest/developerguide/metrics_dimensions.html"},
		//"AWS/IoTAnalytics": {"https://docs.aws.amazon.com/iotanalytics/latest/userguide/cloudwatch.html#aws-iot-analytics-cloudwatch-metrics"},
		//"AWS/ThingsGraph": {"https://docs.aws.amazon.com/thingsgraph/latest/ug/iot-tg-metrics.html"},
		//"AWS/KMS": {"https://github.com/awsdocs/aws-kms-developer-guide/tree/master/doc_source/monitoring-cloudwatch.md"},
		"AWS/KinesisAnalytics": {"https://github.com/awsdocs/amazon-kinesis-data-analytics-developer-guide/tree/master/doc_source/monitoring-metrics.md"},
		"AWS/Firehose":         {"https://github.com/awsdocs/amazon-kinesis-data-firehose-developer-guide/tree/master/doc_source/monitoring-with-cloudwatch-metrics.md"},
		"AWS/Kinesis":          {"https://github.com/awsdocs/amazon-kinesis-data-streams-developer-guide/tree/master/doc_source/monitoring-with-cloudwatch.md"},
		"AWS/KinesisVideo":     {"https://github.com/awsdocs/AWS-Kinesis-Video-Documentation/tree/master/doc_source/monitoring-cloudwatch.md"},
		"AWS/Lambda":           {"https://github.com/awsdocs/aws-lambda-developer-guide/tree/master/doc_source/monitoring-functions-metrics.md"},
		"AWS/Lex":              {"https://github.com/awsdocs/amazon-lex-developer-guide/tree/master/doc_source/monitoring-aws-lex-cloudwatch.md"},
		//"AWS/ML": {"https://docs.aws.amazon.com/machine-learning/latest/dg/cw-doc.html"},
		//"AWS/Kafka": {"https://docs.aws.amazon.com/msk/latest/developerguide/monitoring.html"},
		"AWS/AmazonMQ": {"https://github.com/awsdocs/amazon-mq-developer-guide/tree/master/doc_source/amazon-mq-monitoring-cloudwatch.md"},
		//"AWS/Neptune": {"https://docs.aws.amazon.com/neptune/latest/userguide/cloudwatch.html"},
		"AWS/OpsWorks": {"https://github.com/awsdocs/aws-opsworks-user-guide/tree/master/doc_source/monitoring-cloudwatch.md"},
		"AWS/Polly":    {"https://github.com/awsdocs/amazon-polly-developer-guide/tree/master/doc_source/cloud-watch.md"},
		"AWS/Redshift": {"https://github.com/awsdocs/amazon-redshift-management-guide/tree/master/doc_source/metrics-listing.md"},
		"AWS/RDS": {
			"https://github.com/awsdocs/amazon-rds-user-guide/tree/master/doc_source/MonitoringOverview.md",
			"https://github.com/awsdocs/amazon-aurora-user-guide/blob/master/doc_source/Aurora.Monitoring.md",
		},
		//"AWS/Route53": {"https://github.com/awsdocs/amazon-route53-docs/tree/master/doc_source/monitoring-cloudwatch.md"},
		"AWS/SageMaker":      {"https://github.com/awsdocs/amazon-sagemaker-developer-guide/tree/master/doc_source/monitoring-cloudwatch.md"},
		"AWS/DDoSProtection": {"https://github.com/awsdocs/aws-waf-and-shield-advanced-developer-guide/tree/master/doc_source/monitoring-cloudwatch.md"},
		//"AWS/SES": {"https://github.com/awsdocs/amazon-ses-developer-guide/tree/master/doc-source/event-publishing-retrieving-cloudwatch.md"},
		//"AWS/SNS": {"https://docs.aws.amazon.com/sns/latest/dg/sns-monitoring-using-cloudwatch.html"},
		"AWS/SQS": {"https://github.com/awsdocs/amazon-sqs-developer-guide/tree/master/doc_source/sqs-available-cloudwatch-metrics.md"},
		"AWS/S3":  {"https://github.com/awsdocs/amazon-s3-developer-guide/tree/master/doc_source/cloudwatch-monitoring.md"},
		//"AWS/SWF": {"https://docs.aws.amazon.com/amazonswf/latest/developerguide/cw-metrics.html"},
		"AWS/States":         {"https://github.com/awsdocs/aws-step-functions-developer-guide/tree/master/doc_source/procedure-cw-metrics.md"},
		"AWS/StorageGateway": {"https://github.com/awsdocs/aws-storagegateway-user-guide/tree/master/doc_source/Main_monitoring-gateways-common.md"},
		//"AWS/Textract": {"https://docs.aws.amazon.com/textract/latest/dg/cloudwatch-metricsdim.html"},
		"AWS/Translate": {"https://github.com/awsdocs/amazon-translate-developer-guide/tree/master/doc_source/translate-cloudwatch.md"},
		//"AWS/TrustedAdvisor": {"https://github.com/awsdocs/aws-support-user-guide/tree/master/doc_source/cloudwatch-metrics-ta.md"},
		"AWS/NATGateway":     {"https://github.com/awsdocs/amazon-vpc-user-guide/tree/master/doc_source/vpc-nat-gateway-cloudwatch.md"},
		"AWS/TransitGateway": {"https://github.com/awsdocs/aws-transit-gateway-guide/tree/master/doc_source/transit-gateway-cloudwatch-metrics.md"},
		"AWS/VPN":            {"https://github.com/awsdocs/aws-site-to-site-vpn-user-guide/tree/master/doc_source/monitoring-cloudwatch-vpn.md"},
		"WAF":                {"https://github.com/awsdocs/aws-waf-and-shield-advanced-developer-guide/tree/master/doc_source/monitoring-cloudwatch.md"},
		"AWS/WorkSpaces":     {"https://github.com/awsdocs/amazon-workspaces-administration-guide/tree/master/doc_source/cloudwatch-metrics.md"},
		"Rekognition":        {"https://github.com/awsdocs/amazon-rekognition-developer-guide/blob/master/doc_source/cloudwatch-metricsdim.md"},
		//"AWS/EC2/API": {"https://docs.aws.amazon.com/AWSEC2/latest/APIReference/monitor.html"},
	}

	result := make(map[string]map[string][]string)
	result["AWS/AmazonMQ"] = map[string][]string{
		"metrics":    []string{"InflightCount"},
		"dimensions": []string{},
	}
	result["AWS/AppSync"] = map[string][]string{
		"metrics":    []string{"4XXError", "5XXError", "Latency"},
		"dimensions": []string{"GraphQLAPIId"},
	}
	result["AWS/AutoScaling"] = map[string][]string{
		"metrics":    []string{},
		"dimensions": []string{"AutoScalingGroupName"},
	}
	result["AWS/Billing"] = map[string][]string{
		"metrics":    []string{"EstimatedCharges"},
		"dimensions": []string{"Currency", "LinkedAccount", "ServiceName"},
	}
	result["AWS/CloudHSM"] = map[string][]string{
		"metrics":    []string{"HsmKeysSessionOccupied", "HsmKeysTokenOccupied", "HsmSessionCount", "HsmSslCtxsOccupied", "HsmTemperature", "HsmUnhealthy", "HsmUsersAvailable", "HsmUsersMax", "InterfaceEth2OctetsInput", "InterfaceEth2OctetsOutput"},
		"dimensions": []string{"ClusterId", "HsmId", "Region"},
	}
	result["AWS/Connect"] = map[string][]string{
		"metrics":    []string{"CallBackNotDialableNumber", "CallRecordingUploadError", "CallsBreachingConcurrencyQuota", "CallsPerInterval", "ConcurrentCalls", "ConcurrentCallsPercentage", "ContactFlowErrors", "ContactFlowFatalErrors", "LongestQueueWaitTime", "MisconfiguredPhoneNumbers", "MissedCalls", "PublicSigningKeyUsage", "QueueCapacityExceededError", "QueueSize", "ThrottledCalls", "ToInstancePacketLossRate"},
		"dimensions": []string{"InstanceId", "MetricGroup", "Participant", "QueueName", "Stream Type", "Type of Connection"},
	}
	result["AWS/DMS"] = map[string][]string{
		"metrics":    []string{"CDCChangesDiskSource", "CDCChangesDiskTarget", "CDCChangesMemorySource", "CDCChangesMemoryTarget", "CDCIncomingChanges", "CDCLatencySource", "CDCLatencyTarget", "CDCThroughputBandwidthTarget", "CDCThroughputRowsSource", "CDCThroughputRowsTarget", "FreeableMemory", "FullLoadThroughputBandwidthSource", "FullLoadThroughputBandwidthTarget", "FullLoadThroughputRowsSource", "FullLoadThroughputRowsTarget", "NetworkReceiveThroughput", "NetworkTransmitThroughput", "ReadIOPS", "ReadLatency", "ReadThroughput", "SwapUsage", "WriteIOPS", "WriteLatency", "WriteThroughput"},
		"dimensions": []string{"ReplicationInstanceIdentifier", "ReplicationTaskIdentifier"},
	}
	result["AWS/DX"] = map[string][]string{
		"metrics":    []string{"ConnectionBpsEgress", "ConnectionBpsIngress", "ConnectionCRCErrorCount", "ConnectionLightLevelRx", "ConnectionLightLevelTx", "ConnectionPpsEgress", "ConnectionPpsIngress", "ConnectionState"},
		"dimensions": []string{"ConnectionId"},
	}
	result["AWS/EBS"] = map[string][]string{
		"metrics":    []string{},
		"dimensions": []string{"VolumeId"},
	}
	result["AWS/EC2/API"] = map[string][]string{
		"metrics":    []string{"ClientErrors", "RequestLimitExceeded", "ServerErrors", "SuccessfulCalls"},
		"dimensions": []string{},
	}
	result["AWS/EFS"] = map[string][]string{
		"metrics":    []string{},
		"dimensions": []string{"FileSystemId"},
	}
	result["AWS/ElastiCache"] = map[string][]string{
		"metrics":    []string{"CurrConnections", "CurrItems", "Evictions", "NewConnections", "Reclaimed"},
		"dimensions": []string{"CacheClusterId", "CacheNodeId"},
	}
	result["AWS/ElasticBeanstalk"] = map[string][]string{
		"metrics":    []string{"ApplicationLatencyP10", "ApplicationLatencyP50", "ApplicationLatencyP75", "ApplicationLatencyP85", "ApplicationLatencyP90", "ApplicationLatencyP95", "ApplicationLatencyP99.9", "ApplicationLatencyP99", "ApplicationRequests2xx", "ApplicationRequests3xx", "ApplicationRequests4xx", "ApplicationRequests5xx", "ApplicationRequestsTotal", "CPUIdle", "CPUIowait", "CPUIrq", "CPUNice", "CPUSoftirq", "CPUSystem", "CPUUser", "EnvironmentHealth", "InstanceHealth", "InstancesDegraded", "InstancesInfo", "InstancesNoData", "InstancesOk", "InstancesPending", "InstancesSevere", "InstancesUnknown", "InstancesWarning", "LoadAverage1min", "LoadAverage5min", "RootFilesystemUtil"},
		"dimensions": []string{"EnvironmentName", "InstanceId"},
	}
	result["AWS/ElasticMapReduce"] = map[string][]string{
		"metrics":    []string{"CoreNodesPending", "CoreNodesRunning", "HDFSBytesRead", "HDFSBytesWritten", "HDFSUtilization", "IsIdle", "LiveDataNodes", "MissingBlocks", "MostRecentBackupDuration", "S3BytesRead", "S3BytesWritten", "TimeSinceLastSuccessfulBackup", "TotalLoad"},
		"dimensions": []string{"ClusterId"},
	}
	result["AWS/ES"] = map[string][]string{
		"metrics":    []string{},
		"dimensions": []string{"ClientId", "DomainName"},
	}
	result["AWS/Firehose"] = map[string][]string{
		"metrics":    []string{},
		"dimensions": []string{"DeliveryStreamName"},
	}
	result["AWS/IoT"] = map[string][]string{
		"metrics":    []string{"Connect.Success", "GetThingShadow.Accepted", "Ping.Success", "PublishIn.Success", "PublishOut.Success", "Subscribe.Success"},
		"dimensions": []string{"Protocol"},
	}
	result["AWS/Lambda"] = map[string][]string{
		"metrics":    []string{},
		"dimensions": []string{"Alias"},
	}
	result["AWS/KinesisAnalytics"] = map[string][]string{
		"metrics":    []string{},
		"dimensions": []string{"Application"},
	}
	result["AWS/KMS"] = map[string][]string{
		"metrics":    []string{"SecondsUntilKeyMaterialExpiration"},
		"dimensions": []string{"KeyId"},
	}
	result["AWS/ML"] = map[string][]string{
		"metrics":    []string{"PredictCount", "PredictFailureCount"},
		"dimensions": []string{"MLModelId", "RequestMode"},
	}
	result["AWS/Neptune"] = map[string][]string{
		"metrics":    []string{"ClusterReplicaLag", "ClusterReplicaLagMaximum", "ClusterReplicaLagMinimum", "CPUUtilization", "EngineUptime", "FreeableMemory", "FreeLocalStorage", "GremlinErrors", "GremlinHttp1xx", "GremlinHttp2xx", "GremlinHttp4xx", "GremlinHttp5xx", "GremlinRequests", "GremlinRequestsPerSec", "GremlinWebSocketAvailableConnections", "GremlinWebSocketClientErrors", "GremlinWebSocketServerErrors", "GremlinWebSocketSuccess", "Http100", "Http101", "Http1xx", "Http200", "Http2xx", "Http400", "Http403", "Http405", "Http413", "Http429", "Http4xx", "Http500", "Http501", "Http5xx", "LoaderErrors", "LoaderRequests", "NetworkReceiveThroughput", "NetworkThroughput", "NetworkTransmitThroughput", "SparqlErrors", "SparqlHttp1xx", "SparqlHttp2xx", "SparqlHttp4xx", "SparqlHttp5xx", "SparqlRequests", "SparqlRequestsPerSec", "StatusErrors", "StatusRequests", "VolumeBytesUsed", "VolumeReadIOPs", "VolumeWriteIOPs"},
		"dimensions": []string{"DatabaseClass", "DBClusterIdentifier", "EngineName", "Role"},
	}
	result["AWS/RDS"] = map[string][]string{
		"metrics":    []string{"ActiveTransactions", "AuroraBinlogReplicaLag", "AuroraReplicaLag", "AuroraReplicaLagMaximum", "AuroraReplicaLagMinimum", "BinLogDiskUsage", "BlockedTransactions", "BufferCacheHitRatio", "CommitLatency", "CommitThroughput", "DDLLatency", "DDLThroughput", "Deadlocks", "DeleteLatency", "DeleteThroughput", "DMLLatency", "DMLThroughput", "EngineUptime", "FailedSqlStatements", "FreeLocalStorage", "InsertLatency", "InsertThroughput", "LoginFailures", "NetworkThroughput", "Queries", "ResultSetCacheHitRatio", "SelectLatency", "SelectThroughput", "ServerlessDatabaseCapacity", "TotalConnections", "UpdateLatency", "UpdateThroughput", "VolumeBytesUsed", "VolumeReadIOPS", "VolumeWriteIOPS"},
		"dimensions": []string{"DbClusterIdentifier"},
	}
	result["AWS/Redshift"] = map[string][]string{
		"metrics":    []string{"QueryRuntimeBreakdown"},
		"dimensions": []string{},
	}
	result["AWS/Route53"] = map[string][]string{
		"metrics":    []string{"ChildHealthCheckHealthyCount", "ConnectionTime", "HealthCheckPercentageHealthy", "HealthCheckStatus", "SSLHandshakeTime", "TimeToFirstByte"},
		"dimensions": []string{"HealthCheckId", "Region"},
	}
	result["AWS/SES"] = map[string][]string{
		"metrics":    []string{"Bounce", "Complaint", "Delivery", "Reject", "Reputation.BounceRate", "Reputation.ComplaintRate", "Send"},
		"dimensions": []string{},
	}
	result["AWS/SNS"] = map[string][]string{
		"metrics":    []string{"NumberOfMessagesPublished", "NumberOfNotificationsDelivered", "NumberOfNotificationsFailed", "PublishSize"},
		"dimensions": []string{"Application", "Platform", "TopicName"},
	}
	result["AWS/SQS"] = map[string][]string{
		"metrics":    []string{},
		"dimensions": []string{"QueueName"},
	}
	result["AWS/States"] = map[string][]string{
		"metrics":    []string{"ActivitiesScheduled"},
		"dimensions": []string{},
	}
	result["AWS/StorageGateway"] = map[string][]string{
		"metrics":    []string{"CacheHitPercent", "CachePercentDirty", "CachePercentUsed", "QueuedWrites", "ReadBytes", "ReadTime", "WriteBytes", "WriteTime"},
		"dimensions": []string{},
	}
	result["AWS/SWF"] = map[string][]string{
		"metrics":    []string{"ActivityTasksCanceled", "ActivityTaskScheduleToCloseTime", "ActivityTaskScheduleToStartTime", "ActivityTasksCompleted", "ActivityTasksFailed", "ActivityTaskStartToCloseTime", "DecisionTaskScheduleToStartTime", "DecisionTasksCompleted", "DecisionTaskStartToCloseTime", "ScheduledActivityTasksTimedOutOnClose", "ScheduledActivityTasksTimedOutOnStart", "StartedActivityTasksTimedOutOnClose", "StartedActivityTasksTimedOutOnHeartbeat", "StartedDecisionTasksTimedOutOnClose", "WorkflowsCanceled", "WorkflowsCompleted", "WorkflowsContinuedAsNew", "WorkflowsFailed", "WorkflowStartToCloseTime", "WorkflowsTerminated", "WorkflowsTimedOut"},
		"dimensions": []string{"ActivityTypeName", "ActivityTypeVersion", "Domain", "WorkflowTypeName", "WorkflowTypeVersion"},
	}
	result["Rekognition"] = map[string][]string{
		"metrics":    []string{"DetectedFaceCount", "DetectedLabelCount", "ResponseTime", "ServerErrorCount", "SuccessfulRequestCount", "ThrottledCount", "UserErrorCount"},
		"dimensions": []string{},
	}

	for namespace, urls := range urlMaps {
		for _, url := range urls {
			url = strings.Replace(url, "github.com", "raw.githubusercontent.com", 1)
			url = strings.Replace(url, "tree/", "", 1)
			resp, err := http.Get(url)
			if err != nil {
				panic(err)
			}
			defer resp.Body.Close()

			md, _ := ioutil.ReadAll(resp.Body)

			md = bytes.Replace(md, []byte(" \n"), []byte("\n"), -1)
			parser := blackfriday.New(blackfriday.WithExtensions(blackfriday.CommonExtensions))
			ast := parser.Parse(md)

			ast.Walk(func(node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
				if node.Type == blackfriday.Table {
					foundType := ""
					metrics := []string{}
					dimensions := []string{}

					t := node.FirstChild
					if t.Type == blackfriday.TableHead {
						for r := t.FirstChild; r != nil; r = r.Next {
							var buf []byte
							r.FirstChild.Walk(func(node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
								buf = append(buf, node.Literal...)
								return blackfriday.GoToNext
							})
							if string(buf) == "Metric" {
								foundType = "metric"
								break
							}
							if string(buf) == "Dimension" || string(buf) == "Dimensions" {
								foundType = "dimension"
								break
							}
						}
					}

					if foundType == "" {
						return blackfriday.SkipChildren
					}

					t = node.FirstChild.Next
					if t.Type == blackfriday.TableBody {
						for r := t.FirstChild; r != nil; r = r.Next {
							var buf []byte
							r.FirstChild.Walk(func(node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
								buf = append(buf, node.Literal...)
								return blackfriday.GoToNext
							})
							if foundType == "metric" {
								if namespace == "AWS/WorkSpaces" {
									rep := regexp.MustCompile("[0-9]$")
									buf = rep.ReplaceAll(buf, []byte(""))
								}
								metrics = append(metrics, strings.Split(string(buf), ", ")...)
							} else if foundType == "dimension" {
								rep := regexp.MustCompile(`, | or `)
								dimensions = append(dimensions, rep.Split(string(buf), -1)...)
							}
						}
					}

					if len(metrics) > 0 || len(dimensions) > 0 {
						if _, ok := result[namespace]; !ok {
							result[namespace] = make(map[string][]string)
						}
						result[namespace]["metrics"] = append(result[namespace]["metrics"], metrics...)
						result[namespace]["dimensions"] = append(result[namespace]["dimensions"], dimensions...)
					}
					return blackfriday.SkipChildren
				}
				return blackfriday.GoToNext
			})

			for _, m := range result {
				sort.Strings(m["metrics"])
				sort.Strings(m["dimensions"])
				m["metrics"] = removeDuplicates(m["metrics"])
				m["dimensions"] = removeDuplicates(m["dimensions"])
			}
		}
	}

	namespaces := []string{}
	for namespace, _ := range result {
		namespaces = append(namespaces, namespace)
	}
	sort.Strings(namespaces)

	fmt.Printf("metricsMap = map[string][]string{\n")
	for _, namespace := range namespaces {
		fmt.Printf("  \"%s\": { ", namespace)
		for _, m := range result[namespace]["metrics"] {
			fmt.Printf("\"%s\", ", m)
		}
		fmt.Printf("},\n")
	}
	fmt.Printf("}\n")
	fmt.Printf("dimensionsMap = map[string][]string{\n")
	for _, namespace := range namespaces {
		fmt.Printf("  \"%s\": {", namespace)
		for _, d := range result[namespace]["dimensions"] {
			fmt.Printf("\"%s\", ", d)
		}
		fmt.Printf("},\n")
	}
	fmt.Printf("}\n")
}
