package services

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	cloudwatchtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const useLinkedAccountsId = "all"

var metricResponse = []resources.MetricResponse{
	{
		Metric: cloudwatchtypes.Metric{
			MetricName: aws.String("CPUUtilization"),
			Namespace:  aws.String("AWS/EC2"),
			Dimensions: []cloudwatchtypes.Dimension{
				{Name: aws.String("InstanceId"), Value: aws.String("i-1234567890abcdef0")},
				{Name: aws.String("InstanceType"), Value: aws.String("t2.micro")},
			},
		},
	},
	{
		Metric: cloudwatchtypes.Metric{
			MetricName: aws.String("CPUUtilization"),
			Namespace:  aws.String("AWS/EC2"),
			Dimensions: []cloudwatchtypes.Dimension{
				{Name: aws.String("InstanceId"), Value: aws.String("i-5234567890abcdef0")},
				{Name: aws.String("InstanceType"), Value: aws.String("t2.micro")},
				{Name: aws.String("AutoScalingGroupName"), Value: aws.String("my-asg")},
			},
		},
	},
	{
		Metric: cloudwatchtypes.Metric{
			MetricName: aws.String("CPUUtilization"),
			Namespace:  aws.String("AWS/EC2"),
			Dimensions: []cloudwatchtypes.Dimension{
				{Name: aws.String("InstanceId"), Value: aws.String("i-64234567890abcdef0")},
				{Name: aws.String("InstanceType"), Value: aws.String("t3.micro")},
				{Name: aws.String("AutoScalingGroupName"), Value: aws.String("my-asg2")},
			},
		},
	},
}

type validateInputTestCase[T resources.DimensionKeysRequest | resources.DimensionValuesRequest] struct {
	name                          string
	input                         T
	listMetricsWithPageLimitInput *cloudwatch.ListMetricsInput
}

func TestListMetricsService_GetDimensionKeysByDimensionFilter(t *testing.T) {
	t.Run("Should filter out duplicates and keys matching dimension filter keys", func(t *testing.T) {
		fakeMetricsClient := &mocks.FakeMetricsClient{}
		fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(metricResponse, nil)
		listMetricsService := NewListMetricsService(fakeMetricsClient)

		resp, err := listMetricsService.GetDimensionKeysByDimensionFilter(context.Background(), resources.DimensionKeysRequest{
			ResourceRequest: &resources.ResourceRequest{Region: "us-east-1"},
			Namespace:       "AWS/EC2",
			MetricName:      "CPUUtilization",
			DimensionFilter: []*resources.Dimension{{Name: "InstanceId", Value: ""}},
		})

		require.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[string]{{Value: "InstanceType"}, {Value: "AutoScalingGroupName"}}, resp)
	})

	testCases := []validateInputTestCase[resources.DimensionKeysRequest]{
		{
			name: "Should set account correctly on list metric input if it cross account is defined on the request",
			input: resources.DimensionKeysRequest{
				ResourceRequest: &resources.ResourceRequest{Region: "us-east-1", AccountId: utils.Pointer(useLinkedAccountsId)},
				Namespace:       "AWS/EC2",
				MetricName:      "CPUUtilization",
				DimensionFilter: []*resources.Dimension{{Name: "InstanceId", Value: ""}},
			},
			listMetricsWithPageLimitInput: &cloudwatch.ListMetricsInput{
				MetricName:            aws.String("CPUUtilization"),
				Namespace:             aws.String("AWS/EC2"),
				Dimensions:            []cloudwatchtypes.DimensionFilter{{Name: aws.String("InstanceId")}},
				IncludeLinkedAccounts: aws.Bool(true),
			},
		},
		{
			name: "Should set account correctly on list metric input if single account is defined on the request",
			input: resources.DimensionKeysRequest{
				ResourceRequest: &resources.ResourceRequest{Region: "us-east-1", AccountId: utils.Pointer("1234567890")},
				Namespace:       "AWS/EC2",
				MetricName:      "CPUUtilization",
				DimensionFilter: []*resources.Dimension{{Name: "InstanceId", Value: ""}},
			},
			listMetricsWithPageLimitInput: &cloudwatch.ListMetricsInput{
				MetricName:            aws.String("CPUUtilization"),
				Namespace:             aws.String("AWS/EC2"),
				Dimensions:            []cloudwatchtypes.DimensionFilter{{Name: aws.String("InstanceId")}},
				IncludeLinkedAccounts: aws.Bool(true),
				OwningAccount:         aws.String("1234567890"),
			},
		},
		{
			name: "Should not set namespace and metricName on list metric input if empty strings are set for these in the request",
			input: resources.DimensionKeysRequest{
				ResourceRequest: &resources.ResourceRequest{Region: "us-east-1"},
				Namespace:       "",
				MetricName:      "",
				DimensionFilter: []*resources.Dimension{{Name: "InstanceId", Value: ""}},
			},
			listMetricsWithPageLimitInput: &cloudwatch.ListMetricsInput{Dimensions: []cloudwatchtypes.DimensionFilter{{Name: aws.String("InstanceId")}}},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fakeMetricsClient := &mocks.FakeMetricsClient{}
			fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(metricResponse, nil)
			listMetricsService := NewListMetricsService(fakeMetricsClient)
			res, err := listMetricsService.GetDimensionKeysByDimensionFilter(context.Background(), tc.input)
			require.NoError(t, err)
			require.NotEmpty(t, res)
			fakeMetricsClient.AssertCalled(t, "ListMetricsWithPageLimit", tc.listMetricsWithPageLimitInput)
		})
	}
}

