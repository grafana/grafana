package cloudwatch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/tsdb"
)

var metricsMap map[string][]string
var dimensionsMap map[string][]string

type suggestData struct {
	Text  string
	Value string
}

type CustomMetricsCache struct {
	Expire time.Time
	Cache  []string
}

var customMetricsMetricsMap map[string]map[string]map[string]*CustomMetricsCache
var customMetricsDimensionsMap map[string]map[string]map[string]*CustomMetricsCache

func init() {
	metricsMap = map[string][]string{
		"AWS/AmazonMQ":         {"InflightCount"},
		"AWS/DMS":              {"FreeableMemory", "WriteIOPS", "ReadIOPS", "WriteThroughput", "ReadThroughput", "WriteLatency", "ReadLatency", "SwapUsage", "NetworkTransmitThroughput", "NetworkReceiveThroughput", "FullLoadThroughputBandwidthSource", "FullLoadThroughputBandwidthTarget", "FullLoadThroughputRowsSource", "FullLoadThroughputRowsTarget", "CDCIncomingChanges", "CDCChangesMemorySource", "CDCChangesMemoryTarget", "CDCChangesDiskSource", "CDCChangesDiskTarget", "CDCThroughputBandwidthTarget", "CDCThroughputRowsSource", "CDCThroughputRowsTarget", "CDCLatencySource", "CDCLatencyTarget"},
		"AWS/EBS":              {"VolumeReadBytes", "VolumeWriteBytes", "VolumeReadOps", "VolumeWriteOps", "VolumeTotalReadTime", "VolumeTotalWriteTime", "VolumeIdleTime", "VolumeQueueLength", "VolumeThroughputPercentage", "VolumeConsumedReadWriteOps", "BurstBalance"},
		"AWS/ElasticBeanstalk": {"LoadAverage5min"},
		"AWS/RDS":              {"FailedSqlStatements", "TotalConnections", "VolumeReadIOPS", "VolumeWriteIOPS"},
		"Rekognition":          {"SuccessfulRequestCount", "ThrottledCount", "ResponseTime", "DetectedFaceCount", "DetectedLabelCount", "ServerErrorCount", "UserErrorCount"},
		"AWS/WorkSpaces":       {"Available", "Unhealthy", "ConnectionAttempt", "ConnectionSuccess", "ConnectionFailure", "SessionLaunchTime", "InSessionLatency", "SessionDisconnect"},
		"KMS":                  {"SecondsUntilKeyMaterialExpiration"},
	}
	dimensionsMap = map[string][]string{
		"AWS/AutoScaling":      {"AutoScalingGroupName"},
		"AWS/DMS":              {"ReplicationInstanceIdentifier", "ReplicationTaskIdentifier"},
		"AWS/EBS":              {"VolumeId"},
		"AWS/EFS":              {"FileSystemId"},
		"AWS/ElastiCache":      {"CacheClusterId", "CacheNodeId"},
		"AWS/ElasticMapReduce": {"ClusterId"},
		"AWS/Firehose":         {"DeliveryStreamName"},
		"AWS/KinesisAnalytics": {"Application"},
		"AWS/RDS":              {"DbClusterIdentifier"},
		"AWS/Route53":          {"HealthCheckId", "Region"},
		"AWS/SQS":              {"QueueName"},
		"KMS":                  {"KeyId"},
	}

	files, err := filepath.Glob("pkg/tsdb/cloudwatch/data/*.json")
	if err != nil {
		panic(err)
	}
	for _, file := range files {
		data, err := ioutil.ReadFile(file)
		if err != nil {
			panic(err)
		}

		var jsonData map[string]map[string][]string
		if err := json.Unmarshal(data, &jsonData); err != nil {
			continue
		}

		for namespace, v := range jsonData {
			for t, vv := range v {
				if t == "metrics" {
					metricsMap[namespace] = append(metricsMap[namespace], vv...)
					sort.Strings(metricsMap[namespace])
				} else if t == "dimensions" {
					dimensionsMap[namespace] = append(dimensionsMap[namespace], vv...)
					sort.Strings(dimensionsMap[namespace])
				}
			}
		}
	}

	customMetricsMetricsMap = make(map[string]map[string]map[string]*CustomMetricsCache)
	customMetricsDimensionsMap = make(map[string]map[string]map[string]*CustomMetricsCache)
}

func (e *CloudWatchExecutor) executeMetricFindQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	firstQuery := queryContext.Queries[0]
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: firstQuery.RefId}

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
	}

	transformToTable(data, queryResult)
	result.Results[firstQuery.RefId] = queryResult
	return result, err
}

func transformToTable(data []suggestData, result *tsdb.QueryResult) {
	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, 2),
		Rows:    make([]tsdb.RowValues, 0),
	}
	table.Columns[0].Text = "text"
	table.Columns[1].Text = "value"

	for _, r := range data {
		values := make([]interface{}, 2)
		values[0] = r.Text
		values[1] = r.Value
		table.Rows = append(table.Rows, values)
	}
	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", len(data))
}

