package cloudwatch

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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var validMetricDataID = regexp.MustCompile(`^[a-z][a-zA-Z0-9_]*$`)

type QueryJson struct {
	Datasource        map[string]string      `json:"datasource,omitempty"`
	Dimensions        map[string]interface{} `json:"dimensions,omitempty"`
	Expression        string                 `json:"expression,omitempty"`
	Id                string                 `json:"id,omitempty"`
	Label             *string                `json:"label,omitempty"`
	MatchExact        *bool                  `json:"matchExact,omitempty"`
	MaxDataPoints     int                    `json:"maxDataPoints,omitempty"`
	MetricEditorMode  *int                   `json:"metricEditorMode,omitempty"`
	MetricName        string                 `json:"metricName,omitempty"`
	MetricQueryType   metricQueryType        `json:"metricQueryType,omitempty"`
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
	Alias             *string                `json:"alias,omitempty"`
}

// parseQueries parses the json queries and returns a map of cloudWatchQueries by region. The cloudWatchQuery has a 1 to 1 mapping to a query editor row
func (e *cloudWatchExecutor) parseQueries(queries []backend.DataQuery, startTime time.Time, endTime time.Time) (map[string][]*cloudWatchQuery, error) {
	requestQueries := make(map[string][]*cloudWatchQuery)
	migratedQueries, err := migrateLegacyQuery(queries, e.features.IsEnabled(featuremgmt.FlagCloudWatchDynamicLabels))
	if err != nil {
		return nil, err
	}

	for _, query := range migratedQueries {
		var model QueryJson
		err := json.Unmarshal(query.JSON, &model)
		if err != nil {
			return nil, &queryError{err: err, RefID: query.RefID}
		}

		queryType := model.QueryType
		if queryType != timeSeriesQuery && queryType != "" {
			continue
		}

		if model.MatchExact == nil {
			trueBooleanValue := true
			model.MatchExact = &trueBooleanValue
		}

		refID := query.RefID
		query, err := parseRequestQuery(model, refID, startTime, endTime)
		if err != nil {
			return nil, &queryError{err: err, RefID: refID}
		}

		if _, exist := requestQueries[query.Region]; !exist {
			requestQueries[query.Region] = []*cloudWatchQuery{}
		}
		requestQueries[query.Region] = append(requestQueries[query.Region], query)
	}

	return requestQueries, nil
}

// migrateLegacyQuery is also done in the frontend, so this should only ever be needed for alerting queries
func migrateLegacyQuery(queries []backend.DataQuery, dynamicLabelsEnabled bool) ([]*backend.DataQuery, error) {
	migratedQueries := []*backend.DataQuery{}
	for _, q := range queries {
		query := q
		var queryJson *QueryJson
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
func migrateStatisticsToStatistic(queryJson *QueryJson) error {
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

func migrateAliasToDynamicLabel(queryJson *QueryJson) {
	fullAliasField := ""

	if queryJson.Alias != nil && *queryJson.Alias != "" {
		matches := legacyAliasRegexp.FindAllStringSubmatch(*queryJson.Alias, -1)
		fullAliasField = *queryJson.Alias

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

func parseRequestQuery(model QueryJson, refId string, startTime time.Time, endTime time.Time) (*cloudWatchQuery, error) {
	plog.Debug("Parsing request query", "query", model)
	cloudWatchQuery := cloudWatchQuery{
		Alias:             "",
		Label:             "",
		MatchExact:        true,
		Statistic:         "",
		ReturnData:        true,
		UsedExpression:    "",
		RefId:             refId,
		Id:                model.Id,
		Region:            model.Region,
		Namespace:         model.Namespace,
		MetricName:        model.MetricName,
		MetricQueryType:   model.MetricQueryType,
		SqlExpression:     model.SqlExpression,
		TimezoneUTCOffset: model.TimezoneUTCOffset,
		Expression:        model.Expression,
	}
	reNumber := regexp.MustCompile(`^\d+$`)
	dimensions, err := parseDimensions(model.Dimensions)
	if err != nil {
		return nil, fmt.Errorf("failed to parse dimensions: %v", err)
	}
	cloudWatchQuery.Dimensions = dimensions

	p := model.Period
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
	cloudWatchQuery.Period = period

	if model.Id == "" {
		// Why not just use refId if id is not specified in the frontend? When specifying an id in the editor,
		// and alphabetical must be used. The id must be unique, so if an id like for example a, b or c would be used,
		// it would likely collide with some ref id. That's why the `query` prefix is used.
		suffix := refId
		if !validMetricDataID.MatchString(suffix) {
			uuid := uuid.NewString()
			suffix = strings.Replace(uuid, "-", "", -1)
		}
		cloudWatchQuery.Id = fmt.Sprintf("query%s", suffix)
	}

	if model.Hide != nil {
		cloudWatchQuery.ReturnData = !*model.Hide
	}

	if model.QueryType == "" {
		// If no type is provided we assume we are called by alerting service, which requires to return data!
		// Note, this is sort of a hack, but the official Grafana interfaces do not carry the information
		// who (which service) called the TsdbQueryEndpoint.Query(...) function.
		cloudWatchQuery.ReturnData = true
	}

	if model.MetricEditorMode == nil && len(model.Expression) > 0 {
		// this should only ever happen if this is an alerting query that has not yet been migrated in the frontend
		cloudWatchQuery.MetricEditorMode = MetricEditorModeRaw
	} else {
		if model.MetricEditorMode != nil {
			cloudWatchQuery.MetricEditorMode = metricEditorMode(*model.MetricEditorMode)
		} else {
			cloudWatchQuery.MetricEditorMode = metricEditorMode(0)
		}
	}

	if model.Statistic != nil {
		cloudWatchQuery.Statistic = *model.Statistic
	}

	if model.MatchExact != nil {
		cloudWatchQuery.MatchExact = *model.MatchExact
	}

	if model.Alias != nil {
		cloudWatchQuery.Alias = *model.Alias
	}

	if model.Label != nil {
		cloudWatchQuery.Label = *model.Label
	}

	return &cloudWatchQuery, nil
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
