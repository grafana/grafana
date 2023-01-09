package resources

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/constants"
)

func parseDimensionFilter(dimensionFilter string) ([]*Dimension, error) {
	dimensionFilters := map[string]interface{}{}
	dimensionFilterJson := []byte(dimensionFilter)
	if len(dimensionFilterJson) > 0 {
		err := json.Unmarshal(dimensionFilterJson, &dimensionFilters)
		if err != nil {
			return nil, fmt.Errorf("error unmarshaling dimensionFilters: %v", err)
		}
	}

	dimensions := []*Dimension{}
	addDimension := func(key string, value string) {
		d := &Dimension{
			Name: key,
		}
		// if value is not specified or a wildcard is used, simply don't use the value field
		if value != "" && value != "*" {
			d.Value = value
		}
		dimensions = append(dimensions, d)
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

	return dimensions, nil
}

func isCustomNamespace(namespace string) bool {
	if _, ok := constants.NamespaceMetricsMap[namespace]; ok {
		return false
	}
	return true
}
