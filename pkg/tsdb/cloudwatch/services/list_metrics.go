package services

import (
	"fmt"
	"sort"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type ListMetricsService struct {
	models.MetricsClientProvider
}

func NewListMetricsService(metricsClient models.MetricsClientProvider) models.ListMetricsProvider {
	return &ListMetricsService{metricsClient}
}

func (l *ListMetricsService) GetDimensionKeysByDimensionFilter(r resources.DimensionKeysRequest) ([]models.ResourceResponse[string], error) {
	input := &cloudwatch.ListMetricsInput{}
	if r.Namespace != "" {
		input.Namespace = aws.String(r.Namespace)
	}
	if r.MetricName != "" {
		input.MetricName = aws.String(r.MetricName)
	}
	setDimensionFilter(input, r.DimensionFilter)

	metrics, err := l.ListMetricsWithPageLimit(input)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "unable to call AWS API", err)
	}

	var response []models.ResourceResponse[string]
	// remove duplicates
	dupCheck := make(map[string]struct{})
	for _, metric := range metrics {
		for _, dim := range metric.Dimensions {
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
			response = append(response, models.ResourceResponse[string]{Value: *dim.Name})
		}
	}

	return response, nil
}

func (l *ListMetricsService) GetDimensionValuesByDimensionFilter(r resources.DimensionValuesRequest) ([]models.ResourceResponse[string], error) {
	input := &cloudwatch.ListMetricsInput{
		Namespace:  aws.String(r.Namespace),
		MetricName: aws.String(r.MetricName),
	}
	setDimensionFilter(input, r.DimensionFilter)

	metrics, err := l.ListMetricsWithPageLimit(input)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "unable to call AWS API", err)
	}

	var response []models.ResourceResponse[string]
	dupCheck := make(map[string]bool)
	for _, metric := range metrics {
		for _, dim := range metric.Dimensions {
			if *dim.Name == r.DimensionKey {
				if _, exists := dupCheck[*dim.Value]; exists {
					continue
				}

				dupCheck[*dim.Value] = true
				response = append(response, models.ResourceResponse[string]{Value: *dim.Value})
			}
		}
	}

	sort.Slice(response, func(i, j int) bool {
		return response[i].Value < response[j].Value
	})
	return response, nil
}

func (l *ListMetricsService) GetDimensionKeysByNamespace(namespace string) ([]models.ResourceResponse[string], error) {
	response, err := l.ListMetricsWithPageLimit(&cloudwatch.ListMetricsInput{Namespace: aws.String(namespace)})
	if err != nil {
		return []models.ResourceResponse[string]{}, err
	}

	var dimensionKeys []models.ResourceResponse[string]
	dupCheck := make(map[string]struct{})
	for _, metric := range response {
		for _, dim := range metric.Dimensions {
			if _, exists := dupCheck[*dim.Name]; exists {
				continue
			}

			dupCheck[*dim.Name] = struct{}{}
			dimensionKeys = append(dimensionKeys, models.ResourceResponse[string]{Value: *dim.Name})
		}
	}

	return dimensionKeys, nil
}

func (l *ListMetricsService) GetMetricsByNamespace(namespace string) ([]models.ResourceResponse[models.Metric], error) {
	metrics, err := l.ListMetricsWithPageLimit(&cloudwatch.ListMetricsInput{Namespace: aws.String(namespace)})
	if err != nil {
		return nil, err
	}

	response := []models.ResourceResponse[models.Metric]{}
	dupCheck := make(map[string]struct{})
	for _, metric := range metrics {
		if _, exists := dupCheck[*metric.MetricName]; exists {
			continue
		}
		dupCheck[*metric.MetricName] = struct{}{}
		response = append(response, models.ResourceResponse[models.Metric]{Value: models.Metric{Name: *metric.MetricName, Namespace: *metric.Namespace}})
	}

	return response, nil
}

func setDimensionFilter(input *cloudwatch.ListMetricsInput, dimensionFilter []*resources.Dimension) {
	for _, dimension := range dimensionFilter {
		df := &cloudwatch.DimensionFilter{
			Name: aws.String(dimension.Name),
		}
		if dimension.Value != "" {
			df.Value = aws.String(dimension.Value)
		}
		input.Dimensions = append(input.Dimensions, df)
	}
}
