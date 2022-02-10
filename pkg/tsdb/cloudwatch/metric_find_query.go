package cloudwatch

import (
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
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/util/errutil"
)

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

var regionCache sync.Map

func (e *cloudWatchExecutor) executeMetricFindQuery(model *simplejson.Json, query backend.DataQuery, pluginCtx backend.PluginContext) (*backend.QueryDataResponse, error) {
	subType := model.Get("subtype").MustString()

	var data []suggestData
	var err error
	switch subType {
	case "regions":
		data, err = e.handleGetRegions(pluginCtx)
	case "namespaces":
		data, err = e.handleGetNamespaces(pluginCtx)
	case "metrics":
		data, err = e.handleGetMetrics(model, pluginCtx)
	case "all_metrics":
		data, err = e.handleGetAllMetrics()
	case "dimension_keys":
		data, err = e.handleGetDimensions(model, pluginCtx)
	case "dimension_values":
		data, err = e.handleGetDimensionValues(model, pluginCtx)
	case "ebs_volume_ids":
		data, err = e.handleGetEbsVolumeIds(model, pluginCtx)
	case "ec2_instance_attribute":
		data, err = e.handleGetEc2InstanceAttribute(model, pluginCtx)
	case "resource_arns":
		data, err = e.handleGetResourceArns(model, pluginCtx)
	}
	if err != nil {
		return nil, err
	}

	resp := backend.NewQueryDataResponse()
	respD := resp.Responses[query.RefID]
	respD.Frames = append(respD.Frames, transformToTable(data))
	resp.Responses[query.RefID] = respD

	return resp, nil
}