func parseMultiSelectValue(input string) []string {
	trimmedInput := strings.TrimSpace(input)

	if strings.HasPrefix(trimmedInput, "{") {
		values := strings.Split(strings.TrimRight(strings.TrimLeft(trimmedInput, "{"), "}"), ",")
		trimValues := make([]string, len(values))
		for i, v := range values {
			trimValues[i] = strings.TrimSpace(v)
		}
		return trimValues
	}
	return []string{trimmedInput}
}

// Whenever this list is updated, frontend list should also be updated.
// Please update the region list in public/app/plugins/datasource/cloudwatch/partials/config.html
func (e *CloudWatchExecutor) handleGetRegions(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	regions := []string{
		"ap-northeast-1", "ap-northeast-2", "ap-southeast-1", "ap-southeast-2", "ap-south-1", "ca-central-1", "cn-north-1", "cn-northwest-1",
		"eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "sa-east-1", "us-east-1", "us-east-2", "us-gov-west-1", "us-west-1", "us-west-2",
	}

	result := make([]suggestData, 0)
	for _, region := range regions {
		result = append(result, suggestData{Text: region, Value: region})
	}

	return result, nil
}

func (e *CloudWatchExecutor) handleGetNamespaces(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
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

func (e *CloudWatchExecutor) handleGetMetrics(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	namespace := parameters.Get("namespace").MustString()

	var namespaceMetrics []string
	if !isCustomMetrics(namespace) {
		var exists bool
		if namespaceMetrics, exists = metricsMap[namespace]; !exists {
			return nil, errors.New("Unable to find namespace " + namespace)
		}
	} else {
		var err error
		dsInfo := e.getDsInfo(region)
		dsInfo.Namespace = namespace

		if namespaceMetrics, err = getMetricsForCustomMetrics(dsInfo, getAllMetrics); err != nil {
			return nil, errors.New("Unable to call AWS API")
		}
	}
	sort.Strings(namespaceMetrics)

	result := make([]suggestData, 0)
	for _, name := range namespaceMetrics {
		result = append(result, suggestData{Text: name, Value: name})
	}

	return result, nil
}

func (e *CloudWatchExecutor) handleGetDimensions(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	namespace := parameters.Get("namespace").MustString()

	var dimensionValues []string
	if !isCustomMetrics(namespace) {
		var exists bool
		if dimensionValues, exists = dimensionsMap[namespace]; !exists {
			return nil, errors.New("Unable to find dimension " + namespace)
		}
	} else {
		var err error
		dsInfo := e.getDsInfo(region)
		dsInfo.Namespace = namespace

		if dimensionValues, err = getDimensionsForCustomMetrics(dsInfo, getAllMetrics); err != nil {
			return nil, errors.New("Unable to call AWS API")
		}
	}
	sort.Strings(dimensionValues)

	result := make([]suggestData, 0)
	for _, name := range dimensionValues {
		result = append(result, suggestData{Text: name, Value: name})
	}

	return result, nil
}

func (e *CloudWatchExecutor) handleGetDimensionValues(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
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

func (e *CloudWatchExecutor) ensureClientSession(region string) error {
	if e.ec2Svc == nil {
		dsInfo := e.getDsInfo(region)
		cfg, err := e.getAwsConfig(dsInfo)
		if err != nil {
			return fmt.Errorf("Failed to call ec2:getAwsConfig, %v", err)
		}
		sess, err := session.NewSession(cfg)
		if err != nil {
			return fmt.Errorf("Failed to call ec2:NewSession, %v", err)
		}
		e.ec2Svc = ec2.New(sess, cfg)
	}
	return nil
}

func (e *CloudWatchExecutor) handleGetEbsVolumeIds(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	instanceId := parameters.Get("instanceId").MustString()

	err := e.ensureClientSession(region)
	if err != nil {
		return nil, err
	}

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

func (e *CloudWatchExecutor) handleGetEc2InstanceAttribute(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	attributeName := parameters.Get("attributeName").MustString()
	filterJson := parameters.Get("filters").MustMap()

	var filters []*ec2.Filter
	for k, v := range filterJson {
		if vv, ok := v.([]interface{}); ok {
			var vvvvv []*string
			for _, vvv := range vv {
				if vvvv, ok := vvv.(string); ok {
					vvvvv = append(vvvvv, &vvvv)
				}
			}
			filters = append(filters, &ec2.Filter{
				Name:   aws.String(k),
				Values: vvvvv,
			})
		}
	}

	err := e.ensureClientSession(region)
	if err != nil {
		return nil, err
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
				}
				if attr, ok := v.Interface().(*string); ok {
					data = *attr
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

func (e *CloudWatchExecutor) cloudwatchListMetrics(region string, namespace string, metricName string, dimensions []*cloudwatch.DimensionFilter) (*cloudwatch.ListMetricsOutput, error) {
	svc, err := e.getClient(region)
	if err != nil {
		return nil, err
	}

	params := &cloudwatch.ListMetricsInput{
		Namespace:  aws.String(namespace),
		MetricName: aws.String(metricName),
		Dimensions: dimensions,
	}

	var resp cloudwatch.ListMetricsOutput
	err = svc.ListMetricsPages(params,
		func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
			metrics.M_Aws_CloudWatch_ListMetrics.Inc()
			metrics, _ := awsutil.ValuesAtPath(page, "Metrics")
			for _, metric := range metrics {
				resp.Metrics = append(resp.Metrics, metric.(*cloudwatch.Metric))
			}
			return !lastPage
		})
	if err != nil {
		return nil, fmt.Errorf("Failed to call cloudwatch:ListMetrics, %v", err)
	}

	return &resp, nil
}

func (e *CloudWatchExecutor) ec2DescribeInstances(region string, filters []*ec2.Filter, instanceIds []*string) (*ec2.DescribeInstancesOutput, error) {
	params := &ec2.DescribeInstancesInput{
		Filters:     filters,
		InstanceIds: instanceIds,
	}

	var resp ec2.DescribeInstancesOutput
	err := e.ec2Svc.DescribeInstancesPages(params,
		func(page *ec2.DescribeInstancesOutput, lastPage bool) bool {
			reservations, _ := awsutil.ValuesAtPath(page, "Reservations")
			for _, reservation := range reservations {
				resp.Reservations = append(resp.Reservations, reservation.(*ec2.Reservation))
			}
			return !lastPage
		})
	if err != nil {
		return nil, errors.New("Failed to call ec2:DescribeInstances")
	}

	return &resp, nil
}

func getAllMetrics(cwData *DatasourceInfo) (cloudwatch.ListMetricsOutput, error) {
	creds, err := GetCredentials(cwData)
	if err != nil {
		return cloudwatch.ListMetricsOutput{}, err
	}
	cfg := &aws.Config{
		Region:      aws.String(cwData.Region),
		Credentials: creds,
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		return cloudwatch.ListMetricsOutput{}, err
	}
	svc := cloudwatch.New(sess, cfg)

	params := &cloudwatch.ListMetricsInput{
		Namespace: aws.String(cwData.Namespace),
	}

	var resp cloudwatch.ListMetricsOutput
	err = svc.ListMetricsPages(params,
		func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
			metrics.M_Aws_CloudWatch_ListMetrics.Inc()
			metrics, _ := awsutil.ValuesAtPath(page, "Metrics")
			for _, metric := range metrics {
				resp.Metrics = append(resp.Metrics, metric.(*cloudwatch.Metric))
			}
			return !lastPage
		})
	return resp, err
}

var metricsCacheLock sync.Mutex

func getMetricsForCustomMetrics(dsInfo *DatasourceInfo, getAllMetrics func(*DatasourceInfo) (cloudwatch.ListMetricsOutput, error)) ([]string, error) {
	metricsCacheLock.Lock()
	defer metricsCacheLock.Unlock()

	if _, ok := customMetricsMetricsMap[dsInfo.Profile]; !ok {
		customMetricsMetricsMap[dsInfo.Profile] = make(map[string]map[string]*CustomMetricsCache)
	}
	if _, ok := customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region]; !ok {
		customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region] = make(map[string]*CustomMetricsCache)
	}
	if _, ok := customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace]; !ok {
		customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace] = &CustomMetricsCache{}
		customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache = make([]string, 0)
	}

	if customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Expire.After(time.Now()) {
		return customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache, nil
	}
	result, err := getAllMetrics(dsInfo)
	if err != nil {
		return []string{}, err
	}
	customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache = make([]string, 0)
	customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Expire = time.Now().Add(5 * time.Minute)

	for _, metric := range result.Metrics {
		if isDuplicate(customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache, *metric.MetricName) {
			continue
		}
		customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache = append(customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache, *metric.MetricName)
	}

	return customMetricsMetricsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache, nil
}

