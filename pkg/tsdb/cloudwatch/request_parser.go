package cloudwatch

import (
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
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var validMetricDataID = regexp.MustCompile(`^[a-z][a-zA-Z0-9_]*$`)

// parseQueries parses the json queries and returns a map of cloudWatchQueries by region. The cloudWatchQuery has a 1 to 1 mapping to a query editor row
func (e *cloudWatchExecutor) parseQueries(queries []backend.DataQuery, startTime time.Time, endTime time.Time) (map[string][]*cloudWatchQuery, error) {
	requestQueries := make(map[string][]*cloudWatchQuery)

	migratedQueries, err := migrateLegacyQuery(queries, e.features.IsEnabled(featuremgmt.FlagCloudWatchDynamicLabels))
	if err != nil {
		return nil, err
	}

	for _, query := range migratedQueries {
		model, err := simplejson.NewJson(query.JSON)
		if err != nil {
			return nil, &queryError{err: err, RefID: query.RefID}
		}

		queryType := model.Get("type").MustString()
		if queryType != "timeSeriesQuery" && queryType != "" {
			continue
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
		queryJson, err := simplejson.NewJson(query.JSON)
		if err != nil {
			return nil, err
		}

		if err := migrateStatisticsToStatistic(queryJson); err != nil {
			return nil, err
		}

		_, labelExists := queryJson.CheckGet("label")
		if !labelExists && dynamicLabelsEnabled {
			migrateAliasToDynamicLabel(queryJson)
		}

		query.JSON, err = queryJson.MarshalJSON()
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
func migrateStatisticsToStatistic(queryJson *simplejson.Json) error {
	_, err := queryJson.Get("statistic").String()
	// If there's not a statistic property in the json, we know it's the legacy format and then it has to be migrated
	if err != nil {
		stats, err := queryJson.Get("statistics").StringArray()
		if err != nil {
			return fmt.Errorf("query must have either statistic or statistics field")
		}
		queryJson.Del("statistics")
		queryJson.Set("statistic", stats[0])
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

func migrateAliasToDynamicLabel(queryJson *simplejson.Json) {
	fullAliasField := queryJson.Get("alias").MustString()
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

	queryJson.Set("label", fullAliasField)
}

func parseRequestQuery(model *simplejson.Json, refId string, startTime time.Time, endTime time.Time) (*cloudWatchQuery, error) {
	plog.Debug("Parsing request query", "query", model)
	reNumber := regexp.MustCompile(`^\d+$`)
	region, err := model.Get("region").String()
	if err != nil {
		return nil, err
	}
	namespace, err := model.Get("namespace").String()
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace: %v", err)
	}
	metricName, err := model.Get("metricName").String()
	if err != nil {
		return nil, fmt.Errorf("failed to get metricName: %v", err)
	}
	dimensions, err := parseDimensions(model)
	if err != nil {
		return nil, fmt.Errorf("failed to parse dimensions: %v", err)
	}

	statistic, err := model.Get("statistic").String()
	if err != nil {
		return nil, fmt.Errorf("failed to parse statistic: %v", err)
	}

	p := model.Get("period").MustString("")
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

	id := model.Get("id").MustString("")
	if id == "" {
		// Why not just use refId if id is not specified in the frontend? When specifying an id in the editor,
		// and alphabetical must be used. The id must be unique, so if an id like for example a, b or c would be used,
		// it would likely collide with some ref id. That's why the `query` prefix is used.
		suffix := refId
		if !validMetricDataID.MatchString(suffix) {
			uuid := uuid.NewString()
			suffix = strings.Replace(uuid, "-", "", -1)
		}
		id = fmt.Sprintf("query%s", suffix)
	}
	expression := model.Get("expression").MustString("")
	sqlExpression := model.Get("sqlExpression").MustString("")
	alias := model.Get("alias").MustString()
	label := model.Get("label").MustString()
	returnData := !model.Get("hide").MustBool(false)
	queryType := model.Get("type").MustString()
	timezoneUTCOffset := model.Get("timezoneUTCOffset").MustString("")

	if queryType == "" {
		// If no type is provided we assume we are called by alerting service, which requires to return data!
		// Note, this is sort of a hack, but the official Grafana interfaces do not carry the information
		// who (which service) called the TsdbQueryEndpoint.Query(...) function.
		returnData = true
	}

	matchExact := model.Get("matchExact").MustBool(true)
	metricQueryType := metricQueryType(model.Get("metricQueryType").MustInt(0))

	var metricEditorModeValue metricEditorMode
	memv, err := model.Get("metricEditorMode").Int()
	if err != nil && len(expression) > 0 {
		// this should only ever happen if this is an alerting query that has not yet been migrated in the frontend
		metricEditorModeValue = MetricEditorModeRaw
	} else {
		metricEditorModeValue = metricEditorMode(memv)
	}

	return &cloudWatchQuery{
		RefId:             refId,
		Region:            region,
		Id:                id,
		Namespace:         namespace,
		MetricName:        metricName,
		Statistic:         statistic,
		Expression:        expression,
		ReturnData:        returnData,
		Dimensions:        dimensions,
		Period:            period,
		Alias:             alias,
		Label:             label,
		MatchExact:        matchExact,
		UsedExpression:    "",
		MetricQueryType:   metricQueryType,
		MetricEditorMode:  metricEditorModeValue,
		SqlExpression:     sqlExpression,
		TimezoneUTCOffset: timezoneUTCOffset,
	}, nil
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

func parseDimensions(model *simplejson.Json) (map[string][]string, error) {
	parsedDimensions := make(map[string][]string)
	for k, v := range model.Get("dimensions").MustMap() {
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
