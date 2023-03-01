package resources

import (
	"net/url"
)

type DimensionValuesRequest struct {
	*ResourceRequest
	Namespace       string
	MetricName      string
	DimensionKey    string
	DimensionFilter []*Dimension
}

func GetDimensionValuesRequest(parameters url.Values) (DimensionValuesRequest, error) {
	resourceRequest, err := getResourceRequest(parameters)
	if err != nil {
		return DimensionValuesRequest{}, err
	}

	request := DimensionValuesRequest{
		ResourceRequest: resourceRequest,
		Namespace:       parameters.Get("namespace"),
		MetricName:      parameters.Get("metricName"),
		DimensionKey:    parameters.Get("dimensionKey"),
		DimensionFilter: []*Dimension{},
	}

	dimensions, err := parseDimensionFilter(parameters.Get("dimensionFilters"))
	if err != nil {
		return DimensionValuesRequest{}, err
	}

	request.DimensionFilter = dimensions

	return request, nil
}
