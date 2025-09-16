package services

import (
	"context"
	"fmt"
	"sort"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	cloudwatchtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type ListMetricsService struct {
	models.MetricsClientProvider
}

var NewListMetricsService = func(metricsClient models.MetricsClientProvider) models.ListMetricsProvider {
	return &ListMetricsService{metricsClient}
}

func (l *ListMetricsService) GetDimensionKeysByDimensionFilter(ctx context.Context, r resources.DimensionKeysRequest) ([]resources.ResourceResponse[string], error) {
	input := &cloudwatch.ListMetricsInput{}
	if r.Namespace != "" {
		input.Namespace = aws.String(r.Namespace)
	}
	if r.MetricName != "" {
		input.MetricName = aws.String(r.MetricName)
	}
	setDimensionFilter(input, r.DimensionFilter)
	setAccount(input, r.ResourceRequest)

	accountMetrics, err := l.ListMetricsWithPageLimit(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "unable to call AWS API", err)
	}

	response := []resources.ResourceResponse[string]{}
	// remove duplicates
	dupCheck := make(map[string]struct{})
	for _, accountMetric := range accountMetrics {
		for _, dim := range accountMetric.Metric.Dimensions {
			if _, exists := dupCheck[*dim.Name]; exists {
				continue
			}

			// keys in the dimension filter should not be included
			dimensionFilterExist := false
			for _, d := range r.DimensionFilter {
				if d.Name == *dim.Name {
					dimensionFilterExist = true
					break
				}
			}

			if dimensionFilterExist {
				continue
			}

			dupCheck[*dim.Name] = struct{}{}
			response = append(response, resources.ResourceResponse[string]{AccountId: accountMetric.AccountId, Value: *dim.Name})
		}
	}

	return response, nil
}

func (l *ListMetricsService) GetDimensionValuesByDimensionFilter(ctx context.Context, r resources.DimensionValuesRequest) ([]resources.ResourceResponse[string], error) {
	input := &cloudwatch.ListMetricsInput{
		Namespace:  aws.String(r.Namespace),
		MetricName: aws.String(r.MetricName),
	}
	setDimensionFilter(input, r.DimensionFilter)
	setAccount(input, r.ResourceRequest)

	accountMetrics, err := l.ListMetricsWithPageLimit(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "unable to call AWS API", err)
	}

	response := []resources.ResourceResponse[string]{}
	dupCheck := make(map[string]bool)
	for _, metric := range accountMetrics {
		for _, dim := range metric.Metric.Dimensions {
			if *dim.Name == r.DimensionKey {
				if _, exists := dupCheck[*dim.Value]; exists {
					continue
				}

				dupCheck[*dim.Value] = true
				response = append(response, resources.ResourceResponse[string]{AccountId: metric.AccountId, Value: *dim.Value})
			}
		}
	}

	sort.Slice(response, func(i, j int) bool {
		return response[i].Value < response[j].Value
	})
	return response, nil
}

func (l *ListMetricsService) GetMetricsByNamespace(ctx context.Context, r resources.MetricsRequest) ([]resources.ResourceResponse[resources.Metric], error) {
	input := &cloudwatch.ListMetricsInput{Namespace: aws.String(r.Namespace)}
	setAccount(input, r.ResourceRequest)
	accountMetrics, err := l.ListMetricsWithPageLimit(ctx, input)
	if err != nil {
		return nil, err
	}

	response := []resources.ResourceResponse[resources.Metric]{}
	dupCheck := make(map[string]struct{})
	for _, accountMetric := range accountMetrics {
		if _, exists := dupCheck[*accountMetric.Metric.MetricName]; exists {
			continue
		}
		dupCheck[*accountMetric.Metric.MetricName] = struct{}{}
		response = append(response, resources.ResourceResponse[resources.Metric]{AccountId: accountMetric.AccountId, Value: resources.Metric{Name: *accountMetric.Metric.MetricName, Namespace: *accountMetric.Metric.Namespace}})
	}

	return response, nil
}

func setDimensionFilter(input *cloudwatch.ListMetricsInput, dimensionFilter []*resources.Dimension) {
	for _, dimension := range dimensionFilter {
		df := cloudwatchtypes.DimensionFilter{
			Name: aws.String(dimension.Name),
		}
		if dimension.Value != "" {
			df.Value = aws.String(dimension.Value)
		}
		input.Dimensions = append(input.Dimensions, df)
	}
}

func setAccount(input *cloudwatch.ListMetricsInput, r *resources.ResourceRequest) {
	if r != nil && r.AccountId != nil {
		input.IncludeLinkedAccounts = aws.Bool(true)
		if !r.ShouldTargetAllAccounts() {
			input.OwningAccount = r.AccountId
		}
	}
}
