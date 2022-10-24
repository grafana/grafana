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
	Datasource        map[string]string      `json:"datasource"`
	Dimensions        map[string]interface{} `json:"dimensions"`
	Expression        string                 `json:"expression"`
	Id                string                 `json:"id"`
	Label             *string                `json:"label"`
	MatchExactPointer *bool                  `json:"matchExact"`
	MaxDataPoints     int                    `json:"maxDataPoints"`
	MetricEditorMode  *MetricEditorMode      `json:"metricEditorMode"`
	MetricName        string                 `json:"metricName"`
	MetricQueryType   MetricQueryType        `json:"metricQueryType"`
	Namespace         string                 `json:"namespace"`
	Period            string                 `json:"period"`
	RefId             string                 `json:"refId"`
	Region            string                 `json:"region"`
	SqlExpression     string                 `json:"sqlExpression"`
	Statistic         *string                `json:"statistic"`
	Statistics        []*string              `json:"statistics"`
	TimezoneUTCOffset string                 `json:"timezoneUTCOffset"`
	QueryType         string                 `json:"type"`
	Hide              *bool                  `json:"hide"`
	Alias             string                 `json:"alias"`
}

// TODO: move this to cloudwatch_query.go
func ParseMetricDataQueries(dataQueries []backend.DataQuery, startTime time.Time, endTime time.Time, dynamicLabelsEnabled bool) ([]*CloudWatchQuery, error) {
	var metricDataQueries []metricsDataQuery
	for _, dataQuery := range dataQueries {
		var mdq metricsDataQuery
		err := json.Unmarshal(dataQuery.JSON, &mdq)
		if err != nil {
			return nil, &QueryError{Err: err, RefID: dataQuery.RefID}
		}

		if mdq.QueryType != timeSeriesQuery && mdq.QueryType != "" { // TODO: do we need this line or can we check for it in QueryData?
			continue
		}

		metricDataQueries = append(metricDataQueries, mdq)
	}

	var cloudWatchQueries []*CloudWatchQuery
	for _, query := range metricDataQueries {
		cloudWatchQuery := toCloudWatchQuery(query)
		if err := cloudWatchQuery.validateAndSetDefaults(query, startTime, endTime); err != nil {
			return nil, err
		}

		// migrate
		cloudWatchQuery.Statistic = migrateStatisticsToStatistic(query)
		cloudWatchQuery.Label = migrateAliasToDynamicLabel(query, dynamicLabelsEnabled)

		cloudWatchQueries = append(cloudWatchQueries, cloudWatchQuery)
	}

	return cloudWatchQueries, nil
}

func (q *CloudWatchQuery) validateAndSetDefaults(metricsDataQuery metricsDataQuery, startTime, endTime time.Time) error {
	var err error
	if metricsDataQuery.Statistic == nil && metricsDataQuery.Statistics == nil {
		return fmt.Errorf("query must have either statistic or statistics field")
	}

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
		suffix := metricsDataQuery.RefId
		if !validMetricDataID.MatchString(suffix) {
			newUUID := uuid.NewString()
			suffix = strings.Replace(newUUID, "-", "", -1)
		}
		q.Id = fmt.Sprintf("query%s", suffix)
	}

	q.MatchExact = true
	if metricsDataQuery.MatchExactPointer != nil {
		q.MatchExact = *metricsDataQuery.MatchExactPointer
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

// migrateStatisticsToStatistic migrates queries that has a `statistics` field to use the `statistic` field instead.
// In case the query used more than one stat, the first stat in the slice will be used in the statistic field
// Read more here https://github.com/grafana/grafana/issues/30629
func migrateStatisticsToStatistic(query metricsDataQuery) string {
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

func migrateAliasToDynamicLabel(query metricsDataQuery, dynamicLabelsEnabled bool) string {
	if query.Label == nil {
		if dynamicLabelsEnabled {
			fullAliasField := query.Alias
			if fullAliasField != "" {
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
			}
			return fullAliasField
		}
		return ""
	}
	return *query.Label
}

func toCloudWatchQuery(dataQuery metricsDataQuery) *CloudWatchQuery {
	cwlog.Debug("Parsing request query", "query", dataQuery)
	result := CloudWatchQuery{
		Alias:             dataQuery.Alias,
		UsedExpression:    "", // TODO this doesn't seem right
		RefId:             dataQuery.RefId,
		Id:                dataQuery.Id,
		Region:            dataQuery.Region,
		Namespace:         dataQuery.Namespace,
		MetricName:        dataQuery.MetricName,
		MetricQueryType:   dataQuery.MetricQueryType,
		SqlExpression:     dataQuery.SqlExpression,
		TimezoneUTCOffset: dataQuery.TimezoneUTCOffset,
		Expression:        dataQuery.Expression,
	}

	return &result
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
