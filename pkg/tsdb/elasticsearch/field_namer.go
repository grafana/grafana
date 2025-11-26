package elasticsearch

import (
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// nameFields applies naming logic to data frame fields based on query configuration
func nameFields(queryResult backend.DataResponse, target *Query, keepLabelsInResponse bool) {
	set := make(map[string]struct{})
	frames := queryResult.Frames
	for _, v := range frames {
		for _, vv := range v.Fields {
			if metricType, exists := vv.Labels["metric"]; exists {
				if _, ok := set[metricType]; !ok {
					set[metricType] = struct{}{}
				}
			}
		}
	}
	metricTypeCount := len(set)
	for _, frame := range frames {
		if frame.Meta != nil && frame.Meta.Type == data.FrameTypeTimeSeriesMulti {
			// if it is a time-series-multi, it means it has two columns, one is "time",
			// another is "number"
			valueField := frame.Fields[1]
			fieldName := getFieldName(*valueField, target, metricTypeCount)
			// If we  need to keep the labels in the response, to prevent duplication in names and to keep
			// backward compatibility with alerting and expressions we use DisplayNameFromDS
			if keepLabelsInResponse {
				if valueField.Config == nil {
					valueField.Config = &data.FieldConfig{}
				}
				valueField.Config.DisplayNameFromDS = fieldName
				// If we don't need to keep labels (how frontend mode worked), we use frame.Name and remove labels
			} else {
				valueField.Labels = nil
				frame.Name = fieldName
			}
		}
	}
}

// getFieldName generates a field name based on the data field and target configuration
func getFieldName(dataField data.Field, target *Query, metricTypeCount int) string {
	metricType := dataField.Labels["metric"]
	metricName := getMetricName(metricType)
	delete(dataField.Labels, "metric")

	field := ""
	if v, ok := dataField.Labels["field"]; ok {
		field = v
		delete(dataField.Labels, "field")
	}

	if target.Alias != "" {
		frameName := target.Alias

		subMatches := aliasPatternRegex.FindAllStringSubmatch(target.Alias, -1)
		for _, subMatch := range subMatches {
			group := subMatch[0]

			if len(subMatch) > 1 {
				group = subMatch[1]
			}

			if strings.Index(group, "term ") == 0 {
				frameName = strings.Replace(frameName, subMatch[0], dataField.Labels[group[5:]], 1)
			}
			if v, ok := dataField.Labels[group]; ok {
				frameName = strings.Replace(frameName, subMatch[0], v, 1)
			}
			if group == "metric" {
				frameName = strings.Replace(frameName, subMatch[0], metricName, 1)
			}
			if group == "field" {
				frameName = strings.Replace(frameName, subMatch[0], field, 1)
			}
		}

		return frameName
	}
	// todo, if field and pipelineAgg
	if isPipelineAgg(metricType) {
		if metricType != "" && isPipelineAggWithMultipleBucketPaths(metricType) {
			metricID := ""
			if v, ok := dataField.Labels["metricId"]; ok {
				metricID = v
			}

			for _, metric := range target.Metrics {
				if metric.ID == metricID {
					metricName = metric.Settings.Get("script").MustString()
					for name, pipelineAgg := range metric.PipelineVariables {
						for _, m := range target.Metrics {
							if m.ID == pipelineAgg {
								metricName = strings.ReplaceAll(metricName, "params."+name, describeMetric(m.Type, m.Field))
							}
						}
					}
				}
			}
		} else {
			if field != "" {
				found := false
				for _, metric := range target.Metrics {
					if metric.ID == field {
						metricName += " " + describeMetric(metric.Type, metric.Field)
						found = true
					}
				}
				if !found {
					metricName = "Unset"
				}
			}
		}
	} else if field != "" {
		metricName += " " + field
	}

	delete(dataField.Labels, "metricId")

	if len(dataField.Labels) == 0 {
		return metricName
	}

	name := ""
	for _, v := range getSortedLabelValues(dataField.Labels) {
		name += v + " "
	}

	if metricTypeCount == 1 {
		return strings.TrimSpace(name)
	}

	return strings.TrimSpace(name) + " " + metricName
}

// getSortedLabelValues sorts label keys and returns the label values in sorted order
func getSortedLabelValues(labels data.Labels) []string {
	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	values := make([]string, len(keys))
	for i, key := range keys {
		values[i] = labels[key]
	}

	return values
}

// getMetricName returns the display name for a metric type
func getMetricName(metric string) string {
	if text, ok := metricAggType[metric]; ok {
		return text
	}

	if text, ok := extendedStats[metric]; ok {
		return text
	}

	return metric
}
