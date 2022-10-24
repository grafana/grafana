package cloudwatch

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/constants"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/cwlog"
)

type suggestData struct {
	Text  string `json:"text"`
	Value string `json:"value"`
	Label string `json:"label,omitempty"`
}

type customMetricsCache struct {
	Expire time.Time
	Cache  []string
}

var customMetricsMetricsMap = make(map[string]map[string]map[string]*customMetricsCache)
var regionCache sync.Map

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
func (e *cloudWatchExecutor) handleGetRegions(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	dsInfo, err := e.getDSInfo(pluginCtx)
	if err != nil {
		return nil, err
	}

	profile := dsInfo.profile
	if cache, ok := regionCache.Load(profile); ok {
		if cache2, ok2 := cache.([]suggestData); ok2 {
			return cache2, nil
		}
	}

	client, err := e.getEC2Client(pluginCtx, defaultRegion)
	if err != nil {
		return nil, err
	}
	regions := constants.Regions
	r, err := client.DescribeRegions(&ec2.DescribeRegionsInput{})
	if err != nil {
		// ignore error for backward compatibility
		cwlog.Error("Failed to get regions", "error", err)
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
		result = append(result, suggestData{Text: region, Value: region, Label: region})
	}
	regionCache.Store(profile, result)

	return result, nil
}

func (e *cloudWatchExecutor) handleGetNamespaces(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	var keys []string
	for key := range constants.NamespaceMetricsMap {
		keys = append(keys, key)
	}

	dsInfo, err := e.getDSInfo(pluginCtx)
	if err != nil {
		return nil, err
	}

	customNamespaces := dsInfo.namespace
	if customNamespaces != "" {
		keys = append(keys, strings.Split(customNamespaces, ",")...)
	}
	sort.Strings(keys)

	result := make([]suggestData, 0)
	for _, key := range keys {
		result = append(result, suggestData{Text: key, Value: key, Label: key})
	}

	return result, nil
}

func (e *cloudWatchExecutor) handleGetMetrics(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	namespace := parameters.Get("namespace")

	var namespaceMetrics []string
	if !isCustomMetrics(namespace) {
		var exists bool
		if namespaceMetrics, exists = constants.NamespaceMetricsMap[namespace]; !exists {
			return nil, fmt.Errorf("unable to find namespace %q", namespace)
		}
	} else {
		var err error
		if namespaceMetrics, err = e.getMetricsForCustomMetrics(region, namespace, pluginCtx); err != nil {
			return nil, fmt.Errorf("%v: %w", "unable to call AWS API", err)
		}
	}
	sort.Strings(namespaceMetrics)

	result := make([]suggestData, 0)
	for _, name := range namespaceMetrics {
		result = append(result, suggestData{Text: name, Value: name, Label: name})
	}

	return result, nil
}

// handleGetAllMetrics returns a slice of suggestData structs with metric and its namespace
func (e *cloudWatchExecutor) handleGetAllMetrics(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	result := make([]suggestData, 0)
	for namespace, metrics := range constants.NamespaceMetricsMap {
		for _, metric := range metrics {
			result = append(result, suggestData{Text: namespace, Value: metric, Label: namespace})
		}
	}

	return result, nil
}

func (e *cloudWatchExecutor) handleGetEbsVolumeIds(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	instanceId := parameters.Get("instanceId")

	instanceIds := aws.StringSlice(parseMultiSelectValue(instanceId))
	instances, err := e.ec2DescribeInstances(pluginCtx, region, nil, instanceIds)
	if err != nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	for _, reservation := range instances.Reservations {
		for _, instance := range reservation.Instances {
			for _, mapping := range instance.BlockDeviceMappings {
				result = append(result, suggestData{Text: *mapping.Ebs.VolumeId, Value: *mapping.Ebs.VolumeId, Label: *mapping.Ebs.VolumeId})
			}
		}
	}

	return result, nil
}

func (e *cloudWatchExecutor) handleGetEc2InstanceAttribute(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	attributeName := parameters.Get("attributeName")
	filterJson := parameters.Get("filters")

	filterMap := map[string]interface{}{}
	err := json.Unmarshal([]byte(filterJson), &filterMap)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling filter: %v", err)
	}

	var filters []*ec2.Filter
	for k, v := range filterMap {
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

	instances, err := e.ec2DescribeInstances(pluginCtx, region, filters, nil)
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
			result = append(result, suggestData{Text: data, Value: data, Label: data})
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Text < result[j].Text
	})

	return result, nil
}

func (e *cloudWatchExecutor) handleGetResourceArns(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	resourceType := parameters.Get("resourceType")
	tagsJson := parameters.Get("tags")

	tagsMap := map[string]interface{}{}
	err := json.Unmarshal([]byte(tagsJson), &tagsMap)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling filter: %v", err)
	}

	var filters []*resourcegroupstaggingapi.TagFilter
	for k, v := range tagsMap {
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

	resources, err := e.resourceGroupsGetResources(pluginCtx, region, filters, resourceTypes)
	if err != nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	for _, resource := range resources.ResourceTagMappingList {
		data := *resource.ResourceARN
		result = append(result, suggestData{Text: data, Value: data, Label: data})
	}

	return result, nil
}