func TestListMetricsService_GetDimensionValuesByDimensionFilter(t *testing.T) {
	t.Run("Should filter out duplicates and keys matching dimension filter keys", func(t *testing.T) {
		fakeMetricsClient := &mocks.FakeMetricsClient{}
		fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(metricResponse, nil)
		listMetricsService := NewListMetricsService(fakeMetricsClient)

		resp, err := listMetricsService.GetDimensionValuesByDimensionFilter(context.Background(), resources.DimensionValuesRequest{
			ResourceRequest: &resources.ResourceRequest{Region: "us-east-1"},
			Namespace:       "AWS/EC2",
			MetricName:      "CPUUtilization",
			DimensionKey:    "InstanceId",
			DimensionFilter: []*resources.Dimension{
				{Name: "InstanceId", Value: ""},
			},
		})

		require.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[string]{{Value: "i-1234567890abcdef0"}, {Value: "i-5234567890abcdef0"}, {Value: "i-64234567890abcdef0"}}, resp)
	})

	testCases := []validateInputTestCase[resources.DimensionValuesRequest]{
		{
			name: "Should set account correctly on list metric input if it cross account is defined on the request",
			input: resources.DimensionValuesRequest{
				ResourceRequest: &resources.ResourceRequest{Region: "us-east-1", AccountId: utils.Pointer(useLinkedAccountsId)},
				Namespace:       "AWS/EC2",
				MetricName:      "CPUUtilization",
				DimensionFilter: []*resources.Dimension{{Name: "InstanceId", Value: ""}},
			},
			listMetricsWithPageLimitInput: &cloudwatch.ListMetricsInput{
				MetricName:            aws.String("CPUUtilization"),
				Namespace:             aws.String("AWS/EC2"),
				Dimensions:            []cloudwatchtypes.DimensionFilter{{Name: aws.String("InstanceId")}},
				IncludeLinkedAccounts: aws.Bool(true),
			},
		},
		{
			name: "Should set account correctly on list metric input if single account is defined on the request",
			input: resources.DimensionValuesRequest{
				ResourceRequest: &resources.ResourceRequest{Region: "us-east-1", AccountId: utils.Pointer("1234567890")},
				Namespace:       "AWS/EC2",
				MetricName:      "CPUUtilization",
				DimensionFilter: []*resources.Dimension{{Name: "InstanceId", Value: ""}},
			},
			listMetricsWithPageLimitInput: &cloudwatch.ListMetricsInput{
				MetricName:            aws.String("CPUUtilization"),
				Namespace:             aws.String("AWS/EC2"),
				Dimensions:            []cloudwatchtypes.DimensionFilter{{Name: aws.String("InstanceId")}},
				IncludeLinkedAccounts: aws.Bool(true),
				OwningAccount:         aws.String("1234567890"),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fakeMetricsClient := &mocks.FakeMetricsClient{}
			fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(metricResponse, nil)
			listMetricsService := NewListMetricsService(fakeMetricsClient)
			res, err := listMetricsService.GetDimensionValuesByDimensionFilter(context.Background(), tc.input)
			require.NoError(t, err)
			require.Empty(t, res)
			fakeMetricsClient.AssertCalled(t, "ListMetricsWithPageLimit", tc.listMetricsWithPageLimitInput)
		})
	}
}