var dimensionsCacheLock sync.Mutex

func getDimensionsForCustomMetrics(dsInfo *DatasourceInfo, getAllMetrics func(*DatasourceInfo) (cloudwatch.ListMetricsOutput, error)) ([]string, error) {
	dimensionsCacheLock.Lock()
	defer dimensionsCacheLock.Unlock()

	if _, ok := customMetricsDimensionsMap[dsInfo.Profile]; !ok {
		customMetricsDimensionsMap[dsInfo.Profile] = make(map[string]map[string]*CustomMetricsCache)
	}
	if _, ok := customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region]; !ok {
		customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region] = make(map[string]*CustomMetricsCache)
	}
	if _, ok := customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace]; !ok {
		customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace] = &CustomMetricsCache{}
		customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache = make([]string, 0)
	}

	if customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Expire.After(time.Now()) {
		return customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache, nil
	}
	result, err := getAllMetrics(dsInfo)
	if err != nil {
		return []string{}, err
	}
	customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache = make([]string, 0)
	customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Expire = time.Now().Add(5 * time.Minute)

	for _, metric := range result.Metrics {
		for _, dimension := range metric.Dimensions {
			if isDuplicate(customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache, *dimension.Name) {
				continue
			}
			customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache = append(customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache, *dimension.Name)
		}
	}

	return customMetricsDimensionsMap[dsInfo.Profile][dsInfo.Region][dsInfo.Namespace].Cache, nil
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
