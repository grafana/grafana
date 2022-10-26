package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const timeSeriesQuery = "timeSeriesQuery"

var validMetricDataID = regexp.MustCompile(`^[a-z][a-zA-Z0-9_]*$`)

type metricsDataQuery struct {
	Dimensions        map[string]interface{} `json:"dimensions"`
	Expression        string                 `json:"expression"`
	Label             *string                `json:"label"`
	Id                string                 `json:"id"`
	MatchExact        *bool                  `json:"matchExact"`
	MetricEditorMode  *MetricEditorMode      `json:"metricEditorMode"`
	MetricName        string                 `json:"metricName"`
	MetricQueryType   MetricQueryType        `json:"metricQueryType"`
	Namespace         string                 `json:"namespace"`
	Period            string                 `json:"period"`
	Region            string                 `json:"region"`
	SqlExpression     string                 `json:"sqlExpression"`
	Statistic         *string                `json:"statistic"`
	Statistics        []*string              `json:"statistics"`
	TimezoneUTCOffset string                 `json:"timezoneUTCOffset"`
	QueryType         string                 `json:"type"`
	Hide              *bool                  `json:"hide"`
	Alias             string                 `json:"alias"`
}

// ParseMetricDataQueries decodes the metric data queries json, validates, sets default values and returns an array of CloudWatchQueries.
// The CloudWatchQuery has a 1 to 1 mapping to a query editor row
func ParseMetricDataQueries(dataQueries []backend.DataQuery, startTime time.Time, endTime time.Time, dynamicLabelsEnabled bool) ([]*CloudWatchQuery, error) {
	var metricDataQueries = make(map[string]metricsDataQuery)
	for _, query := range dataQueries {
		var metricsDataQuery metricsDataQuery
		err := json.Unmarshal(query.JSON, &metricsDataQuery)
		if err != nil {
			return nil, &QueryError{Err: err, RefID: query.RefID}
		}

		queryType := metricsDataQuery.QueryType
		if queryType != timeSeriesQuery && queryType != "" {
			continue
		}

		metricDataQueries[query.RefID] = metricsDataQuery
	}

	var result []*CloudWatchQuery
	for refId, mdq := range metricDataQueries {
		cwQuery := &CloudWatchQuery{
			Alias:             mdq.Alias,
			RefId:             refId,
			Id:                mdq.Id,
			Region:            mdq.Region,
			Namespace:         mdq.Namespace,
			MetricName:        mdq.MetricName,
			MetricQueryType:   mdq.MetricQueryType,
			SqlExpression:     mdq.SqlExpression,
			TimezoneUTCOffset: mdq.TimezoneUTCOffset,
			Expression:        mdq.Expression,
		}

		if err := cwQuery.validateAndSetDefaults(refId, mdq, startTime, endTime); err != nil {
			return nil, &QueryError{Err: err, RefID: refId}
		}

		cwQuery.migrateStatisticsAndAlias(mdq, dynamicLabelsEnabled)

		result = append(result, cwQuery)
	}

	return result, nil
}

func (q *CloudWatchQuery) migrateStatisticsAndAlias(query metricsDataQuery, dynamicLabelsEnabled bool) {
	q.Statistic = getStatistic(query)
	q.Label = getLabel(query, dynamicLabelsEnabled)
}

func (q *CloudWatchQuery) validateAndSetDefaults(refId string, metricsDataQuery metricsDataQuery, startTime, endTime time.Time) error {
	if metricsDataQuery.Statistic == nil && metricsDataQuery.Statistics == nil {
		return fmt.Errorf("query must have either statistic or statistics field")
	}

	var err error
	q.Period, err = getPeriod(metricsDataQuery, startTime, endTime)
	if err != nil {
		return err
	}

	q.Dimensions, err = parseDimensions(metricsDataQuery.Dimensions)
	if err != nil {
		return fmt.Errorf("failed to parse dimensions: %v", err)
	}

	if metricsDataQuery.Id == "" {
		// Why not just use refId if id is not specified in the frontend? When specifying an id in the editor,
		// and alphabetical must be used. The id must be unique, so if an id like for example a, b or c would be used,
		// it would likely collide with some ref id. That's why the `query` prefix is used.
		suffix := refId
		if !validMetricDataID.MatchString(suffix) {
			newUUID := uuid.NewString()
			suffix = strings.Replace(newUUID, "-", "", -1)
		}
		q.Id = fmt.Sprintf("query%s", suffix)
	}

	q.MatchExact = true
	if metricsDataQuery.MatchExact != nil {
		q.MatchExact = *metricsDataQuery.MatchExact
	}

	q.ReturnData = true
	if metricsDataQuery.Hide != nil {
		q.ReturnData = !*metricsDataQuery.Hide
	}
	if metricsDataQuery.QueryType == "" {
		// If no type is provided we assume we are called by alerting service, which requires to return data!
		// Note, this is sort of a hack, but the official Grafana interfaces do not carry the information
		// who (which service) called the TsdbQueryEndpoint.Query(...) function.
		q.ReturnData = true
	}

	if metricsDataQuery.MetricEditorMode == nil && len(metricsDataQuery.Expression) > 0 {
		// this should only ever happen if this is an alerting query that has not yet been migrated in the frontend
		q.MetricEditorMode = MetricEditorModeRaw
	} else {
		if metricsDataQuery.MetricEditorMode != nil {
			q.MetricEditorMode = *metricsDataQuery.MetricEditorMode
		} else {
			q.MetricEditorMode = MetricEditorModeBuilder
		}
	}

	return nil
}

