package cloudwatch

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *CloudWatchExecutor) parseQueries(queryContext *tsdb.TsdbQuery) (map[string]*cloudWatchQuery, error) {
	cloudwatchQueries := make(map[string]*cloudWatchQuery, 0)

	for i, model := range queryContext.Queries {
		queryType := model.Model.Get("type").MustString()
		if queryType != "timeSeriesQuery" && queryType != "" {
			continue
		}

		RefID := queryContext.Queries[i].RefId
		queryEditorRow, err := parseQueryEditorRow(queryContext.Queries[i].Model, RefID)
		if err != nil {
			return nil, &queryBuilderError{err, RefID}
		}

		for i, stat := range queryEditorRow.Statistics {
			id := queryEditorRow.Id
			if id == "" {
				id = fmt.Sprintf("query%s", RefID)
			}
			if len(queryEditorRow.Statistics) > 1 {
				id = fmt.Sprintf("%s_____%v", id, i)
			}

			query := &cloudWatchQuery{
				Id:             id,
				UserDefinedId:  queryEditorRow.Id,
				RefId:          queryEditorRow.RefId,
				Region:         queryEditorRow.Region,
				Namespace:      queryEditorRow.Namespace,
				MetricName:     queryEditorRow.MetricName,
				Dimensions:     queryEditorRow.Dimensions,
				Stats:          *stat,
				Period:         queryEditorRow.Period,
				Alias:          queryEditorRow.Alias,
				Expression:     queryEditorRow.Expression,
				ReturnData:     queryEditorRow.ReturnData,
				HighResolution: queryEditorRow.HighResolution,
				MatchExact:     queryEditorRow.MatchExact,
			}

			if _, ok := cloudwatchQueries[id]; !ok {
				cloudwatchQueries[id] = query
			} else {
				return nil, &queryBuilderError{
					err:   fmt.Errorf("Query id %s is not unique", query.Id),
					RefID: query.RefId,
				}
			}
		}
	}

	return cloudwatchQueries, nil
}

func parseQueryEditorRow(model *simplejson.Json, refId string) (*queryEditorRow, error) {
	region, err := model.Get("region").String()
	if err != nil {
		return nil, err
	}

	namespace, err := model.Get("namespace").String()
	if err != nil {
		return nil, err
	}

	metricName, err := model.Get("metricName").String()
	if err != nil {
		return nil, err
	}

	id := model.Get("id").MustString("")
	expression := model.Get("expression").MustString("")

	dimensions, err := parseDimensions(model)
	if err != nil {
		return nil, err
	}

	statistics, err := parseStatistics(model)
	if err != nil {
		return nil, err
	}

	p := model.Get("period").MustString("")
	if p == "" {
		if namespace == "AWS/EC2" {
			p = "300"
		} else {
			p = "60"
		}
	}

	var period int
	if regexp.MustCompile(`^\d+$`).Match([]byte(p)) {
		period, err = strconv.Atoi(p)
		if err != nil {
			return nil, err
		}
	} else {
		d, err := time.ParseDuration(p)
		if err != nil {
			return nil, err
		}
		period = int(d.Seconds())
	}

	alias := model.Get("alias").MustString()

	returnData := !model.Get("hide").MustBool(false)
	queryType := model.Get("type").MustString()
	if queryType == "" {
		// If no type is provided we assume we are called by alerting service, which requires to return data!
		// Note, this is sort of a hack, but the official Grafana interfaces do not carry the information
		// who (which service) called the TsdbQueryEndpoint.Query(...) function.
		returnData = true
	}
	highResolution := model.Get("highResolution").MustBool(false)

	matchExact := model.Get("matchExact").MustBool(true)

	return &queryEditorRow{
		RefId:          refId,
		Region:         region,
		Namespace:      namespace,
		MetricName:     metricName,
		Dimensions:     dimensions,
		Statistics:     aws.StringSlice(statistics),
		Period:         period,
		Alias:          alias,
		Id:             id,
		Expression:     expression,
		ReturnData:     returnData,
		HighResolution: highResolution,
		MatchExact:     matchExact,
	}, nil
}

func parseStatisticsAndExtendedStatistics(model *simplejson.Json) ([]string, []string, error) {
	var statistics []string
	var extendedStatistics []string

	for _, s := range model.Get("statistics").MustArray() {
		if ss, ok := s.(string); ok {
			if _, isStandard := standardStatistics[ss]; isStandard {
				statistics = append(statistics, ss)
			} else {
				extendedStatistics = append(extendedStatistics, ss)
			}
		} else {
			return nil, nil, errors.New("failed to parse")
		}
	}

	return statistics, extendedStatistics, nil
}

func parseStatistics(model *simplejson.Json) ([]string, error) {
	var statistics []string

	for _, s := range model.Get("statistics").MustArray() {
		statistics = append(statistics, s.(string))
	}

	return statistics, nil
}

func parseDimensions(model *simplejson.Json) (map[string][]string, error) {
	parsedDimensions := make(map[string][]string)
	for k, v := range model.Get("dimensions").MustMap() {
		kk := k
		// This is for backwards compatibility. Before 6.5 dimensions values were stored as strings and not arrays
		if value, ok := v.(string); ok {
			parsedDimensions[kk] = []string{value}
		} else if values, ok := v.([]interface{}); ok {
			for _, value := range values {
				parsedDimensions[kk] = append(parsedDimensions[kk], value.(string))
			}
		} else {
			return nil, errors.New("failed to parse")
		}
	}

	sortedDimensions := sortDimensions(parsedDimensions)

	return sortedDimensions, nil
}

func sortDimensions(dimensions map[string][]string) map[string][]string {
	sortedDimensions := make(map[string][]string)
	var keys []string
	for k := range dimensions {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		sortedDimensions[k] = dimensions[k]
	}
	return sortedDimensions
}
