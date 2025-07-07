package cloudwatch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi"
	resourcegroupstaggingapitypes "github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi/types"
)

type suggestData struct {
	Text  string `json:"text"`
	Value string `json:"value"`
	Label string `json:"label,omitempty"`
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

func (ds *DataSource) handleGetEbsVolumeIds(ctx context.Context, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	instanceId := parameters.Get("instanceId")

	instanceIds := parseMultiSelectValue(instanceId)
	instances, err := ds.ec2DescribeInstances(ctx, region, nil, instanceIds)
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

func (ds *DataSource) handleGetEc2InstanceAttribute(ctx context.Context, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	attributeName := parameters.Get("attributeName")
	filterJson := parameters.Get("filters")

	filterMap := map[string]any{}
	err := json.Unmarshal([]byte(filterJson), &filterMap)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling filter: %v", err)
	}

	var filters []ec2types.Filter
	for k, v := range filterMap {
		if vv, ok := v.([]any); ok {
			var values []string
			for _, vvv := range vv {
				if vvvv, ok := vvv.(string); ok {
					values = append(values, vvvv)
				}
			}
			filters = append(filters, ec2types.Filter{
				Name:   aws.String(k),
				Values: values,
			})
		}
	}

	instances, err := ds.ec2DescribeInstances(ctx, region, filters, nil)
	if err != nil {
		return nil, err
	}

	result := make([]suggestData, 0)
	dupCheck := make(map[string]bool)
	for _, reservation := range instances.Reservations {
		for _, instance := range reservation.Instances {
			data, found, err := getInstanceAttributeValue(attributeName, instance)
			if err != nil {
				return nil, err
			}
			if !found {
				continue
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

func getInstanceAttributeValue(attributeName string, instance ec2types.Instance) (value string, found bool, err error) {
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
				if v.IsNil() {
					return "", false, nil
				}
				v = v.Elem()
			}
			if v.Kind() != reflect.Struct {
				return "", false, errors.New("invalid attribute path")
			}
			v = v.FieldByName(key)
			if !v.IsValid() {
				return "", false, errors.New("invalid attribute path")
			}
		}

		if v.Kind() == reflect.Ptr && v.IsNil() {
			return "", false, nil
		}
		if v.Kind() == reflect.String {
			if v.String() == "" {
				return "", false, nil
			}
			data = v.String()
		} else if attr, ok := v.Interface().(*string); ok {
			data = *attr
		} else if attr, ok := v.Interface().(*time.Time); ok {
			data = attr.String()
		} else if _, ok := v.Interface().(*bool); ok {
			data = fmt.Sprint(v.Elem().Bool())
		} else if v.Kind() == reflect.Ptr && v.Elem().CanInt() {
			data = fmt.Sprint(v.Elem().Int())
		} else {
			return "", false, errors.New("cannot parse attribute")
		}
	}

	return data, true, nil
}

func (ds *DataSource) handleGetResourceArns(ctx context.Context, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	resourceType := parameters.Get("resourceType")
	tagsJson := parameters.Get("tags")

	tagsMap := map[string]any{}
	err := json.Unmarshal([]byte(tagsJson), &tagsMap)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling filter: %v", err)
	}

	var filters []resourcegroupstaggingapitypes.TagFilter
	for k, v := range tagsMap {
		if vv, ok := v.([]any); ok {
			var values []string
			for _, vvv := range vv {
				if vvvv, ok := vvv.(string); ok {
					values = append(values, vvvv)
				}
			}
			filters = append(filters, resourcegroupstaggingapitypes.TagFilter{
				Key:    aws.String(k),
				Values: values,
			})
		}
	}

	resourceTypes := []string{resourceType}

	resources, err := ds.resourceGroupsGetResources(ctx, region, filters, resourceTypes)
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

func (ds *DataSource) ec2DescribeInstances(ctx context.Context, region string, filters []ec2types.Filter, instanceIds []string) (*ec2.DescribeInstancesOutput, error) {
	params := &ec2.DescribeInstancesInput{
		Filters:     filters,
		InstanceIds: instanceIds,
	}

	client, err := ds.getEC2Client(ctx, region)
	if err != nil {
		return nil, err
	}

	resp := &ec2.DescribeInstancesOutput{}
	pager := ec2.NewDescribeInstancesPaginator(client, params)
	for pager.HasMorePages() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return resp, fmt.Errorf("describe instances pager failed: %w", err)
		}
		resp.Reservations = append(resp.Reservations, page.Reservations...)
	}
	return resp, nil
}

func (ds *DataSource) resourceGroupsGetResources(ctx context.Context, region string, filters []resourcegroupstaggingapitypes.TagFilter,
	resourceTypes []string) (*resourcegroupstaggingapi.GetResourcesOutput, error) {
	params := &resourcegroupstaggingapi.GetResourcesInput{
		ResourceTypeFilters: resourceTypes,
		TagFilters:          filters,
	}

	client, err := ds.getRGTAClient(ctx, region)
	if err != nil {
		return nil, err
	}

	var resp resourcegroupstaggingapi.GetResourcesOutput
	paginator := resourcegroupstaggingapi.NewGetResourcesPaginator(client, params)
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("get resource groups paginator failed: %w", err)
		}
		resp.ResourceTagMappingList = append(resp.ResourceTagMappingList, page.ResourceTagMappingList...)
	}

	return &resp, nil
}

// legacy route, will be removed once GovCloud supports Cross Account Observability
func (ds *DataSource) handleGetLogGroups(ctx context.Context, parameters url.Values) ([]suggestData, error) {
	region := parameters.Get("region")
	limit := parameters.Get("limit")
	logGroupNamePrefix := parameters.Get("logGroupNamePrefix")

	logsClient, err := ds.getCWLogsClient(ctx, region)
	if err != nil {
		return nil, err
	}

	logGroupLimit := defaultLogGroupLimit
	intLimit, err := strconv.ParseInt(limit, 10, 32)
	if err == nil && intLimit > 0 {
		logGroupLimit = int32(intLimit)
	}

	input := &cloudwatchlogs.DescribeLogGroupsInput{Limit: aws.Int32(logGroupLimit)}
	if len(logGroupNamePrefix) > 0 {
		input.LogGroupNamePrefix = aws.String(logGroupNamePrefix)
	}
	var response *cloudwatchlogs.DescribeLogGroupsOutput
	response, err = logsClient.DescribeLogGroups(ctx, input)
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
