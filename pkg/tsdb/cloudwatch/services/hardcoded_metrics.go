package services

import (
	"fmt"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/constants"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

var GetHardCodedDimensionKeysByNamespace = func(namespace string) ([]resources.ResourceResponse[string], error) {
	var response []string
	exists := false
	if response, exists = constants.NamespaceDimensionKeysMap[namespace]; !exists {
		return nil, fmt.Errorf("unable to find dimensions for namespace '%q'", namespace)
	}
	return valuesToListMetricRespone(response), nil
}

var GetHardCodedMetricsByNamespace = func(namespace string) ([]resources.ResourceResponse[resources.Metric], error) {
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

var GetAllHardCodedMetrics = func() []resources.ResourceResponse[resources.Metric] {
	response := []resources.Metric{}
	for namespace, metrics := range constants.NamespaceMetricsMap {
		for _, metric := range metrics {
			response = append(response, resources.Metric{Namespace: namespace, Name: metric})
		}
	}

	return valuesToListMetricRespone(response)
}

var GetHardCodedNamespaces = func() []resources.ResourceResponse[string] {
	response := []string{}
	for key := range constants.NamespaceMetricsMap {
		response = append(response, key)
	}

	return valuesToListMetricRespone(response)
}