func transformToTable(d []suggestData) *data.Frame {
	frame := data.NewFrame("",
		data.NewField("text", nil, []string{}),
		data.NewField("value", nil, []string{}))

	for _, r := range d {
		frame.AppendRow(r.Text, r.Value)
	}

	frame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"rowCount": len(d),
		},
	}

	return frame
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
func (e *cloudWatchExecutor) handleGetRegions(pluginCtx backend.PluginContext) ([]suggestData, error) {
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

	client, err := e.getEC2Client(defaultRegion, pluginCtx)
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

func (e *cloudWatchExecutor) handleGetNamespaces(pluginCtx backend.PluginContext) ([]suggestData, error) {
	var keys []string
	for key := range metricsMap {
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
		result = append(result, suggestData{Text: key, Value: key})
	}

	return result, nil
}

func (e *cloudWatchExecutor) handleGetMetrics(parameters *simplejson.Json, pluginCtx backend.PluginContext) ([]suggestData, error) {
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
		if namespaceMetrics, err = e.getMetricsForCustomMetrics(region, namespace, pluginCtx); err != nil {
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

// handleGetAllMetrics returns a slice of suggestData structs with metric and its namespace
func (e *cloudWatchExecutor) handleGetAllMetrics() ([]suggestData, error) {
	result := make([]suggestData, 0)
	for namespace, metrics := range metricsMap {
		for _, metric := range metrics {
			result = append(result, suggestData{Text: namespace, Value: metric})
		}
	}

	return result, nil
}

// handleGetDimensions returns a slice of suggestData structs with dimension keys.
// If a dimension filters parameter is specified, a new api call to list metrics will be issued to load dimension keys for the given filter.
// If no dimension filter is specified, dimension keys will be retrieved from the hard coded map in this file.
func (e *cloudWatchExecutor) handleGetDimensions(parameters *simplejson.Json, pluginCtx backend.PluginContext) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	namespace := parameters.Get("namespace").MustString()
	metricName := parameters.Get("metricName").MustString("")
	dimensionFilters := parameters.Get("dimensionFilters").MustMap()

	var dimensionValues []string
	if !isCustomMetrics(namespace) {
		if len(dimensionFilters) != 0 {
			var dimensions []*cloudwatch.DimensionFilter
			addDimension := func(key string, value string) {
				filter := &cloudwatch.DimensionFilter{
					Name: aws.String(key),
				}
				// if value is not specified or a wildcard is used, simply don't use the value field
				if value != "" && value != "*" {
					filter.Value = aws.String(value)
				}
				dimensions = append(dimensions, filter)
			}
			for k, v := range dimensionFilters {
				// due to legacy, value can be a string, a string slice or nil
				if vv, ok := v.(string); ok {
					addDimension(k, vv)
				} else if vv, ok := v.([]interface{}); ok {
					for _, v := range vv {
						addDimension(k, v.(string))
					}
				} else if v == nil {
					addDimension(k, "")
				}
			}

			input := &cloudwatch.ListMetricsInput{
				Namespace:  aws.String(namespace),
				Dimensions: dimensions,
			}

			if metricName != "" {
				input.MetricName = aws.String(metricName)
			}

			metrics, err := e.listMetrics(region, input, pluginCtx)

			if err != nil {
				return nil, errutil.Wrap("unable to call AWS API", err)
			}

			dupCheck := make(map[string]bool)
			for _, metric := range metrics {
				for _, dim := range metric.Dimensions {
					if _, exists := dupCheck[*dim.Name]; exists {
						continue
					}

					// keys in the dimension filter should not be included
					if _, ok := dimensionFilters[*dim.Name]; ok {
						continue
					}

					dupCheck[*dim.Name] = true
					dimensionValues = append(dimensionValues, *dim.Name)
				}
			}
		} else {
			var exists bool
			if dimensionValues, exists = dimensionsMap[namespace]; !exists {
				return nil, fmt.Errorf("unable to find dimension %q", namespace)
			}
		}
	} else {
		var err error
		if dimensionValues, err = e.getDimensionsForCustomMetrics(region, namespace, pluginCtx); err != nil {
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

// handleGetDimensionValues returns a slice of suggestData structs with dimension values.
// A call to the list metrics api is issued to retrieve the dimension values. All parameters are used as input args to the list metrics call.
func (e *cloudWatchExecutor) handleGetDimensionValues(parameters *simplejson.Json, pluginCtx backend.PluginContext) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	namespace := parameters.Get("namespace").MustString()
	metricName := parameters.Get("metricName").MustString()
	dimensionKey := parameters.Get("dimensionKey").MustString()
	dimensionsJson := parameters.Get("dimensions").MustMap()

	var dimensions []*cloudwatch.DimensionFilter
	addDimension := func(key string, value string) {
		filter := &cloudwatch.DimensionFilter{
			Name: aws.String(key),
		}
		// if value is not specified or a wildcard is used, simply don't use the value field
		if value != "" && value != "*" {
			filter.Value = aws.String(value)
		}
		dimensions = append(dimensions, filter)
	}
	for k, v := range dimensionsJson {
		// due to legacy, value can be a string, a string slice or nil
		if vv, ok := v.(string); ok {
			addDimension(k, vv)
		} else if vv, ok := v.([]interface{}); ok {
			for _, v := range vv {
				addDimension(k, v.(string))
			}
		} else if v == nil {
			addDimension(k, "")
		}
	}

	params := &cloudwatch.ListMetricsInput{
		Namespace:  aws.String(namespace),
		Dimensions: dimensions,
	}
	if metricName != "" {
		params.MetricName = aws.String(metricName)
	}
	metrics, err := e.listMetrics(region, params, pluginCtx)
	if err != nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	dupCheck := make(map[string]bool)
	for _, metric := range metrics {
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

func (e *cloudWatchExecutor) handleGetEbsVolumeIds(parameters *simplejson.Json,
	pluginCtx backend.PluginContext) ([]suggestData, error) {
	region := parameters.Get("region").MustString()
	instanceId := parameters.Get("instanceId").MustString()

	instanceIds := aws.StringSlice(parseMultiSelectValue(instanceId))
	instances, err := e.ec2DescribeInstances(region, nil, instanceIds, pluginCtx)
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

func (e *cloudWatchExecutor) handleGetEc2InstanceAttribute(parameters *simplejson.Json,
	pluginCtx backend.PluginContext) ([]suggestData, error) {
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

	instances, err := e.ec2DescribeInstances(region, filters, nil, pluginCtx)
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

func (e *cloudWatchExecutor) handleGetResourceArns(parameters *simplejson.Json,
	pluginCtx backend.PluginContext) ([]suggestData, error) {
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

	resources, err := e.resourceGroupsGetResources(region, filters, resourceTypes, pluginCtx)
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

func (e *cloudWatchExecutor) listMetrics(region string, params *cloudwatch.ListMetricsInput, pluginCtx backend.PluginContext) ([]*cloudwatch.Metric, error) {
	client, err := e.getCWClient(region, pluginCtx)
	if err != nil {
		return nil, err
	}

	plog.Debug("Listing metrics pages")
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

func (e *cloudWatchExecutor) ec2DescribeInstances(region string, filters []*ec2.Filter, instanceIds []*string, pluginCtx backend.PluginContext) (*ec2.DescribeInstancesOutput, error) {
	params := &ec2.DescribeInstancesInput{
		Filters:     filters,
		InstanceIds: instanceIds,
	}

	client, err := e.getEC2Client(region, pluginCtx)
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
	resourceTypes []*string, pluginCtx backend.PluginContext) (*resourcegroupstaggingapi.GetResourcesOutput, error) {
	params := &resourcegroupstaggingapi.GetResourcesInput{
		ResourceTypeFilters: resourceTypes,
		TagFilters:          filters,
	}

	client, err := e.getRGTAClient(region, pluginCtx)
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
	plog.Debug("Getting metrics for custom metrics", "region", region, "namespace", namespace)
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
	metrics, err := e.listMetrics(region, &cloudwatch.ListMetricsInput{
		Namespace: aws.String(namespace),
	}, pluginCtx)
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

var dimensionsCacheLock sync.Mutex

func (e *cloudWatchExecutor) getDimensionsForCustomMetrics(region, namespace string, pluginCtx backend.PluginContext) ([]string, error) {
	dimensionsCacheLock.Lock()
	defer dimensionsCacheLock.Unlock()

	dsInfo, err := e.getDSInfo(pluginCtx)
	if err != nil {
		return nil, err
	}

	if _, ok := customMetricsDimensionsMap[dsInfo.profile]; !ok {
		customMetricsDimensionsMap[dsInfo.profile] = make(map[string]map[string]*customMetricsCache)
	}
	if _, ok := customMetricsDimensionsMap[dsInfo.profile][dsInfo.region]; !ok {
		customMetricsDimensionsMap[dsInfo.profile][dsInfo.region] = make(map[string]*customMetricsCache)
	}
	if _, ok := customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace]; !ok {
		customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace] = &customMetricsCache{}
		customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Cache = make([]string, 0)
	}

	if customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Expire.After(time.Now()) {
		return customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Cache, nil
	}
	metrics, err := e.listMetrics(region, &cloudwatch.ListMetricsInput{Namespace: aws.String(namespace)}, pluginCtx)
	if err != nil {
		return []string{}, err
	}
	customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Cache = make([]string, 0)
	customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Expire = time.Now().Add(5 * time.Minute)

	for _, metric := range metrics {
		for _, dimension := range metric.Dimensions {
			if isDuplicate(customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Cache, *dimension.Name) {
				continue
			}
			customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Cache = append(
				customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Cache, *dimension.Name)
		}
	}

	return customMetricsDimensionsMap[dsInfo.profile][dsInfo.region][namespace].Cache, nil
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
	if _, ok := metricsMap[namespace]; ok {
		return false
	}
	return true
}