// getStatistic determines the value of Statistic in a CloudWatchQuery from the metricsDataQuery input
// migrates queries that has a `statistics` field to use the `statistic` field instead.
// In case the query used more than one stat, the first stat in the slice will be used in the statistic field
// Read more here https://github.com/grafana/grafana/issues/30629
func getStatistic(query metricsDataQuery) string {
	// If there's not a statistic property in the json, we know it's the legacy format and then it has to be migrated
	if query.Statistic == nil {
		return *query.Statistics[0]
	}
	return *query.Statistic
}

var aliasPatterns = map[string]string{
	"metric":    `${PROP('MetricName')}`,
	"namespace": `${PROP('Namespace')}`,
	"period":    `${PROP('Period')}`,
	"region":    `${PROP('Region')}`,
	"stat":      `${PROP('Stat')}`,
	"label":     `${LABEL}`,
}

var legacyAliasRegexp = regexp.MustCompile(`{{\s*(.+?)\s*}}`)

func getLabel(query metricsDataQuery, dynamicLabelsEnabled bool) string {
	if query.Label != nil {
		return *query.Label
	}
	if query.Alias == "" {
		return ""
	}

	var result string
	if dynamicLabelsEnabled {
		fullAliasField := query.Alias
		matches := legacyAliasRegexp.FindAllStringSubmatch(query.Alias, -1)

		for _, groups := range matches {
			fullMatch := groups[0]
			subgroup := groups[1]
			if dynamicLabel, ok := aliasPatterns[subgroup]; ok {
				fullAliasField = strings.ReplaceAll(fullAliasField, fullMatch, dynamicLabel)
			} else {
				fullAliasField = strings.ReplaceAll(fullAliasField, fullMatch, fmt.Sprintf(`${PROP('Dim.%s')}`, subgroup))
			}
		}
		result = fullAliasField
	}
	return result
}

func getPeriod(query metricsDataQuery, startTime, endTime time.Time) (int, error) {
	periodString := query.Period
	var period int
	var err error
	if strings.ToLower(periodString) == "auto" || periodString == "" {
		deltaInSeconds := endTime.Sub(startTime).Seconds()
		periods := getRetainedPeriods(time.Since(startTime))
		datapoints := int(math.Ceil(deltaInSeconds / 2000))
		period = periods[len(periods)-1]
		for _, value := range periods {
			if datapoints <= value {
				period = value
				break
			}
		}
	} else {
		period, err = strconv.Atoi(periodString)
		if err != nil {
			d, err := time.ParseDuration(periodString)
			if err != nil {
				return 0, fmt.Errorf("failed to parse period as duration: %v", err)
			}
			period = int(d.Seconds())
		}
	}
	return period, nil
}

func getRetainedPeriods(timeSince time.Duration) []int {
	// See https://aws.amazon.com/about-aws/whats-new/2016/11/cloudwatch-extends-metrics-retention-and-new-user-interface/
	if timeSince > time.Duration(455)*24*time.Hour {
		return []int{21600, 86400}
	} else if timeSince > time.Duration(63)*24*time.Hour {
		return []int{3600, 21600, 86400}
	} else if timeSince > time.Duration(15)*24*time.Hour {
		return []int{300, 900, 3600, 21600, 86400}
	} else {
		return []int{60, 300, 900, 3600, 21600, 86400}
	}
}

func parseDimensions(dimensions map[string]interface{}) (map[string][]string, error) {
	parsedDimensions := make(map[string][]string)
	for k, v := range dimensions {
		// This is for backwards compatibility. Before 6.5 dimensions values were stored as strings and not arrays
		if value, ok := v.(string); ok {
			parsedDimensions[k] = []string{value}
		} else if values, ok := v.([]interface{}); ok {
			for _, value := range values {
				parsedDimensions[k] = append(parsedDimensions[k], value.(string))
			}
		} else {
			return nil, errors.New("unknown type as dimension value")
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
