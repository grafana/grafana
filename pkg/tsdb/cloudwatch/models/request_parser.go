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

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/cwlog"
)

const timeSeriesQuery = "timeSeriesQuery"

var validMetricDataID = regexp.MustCompile(`^[a-z][a-zA-Z0-9_]*$`)

type metricsDataQuery struct {
	Datasource        map[string]string      `json:"datasource,omitempty"`
	Dimensions        map[string]interface{} `json:"dimensions,omitempty"`
	Expression        string                 `json:"expression,omitempty"`
	Id                string                 `json:"id,omitempty"`
	Label             *string                `json:"label,omitempty"`
	MatchExact        *bool                  `json:"matchExact,omitempty"`
	MaxDataPoints     int                    `json:"maxDataPoints,omitempty"`
	MetricEditorMode  *int                   `json:"metricEditorMode,omitempty"`
	MetricName        string                 `json:"metricName,omitempty"`
	MetricQueryType   MetricQueryType        `json:"metricQueryType,omitempty"`
	Namespace         string                 `json:"namespace,omitempty"`
	Period            string                 `json:"period,omitempty"`
	RefId             string                 `json:"refId,omitempty"`
	Region            string                 `json:"region,omitempty"`
	SqlExpression     string                 `json:"sqlExpression,omitempty"`
	Statistic         *string                `json:"statistic,omitempty"`
	Statistics        []*string              `json:"statistics,omitempty"`
	TimezoneUTCOffset string                 `json:"timezoneUTCOffset,omitempty"`
	QueryType         string                 `json:"type,omitempty"`
	Hide              *bool                  `json:"hide,omitempty"`
	Alias             string                 `json:"alias,omitempty"`
}

// ParseMetricDataQueries decodes the metric data queries json, validates, sets default values and returns an array of CloudWatchQueries.
// The CloudWatchQuery has a 1 to 1 mapping to a query editor row
func ParseMetricDataQueries(queries []backend.DataQuery, startTime time.Time, endTime time.Time, dynamicLabelsEnabled bool) ([]*CloudWatchQuery, error) {
	var result []*CloudWatchQuery
	migratedQueries, err := migrateLegacyQuery(queries, dynamicLabelsEnabled)
	if err != nil {
		return nil, err
	}

	for _, query := range migratedQueries {
		var metricsDataQuery metricsDataQuery
		err := json.Unmarshal(query.JSON, &metricsDataQuery)
		if err != nil {
			return nil, &QueryError{Err: err, RefID: query.RefID}
		}

		queryType := metricsDataQuery.QueryType
		if queryType != timeSeriesQuery && queryType != "" {
			continue
		}

		if metricsDataQuery.MatchExact == nil {
			trueBooleanValue := true
			metricsDataQuery.MatchExact = &trueBooleanValue
		}

		refID := query.RefID
		cwQuery, err := parseRequestQuery(metricsDataQuery, refID, startTime, endTime)
		if err != nil {
			return nil, &QueryError{Err: err, RefID: refID}
		}
		result = append(result, cwQuery)
	}

	return result, nil
}

// migrateLegacyQuery is also done in the frontend, so this should only ever be needed for alerting queries
func migrateLegacyQuery(queries []backend.DataQuery, dynamicLabelsEnabled bool) ([]*backend.DataQuery, error) {
	migratedQueries := []*backend.DataQuery{}
	for _, q := range queries {
		query := q
		var queryJson *metricsDataQuery
		err := json.Unmarshal(query.JSON, &queryJson)
		if err != nil {
			return nil, err
		}

		if err := migrateStatisticsToStatistic(queryJson); err != nil {
			return nil, err
		}

		if queryJson.Label == nil && dynamicLabelsEnabled {
			migrateAliasToDynamicLabel(queryJson)
		}
		query.JSON, err = json.Marshal(queryJson)
		if err != nil {
			return nil, err
		}

		migratedQueries = append(migratedQueries, &query)
	}

	return migratedQueries, nil
}

