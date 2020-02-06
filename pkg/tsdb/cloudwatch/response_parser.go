package cloudwatch

import (
	"fmt"
	// "sort"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/tsdb"
	"regexp"
)

func prettyPrint(i interface{}) string {
	s, _ := json.MarshalIndent(i, "", "\t")
	return string(s)
}

func (e *CloudWatchExecutor) parseResponse(metricDataOutputs []*cloudwatch.GetMetricDataOutput, queries map[string]*cloudWatchQuery) ([]*cloudwatchResponse, error) {
	mdr := make(map[string]map[string]*cloudwatch.MetricDataResult)

	for _, mdo := range metricDataOutputs {
		requestExceededMaxLimit := false
		for _, message := range mdo.Messages {
			if *message.Code == "MaxMetricsExceeded" {
				requestExceededMaxLimit = true
			}
		}

		for _, r := range mdo.MetricDataResults {
			if _, exists := mdr[*r.Id]; !exists {
				mdr[*r.Id] = make(map[string]*cloudwatch.MetricDataResult)
				mdr[*r.Id][*r.Label] = r
			} else if _, exists := mdr[*r.Id][*r.Label]; !exists {
				mdr[*r.Id][*r.Label] = r
			} else {
				mdr[*r.Id][*r.Label].Timestamps = append(mdr[*r.Id][*r.Label].Timestamps, r.Timestamps...)
				mdr[*r.Id][*r.Label].Values = append(mdr[*r.Id][*r.Label].Values, r.Values...)
				if *r.StatusCode == "Complete" {
					mdr[*r.Id][*r.Label].StatusCode = r.StatusCode
				}
			}
			queries[*r.Id].RequestExceededMaxLimit = requestExceededMaxLimit
		}
	}

	cloudWatchResponses := make([]*cloudwatchResponse, 0)
	for id, lr := range mdr {
		response := &cloudwatchResponse{}
		series, partialData, err := parseGetMetricDataTimeSeries(lr, queries[id])
		if err != nil {
			return cloudWatchResponses, err
		}

		response.series = series
		response.Period = queries[id].Period
		response.Expression = queries[id].UsedExpression
		response.RefId = queries[id].RefId
		response.Id = queries[id].Id
		response.RequestExceededMaxLimit = queries[id].RequestExceededMaxLimit
		response.PartialData = partialData

		cloudWatchResponses = append(cloudWatchResponses, response)
	}

	return cloudWatchResponses, nil
}

func calculateLabels(queryDimensions map[string][]string, alias string, label string) []map[string]string {
	// A non greedy regex looking for templated vars eg {{AvailabilityZone}}
	m := regexp.MustCompile(`{{(.*?)}}`)
	dimensionsMatch := m.FindAllStringSubmatch(alias, -1)

	plog.Info("dimensionsMatch")
	plog.Info(prettyPrint(dimensionsMatch))

	plog.Info("queryDimensions")
	plog.Info(prettyPrint(queryDimensions))

	//dimensionsMatch is an array of arrays, the second item in each array is the extracted value (the dimension name)
	dimensions := make([]string, 0)
	for dm := range dimensionsMatch {
		dimensions = append(dimensions, dimensionsMatch[dm][1])
	}

	plog.Info("dimensions")
	plog.Info(prettyPrint(dimensions))

	aliasTags := make([]map[string]string, 0)
	aliasCount := 1

	for d := range dimensions {
		aliasCount = aliasCount * len(queryDimensions[dimensions[d]])
	}

	plog.Info("aliasCount")
	plog.Info(prettyPrint(aliasCount))

	for i := 0; i < aliasCount; i++ {
		// singleAliasTags := make([]string, 0)
		// var tagArray []string

		// if len(aliasTags) >= i {
		// 	tagArray = aliasTags[i]
		// } else {
		// 	tagArray = make([]string, 0)
		// }

		tagArray := make(map[string]string, 0)

		for d := range dimensions {
			// aliasCount = aliasCount * len(queryDimensions[dimensions[d]])
			dimensionIndex := i % len(queryDimensions[dimensions[d]])
			dimensionValue := queryDimensions[dimensions[d]][dimensionIndex]
			plog.Info("modulo")
			plog.Info(dimensions[d])
			plog.Info(prettyPrint(dimensionIndex))
			plog.Info(dimensionValue)
			tagArray[dimensions[d]] = dimensionValue
		}

		plog.Info("tagArray")
		plog.Info(prettyPrint(tagArray))

		aliasTags = append(aliasTags, tagArray)

		// for qd := range queryDimensions[dimensions[d]] {
		// 	singleAliasTags = append(singleAliasTags, queryDimensions[dimensions[d]][qd])
		// }
		// aliasTags = append(aliasTags, singleAliasTags)
		// plog.Info(prettyPrint(queryDimensions[dimensions[d]]))
		// aliasCount = aliasCount + len(queryDimensions[dimensions[d]])
	}

	plog.Info("aliasTags")
	plog.Info(prettyPrint(aliasTags))
	// tags := make(map[string]map[string])

	// labels := make([]string, 0)

	// for d := range requiredDimensions {
	// 	dimension = strings.Replace(d, "\{\{", "", 1)
	// }

	return aliasTags //[]string{"eu-west-2a", "eu-west-2b", "eu-west-2c"}
}

