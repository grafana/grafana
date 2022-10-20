package models

import (
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/constants"
)

type DimensionKeysRequestType uint32

const (
	StandardDimensionKeysRequest DimensionKeysRequestType = iota
	FilterDimensionKeysRequest
	CustomMetricDimensionKeysRequest
)

type Dimension struct {
	Name  string
	Value string
}

type DimensionKeysRequest struct {
	Region          string `json:"region"`
	Namespace       string `json:"namespace"`
	MetricName      string `json:"metricName"`
	DimensionFilter []*Dimension
}

func (q *DimensionKeysRequest) Type() DimensionKeysRequestType {
	if _, exist := constants.NamespaceMetricsMap[q.Namespace]; !exist {
		return CustomMetricDimensionKeysRequest
	}

	if len(q.DimensionFilter) > 0 {
		return FilterDimensionKeysRequest
	}

	return StandardDimensionKeysRequest
}

func GetDimensionKeysRequest(parameters url.Values) (*DimensionKeysRequest, error) {
	req := &DimensionKeysRequest{
		Region:          parameters.Get("region"),
		Namespace:       parameters.Get("namespace"),
		MetricName:      parameters.Get("metricName"),
		DimensionFilter: []*Dimension{},
	}

	if req.Region == "" {
		return nil, fmt.Errorf("region is required")
	}

	dimensionFilters := map[string]interface{}{}
	dimensionFilterJson := []byte(parameters.Get("dimensionFilters"))
	if len(dimensionFilterJson) > 0 {
		err := json.Unmarshal(dimensionFilterJson, &dimensionFilters)
		if err != nil {
			return nil, fmt.Errorf("error unmarshaling dimensionFilters: %v", err)
		}
	}
	addDimension := func(key string, value string) {
		d := &Dimension{
			Name: key,
		}
		// if value is not specified or a wildcard is used, simply don't use the value field
		if value != "" && value != "*" {
			d.Value = value
		}
		req.DimensionFilter = append(req.DimensionFilter, d)
	}

	for k, v := range dimensionFilters {
		// due to legacy, value can be a string, a string slice or nil
		if vv, ok := v.(string); ok {
			addDimension(k, vv)
		} else if vv, ok := v.([]interface{}); ok {
			for _, v := range vv {
				addDimension(k, v.(string))
			}
		} else if v == nil {
			addDimension(k, "")
		}
	}

	return req, nil
}
