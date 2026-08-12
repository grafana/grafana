package resources

import (
	"net/url"
)

type DimensionKeysRequestType uint32

const (
	StandardDimensionKeysRequest DimensionKeysRequestType = iota
	FilterDimensionKeysRequest
)

type DimensionKeysRequest struct {
	*ResourceRequest
	Namespace       string
	MetricName      string
	DimensionFilter []*Dimension
}

func (q *DimensionKeysRequest) Type() DimensionKeysRequestType {
	if isCustomNamespace(q.Namespace) || len(q.DimensionFilter) > 0 {
		return FilterDimensionKeysRequest
	}

	return StandardDimensionKeysRequest
}

func GetDimensionKeysRequest(parameters url.Values) (DimensionKeysRequest, error) {
	resourceRequest, err := getResourceRequest(parameters)
	if err != nil {
		return DimensionKeysRequest{}, err
	}

	request := DimensionKeysRequest{
		ResourceRequest: resourceRequest,
		Namespace:       parameters.Get("namespace"),
		MetricName:      parameters.Get("metricName"),
		DimensionFilter: []*Dimension{},
	}

	dimensions, err := parseDimensionFilter(parameters.Get("dimensionFilters"))
	if err != nil {
		return DimensionKeysRequest{}, err
	}

	request.DimensionFilter = dimensions

	return request, nil
}
