package services

import "github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"

func valuesToListMetricRespone[T any](values []T) []models.ResourceResponse[T] {
	var response []models.ResourceResponse[T]
	for _, value := range values {
		response = append(response, models.ResourceResponse[T]{Value: value})
	}

	return response
}

func stringPtr(s string) *string { return &s }