func parseGetMetricDataTimeSeries(metricDataResults map[string]*cloudwatch.MetricDataResult, query *cloudWatchQuery) (*tsdb.TimeSeriesSlice, bool, error) {

	plog.Info("parseGetMetricDataTimeSeries")
	plog.Info(prettyPrint(metricDataResults))
	plog.Info(prettyPrint(query))

	result := tsdb.TimeSeriesSlice{}
	partialData := false
	// metricDataResultLabels := make([]string, 0)
	// for k := range metricDataResults {
	// 	metricDataResultLabels = append(metricDataResultLabels, k)
	// }

	metricDataResultLabels := calculateLabels(query.Dimensions, query.Alias, query.Id) //[]string{"eu-west-2a", "eu-west-2b", "eu-west-2c"}
	// sort.Strings(metricDataResultLabels)

	plog.Info("metricDataResultLabels")
	plog.Info(prettyPrint(metricDataResultLabels))

	// calculatedLabels := calculateLabels(query.Dimensions, query.Alias)

	// plog.Info("calculatedLabels")
	// plog.Info(prettyPrint(calculatedLabels))

	// keys := make([]string, 0)
	// for k := range query.Dimensions {
	// 	keys = append(keys, k)
	// }
	// sort.Strings(keys)

	// plog.Info("keys")
	// plog.Info(prettyPrint(keys))

	// tags := make(map[string]map[string])
	// for _, key := range keys {
	// 	values := query.Dimensions[key]
	// 	if len(values) == 1 && values[0] != "*" {
	// 		tags[key] = values[0]
	// 	} else {
	// 		for _, value := range values {
	// 			if value == label || value == "*" {
	// 				tags[key] = label
	// 			} else if strings.Contains(label, value) {
	// 				tags[key] = value
	// 			}
	// 		}
	// 	}
	// }

	// log.Info("tags")
	// plog.Info(prettyPrint(tags))

	for _, labels := range metricDataResultLabels {

		plog.Info("plotting label")
		plog.Info(prettyPrint(labels))

		var hasMetrics = false
		var metricDataResult *cloudwatch.MetricDataResult
		var label string

		for _, l := range labels {
			metricDataResultInner, hasMetricsInner := metricDataResults[l]
			if hasMetricsInner {
				hasMetrics = true
				metricDataResult = metricDataResultInner
				label = l
				break
			}
		}

		if hasMetrics {
			if *metricDataResult.StatusCode != "Complete" {
				partialData = true
			}

			for _, message := range metricDataResult.Messages {
				if *message.Code == "ArithmeticError" {
					return nil, false, fmt.Errorf("ArithmeticError in query %s: %s", query.RefId, *message.Value)
				}
			}

		}

		series := tsdb.TimeSeries{
			Tags:   labels,
			Points: make([]tsdb.TimePoint, 0),
		}

		// keys := make([]string, 0)
		// for k := range query.Dimensions {
		// 	keys = append(keys, k)
		// }
		// sort.Strings(keys)

		// plog.Info("keys")
		// plog.Info(prettyPrint(keys))

		// for _, key := range keys {
		// 	values := query.Dimensions[key]
		// 	if len(values) == 1 && values[0] != "*" {
		// 		series.Tags[key] = values[0]
		// 	} else {
		// 		for _, value := range values {
		// 			if value == label || value == "*" {
		// 				series.Tags[key] = label
		// 			} else if strings.Contains(label, value) {
		// 				series.Tags[key] = value
		// 			}
		// 		}
		// 	}
		// }

		series.Name = formatAlias(query, query.Stats, series.Tags, label)

		plog.Info("series")
		plog.Info(prettyPrint(series))

		if hasMetrics {
			for j, t := range metricDataResult.Timestamps {
				if j > 0 {
					expectedTimestamp := metricDataResult.Timestamps[j-1].Add(time.Duration(query.Period) * time.Second)
					if expectedTimestamp.Before(*t) {
						series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), float64(expectedTimestamp.Unix()*1000)))
					}
				}
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(*metricDataResult.Values[j]), float64((*t).Unix())*1000))
			}
		} else {
			plog.Info("No timestamps")
			// series.Points := []
		}
		result = append(result, &series)
	}
	return &result, partialData, nil
}

func formatAlias(query *cloudWatchQuery, stat string, dimensions map[string]string, label string) string {
	region := query.Region
	namespace := query.Namespace
	metricName := query.MetricName
	period := strconv.Itoa(query.Period)

	if query.isUserDefinedSearchExpression() {
		pIndex := strings.LastIndex(query.Expression, ",")
		period = strings.Trim(query.Expression[pIndex+1:], " )")
		sIndex := strings.LastIndex(query.Expression[:pIndex], ",")
		stat = strings.Trim(query.Expression[sIndex+1:pIndex], " '")
	}

	if len(query.Alias) == 0 && query.isMathExpression() {
		return query.Id
	}

	if len(query.Alias) == 0 && query.isInferredSearchExpression() {
		return label
	}

	data := map[string]string{}
	data["region"] = region
	data["namespace"] = namespace
	data["metric"] = metricName
	data["stat"] = stat
	data["period"] = period
	if len(label) != 0 {
		data["label"] = label
	}
	for k, v := range dimensions {
		data[k] = v
	}

	result := aliasFormat.ReplaceAllFunc([]byte(query.Alias), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := data[labelName]; exists {
			return []byte(val)
		}

		return in
	})

	if string(result) == "" {
		return metricName + "_" + stat
	}

	return string(result)
}