func (e *cloudWatchExecutor) listMetrics(pluginCtx backend.PluginContext, region string, params *cloudwatch.ListMetricsInput) ([]*cloudwatch.Metric, error) {
	client, err := e.getCWClient(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	cwlog.Debug("Listing metrics pages")
	var cloudWatchMetrics []*cloudwatch.Metric

	pageNum := 0
	err = client.ListMetricsPages(params, func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
		pageNum++
		metrics.MAwsCloudWatchListMetrics.Inc()
		metrics, err := awsutil.ValuesAtPath(page, "Metrics")
		if err == nil {
			for _, metric := range metrics {
				cloudWatchMetrics = append(cloudWatchMetrics, metric.(*cloudwatch.Metric))
			}
		}
		return !lastPage && pageNum < e.cfg.AWSListMetricsPageLimit
	})

	return cloudWatchMetrics, err
}

func (e *cloudWatchExecutor) ec2DescribeInstances(pluginCtx backend.PluginContext, region string, filters []*ec2.Filter, instanceIds []*string) (*ec2.DescribeInstancesOutput, error) {
	params := &ec2.DescribeInstancesInput{
		Filters:     filters,
		InstanceIds: instanceIds,
	}

	client, err := e.getEC2Client(pluginCtx, region)
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

func (e *cloudWatchExecutor) resourceGroupsGetResources(pluginCtx backend.PluginContext, region string, filters []*resourcegroupstaggingapi.TagFilter,
	resourceTypes []*string) (*resourcegroupstaggingapi.GetResourcesOutput, error) {
	params := &resourcegroupstaggingapi.GetResourcesInput{
		ResourceTypeFilters: resourceTypes,
		TagFilters:          filters,
	}

	client, err := e.getRGTAClient(pluginCtx, region)
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

var metricsCacheLock sync.Mutex

func (e *cloudWatchExecutor) getMetricsForCustomMetrics(region, namespace string, pluginCtx backend.PluginContext) ([]string, error) {
	cwlog.Debug("Getting metrics for custom metrics", "region", region, "namespace", namespace)
	metricsCacheLock.Lock()
	defer metricsCacheLock.Unlock()

	dsInfo, err := e.getDSInfo(pluginCtx)
	if err != nil {
		return nil, err
	}

	if _, ok := customMetricsMetricsMap[dsInfo.profile]; !ok {
		customMetricsMetricsMap[dsInfo.profile] = make(map[string]map[string]*customMetricsCache)
	}
	if _, ok := customMetricsMetricsMap[dsInfo.profile][dsInfo.region]; !ok {
		customMetricsMetricsMap[dsInfo.profile][dsInfo.region] = make(map[string]*customMetricsCache)
	}
	if _, ok := customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace]; !ok {
		customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace] = &customMetricsCache{}
		customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Cache = make([]string, 0)
	}

	if customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Expire.After(time.Now()) {
		return customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Cache, nil
	}
	metrics, err := e.listMetrics(pluginCtx, region, &cloudwatch.ListMetricsInput{
		Namespace: aws.String(namespace),
	})
	if err != nil {
		return []string{}, err
	}

	customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Cache = make([]string, 0)
	customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Expire = time.Now().Add(5 * time.Minute)

	for _, metric := range metrics {
		if isDuplicate(customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Cache, *metric.MetricName) {
			continue
		}
		customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Cache = append(
			customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Cache, *metric.MetricName)
	}

	return customMetricsMetricsMap[dsInfo.profile][dsInfo.region][namespace].Cache, nil
}

func (e *cloudWatchExecutor) handleGetLogGroups(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	limit := parameters.Get("limit")
	logGroupNamePrefix := parameters.Get("logGroupNamePrefix")

	logsClient, err := e.getCWLogsClient(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	logGroupLimit := defaultLogGroupLimit
	intLimit, err := strconv.ParseInt(limit, 10, 64)
	if err == nil && intLimit > 0 {
		logGroupLimit = intLimit
	}

	var response *cloudwatchlogs.DescribeLogGroupsOutput = nil
	input := &cloudwatchlogs.DescribeLogGroupsInput{Limit: aws.Int64(logGroupLimit)}
	if len(logGroupNamePrefix) > 0 {
		input.LogGroupNamePrefix = aws.String(logGroupNamePrefix)
	}
	response, err = logsClient.DescribeLogGroups(input)
	if err != nil || response == nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	for _, logGroup := range response.LogGroups {
		logGroupName := *logGroup.LogGroupName
		result = append(result, suggestData{Text: logGroupName, Value: logGroupName, Label: logGroupName})
	}

	return result, nil
}
func (e *cloudWatchExecutor) handleGetAllLogGroups(pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error) {
	var nextToken *string

	logGroupNamePrefix := parameters.Get("logGroupNamePrefix")

	var err error
	logsClient, err := e.getCWLogsClient(pluginCtx, parameters.Get("region"))
	if err != nil {
		return nil, err
	}

	var response *cloudwatchlogs.DescribeLogGroupsOutput
	result := make([]suggestData, 0)
	for {
		response, err = logsClient.DescribeLogGroups(&cloudwatchlogs.DescribeLogGroupsInput{
			LogGroupNamePrefix: aws.String(logGroupNamePrefix),
			NextToken:          nextToken,
			Limit:              aws.Int64(defaultLogGroupLimit),
		})
		if err != nil || response == nil {
			return nil, err
		}

		for _, logGroup := range response.LogGroups {
			logGroupName := *logGroup.LogGroupName
			result = append(result, suggestData{Text: logGroupName, Value: logGroupName, Label: logGroupName})
		}

		if response.NextToken == nil {
			break
		}
		nextToken = response.NextToken
	}

	return result, nil
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
	if _, ok := constants.NamespaceMetricsMap[namespace]; ok {
		return false
	}
	return true
}