// migrateStatisticsToStatistic migrates queries that has a `statistics` field to use the `statistic` field instead.
// In case the query used more than one stat, the first stat in the slice will be used in the statistic field
// Read more here https://github.com/grafana/grafana/issues/30629
func migrateStatisticsToStatistic(queryJson *metricsDataQuery) error {
	// If there's not a statistic property in the json, we know it's the legacy format and then it has to be migrated
	if queryJson.Statistic == nil {
		if queryJson.Statistics == nil {
			return fmt.Errorf("query must have either statistic or statistics field")
		}

		queryJson.Statistic = queryJson.Statistics[0]
		queryJson.Statistics = nil
	}

	return nil
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

func migrateAliasToDynamicLabel(queryJson *metricsDataQuery) {
	fullAliasField := queryJson.Alias

	if fullAliasField != "" {
		matches := legacyAliasRegexp.FindAllStringSubmatch(fullAliasField, -1)

		for _, groups := range matches {
			fullMatch := groups[0]
			subgroup := groups[1]
			if dynamicLabel, ok := aliasPatterns[subgroup]; ok {
				fullAliasField = strings.ReplaceAll(fullAliasField, fullMatch, dynamicLabel)
			} else {
				fullAliasField = strings.ReplaceAll(fullAliasField, fullMatch, fmt.Sprintf(`${PROP('Dim.%s')}`, subgroup))
			}
		}
	}
	queryJson.Label = &fullAliasField
}

func parseRequestQuery(dataQuery metricsDataQuery, refId string, startTime time.Time, endTime time.Time) (*CloudWatchQuery, error) {
	cwlog.Debug("Parsing request query", "query", dataQuery)
	result := CloudWatchQuery{
		Alias:             dataQuery.Alias,
		Label:             "",
		MatchExact:        true,
		Statistic:         "",
		ReturnData:        true,
		UsedExpression:    "",
		RefId:             refId,
		Id:                dataQuery.Id,
		Region:            dataQuery.Region,
		Namespace:         dataQuery.Namespace,
		MetricName:        dataQuery.MetricName,
		MetricQueryType:   dataQuery.MetricQueryType,
		SqlExpression:     dataQuery.SqlExpression,
		TimezoneUTCOffset: dataQuery.TimezoneUTCOffset,
		Expression:        dataQuery.Expression,
	}
	reNumber := regexp.MustCompile(`^\d+$`)
	dimensions, err := parseDimensions(dataQuery.Dimensions)
	if err != nil {
		return nil, fmt.Errorf("failed to parse dimensions: %v", err)
	}
	result.Dimensions = dimensions

	p := dataQuery.Period
	var period int
	if strings.ToLower(p) == "auto" || p == "" {
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
		if reNumber.Match([]byte(p)) {
			period, err = strconv.Atoi(p)
			if err != nil {
				return nil, fmt.Errorf("failed to parse period as integer: %v", err)
			}
		} else {
			d, err := time.ParseDuration(p)
			if err != nil {
				return nil, fmt.Errorf("failed to parse period as duration: %v", err)
			}
			period = int(d.Seconds())
		}
	}
	result.Period = period

	if dataQuery.Id == "" {
		// Why not just use refId if id is not specified in the frontend? When specifying an id in the editor,
		// and alphabetical must be used. The id must be unique, so if an id like for example a, b or c would be used,
		// it would likely collide with some ref id. That's why the `query` prefix is used.
		suffix := refId
		if !validMetricDataID.MatchString(suffix) {
			newUUID := uuid.NewString()
			suffix = strings.Replace(newUUID, "-", "", -1)
		}
		result.Id = fmt.Sprintf("query%s", suffix)
	}

	if dataQuery.Hide != nil {
		result.ReturnData = !*dataQuery.Hide
	}

	if dataQuery.QueryType == "" {
		// If no type is provided we assume we are called by alerting service, which requires to return data!
		// Note, this is sort of a hack, but the official Grafana interfaces do not carry the information
		// who (which service) called the TsdbQueryEndpoint.Query(...) function.
		result.ReturnData = true
	}

	if dataQuery.MetricEditorMode == nil && len(dataQuery.Expression) > 0 {
		// this should only ever happen if this is an alerting query that has not yet been migrated in the frontend
		result.MetricEditorMode = MetricEditorModeRaw
	} else {
		if dataQuery.MetricEditorMode != nil {
			result.MetricEditorMode = MetricEditorMode(*dataQuery.MetricEditorMode)
		} else {
			result.MetricEditorMode = MetricEditorMode(0)
		}
	}

	if dataQuery.Statistic != nil {
		result.Statistic = *dataQuery.Statistic
	}

	if dataQuery.MatchExact != nil {
		result.MatchExact = *dataQuery.MatchExact
	}

	if dataQuery.Label != nil {
		result.Label = *dataQuery.Label
	}

	return &result, nil
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
