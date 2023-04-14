package resources

import (
	"net/url"
)

type MetricsRequestType uint32

const (
	MetricsByNamespaceRequestType MetricsRequestType = iota
	AllMetricsRequestType
	CustomNamespaceRequestType
)

type MetricsRequest struct {
	*ResourceRequest
	Namespace string
}

func GetMetricsRequest(parameters url.Values) (MetricsRequest, error) {
	resourceRequest, err := getResourceRequest(parameters)
	if err != nil {
		return MetricsRequest{}, err
	}

	return MetricsRequest{
		ResourceRequest: resourceRequest,
		Namespace:       parameters.Get("namespace"),
	}, nil
}

func (r *MetricsRequest) Type() MetricsRequestType {
	if r.Namespace == "" {
		return AllMetricsRequestType
	}

	if isCustomNamespace(r.Namespace) {
		return CustomNamespaceRequestType
	}

	return MetricsByNamespaceRequestType
}
