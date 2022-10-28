package services

import (
	"fmt"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/constants"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

var GetHardCodedDimensionKeysByNamespace = func(namespace string) ([]resources.ResourceResponse[string], error) {
	var dimensionKeys []string
	exists := false
	if dimensionKeys, exists = constants.NamespaceDimensionKeysMap[namespace]; !exists {
		return nil, fmt.Errorf("unable to find dimensions for namespace '%q'", namespace)
	}
	return valuesToListMetricRespone(dimensionKeys), nil
}

var GetHardCodedMetricsByNamespace = func(namespace string) ([]resources.ResourceResponse[models.Metric], error) {
	response := []resources.Metric{}
	exists := false
	var metrics []string
	if metrics, exists = constants.NamespaceMetricsMap[namespace]; !exists {
		return nil, fmt.Errorf("unable to find metrics for namespace '%q'", namespace)
	}

	for _, metric := range metrics {
		response = append(response, resources.Metric{Namespace: namespace, Name: metric})
	}

	return valuesToListMetricRespone(response), nil
}

var GetAllHardCodedMetrics = func() []resources.ResourceResponse[models.Metric] {
	response := []resources.Metric{}
	for namespace, metrics := range constants.NamespaceMetricsMap {
		for _, metric := range metrics {
			response = append(response, resources.Metric{Namespace: namespace, Name: metric})
		}
	}

	return valuesToListMetricRespone(response)
}

var GetHardCodedNamespaces = func() []models.ResourceResponse[string] {
	var namespaces []string
	for key := range constants.NamespaceMetricsMap {
		namespaces = append(namespaces, key)
	}

	return valuesToListMetricRespone(namespaces)
}
