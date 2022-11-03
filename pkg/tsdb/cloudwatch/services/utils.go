package services

import (
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

func valuesToListMetricRespone[T any](values []T) []resources.ResourceResponse[T] {
	var response []resources.ResourceResponse[T]
	for _, value := range values {
		response = append(response, resources.ResourceResponse[T]{Value: value})
	}

	return response
}

func stringPtr(s string) *string { return &s }
