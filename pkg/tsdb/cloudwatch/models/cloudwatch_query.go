package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws/endpoints"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
)

type (
	MetricEditorMode dataquery.MetricEditorMode
	MetricQueryType  dataquery.MetricQueryType
	GMDApiMode       uint32
)

const (
	MetricEditorModeBuilder = dataquery.MetricEditorModeN0
	MetricEditorModeRaw     = dataquery.MetricEditorModeN1
)

const (
	MetricQueryTypeSearch = dataquery.MetricQueryTypeN0
	MetricQueryTypeQuery  = dataquery.MetricQueryTypeN1
)

const (
	GMDApiModeMetricStat GMDApiMode = iota
	GMDApiModeInferredSearchExpression
	GMDApiModeMathExpression
	GMDApiModeSQLExpression
)

const (
	defaultRegion     = "default"
	defaultConsoleURL = "console.aws.amazon.com"
	usGovConsoleURL   = "console.amazonaws-us-gov.com"
	chinaConsoleURL   = "console.amazonaws.cn"
)

type CloudWatchQuery struct {
	logger            log.Logger
	RefId             string
	Region            string
	Id                string
	Namespace         string
	MetricName        string
	Statistic         string
	Expression        string
	SqlExpression     string
	ReturnData        bool
	Dimensions        map[string][]string
	Period            int
	Label             string
	MatchExact        bool
	UsedExpression    string
	TimezoneUTCOffset string
	MetricQueryType   dataquery.MetricQueryType
	MetricEditorMode  dataquery.MetricEditorMode
	AccountId         *string
}

func (q *CloudWatchQuery) GetGetMetricDataAPIMode() GMDApiMode {
	if q.MetricQueryType == MetricQueryTypeSearch && q.MetricEditorMode == MetricEditorModeBuilder {
		if q.IsInferredSearchExpression() {
			return GMDApiModeInferredSearchExpression
		}
		return GMDApiModeMetricStat
	} else if q.MetricQueryType == MetricQueryTypeSearch && q.MetricEditorMode == MetricEditorModeRaw {
		return GMDApiModeMathExpression
	} else if q.MetricQueryType == MetricQueryTypeQuery {
		return GMDApiModeSQLExpression
	}

	q.logger.Warn("could not resolve CloudWatch metric query type. Falling back to metric stat.", "query", q)
	return GMDApiModeMetricStat
}

func (q *CloudWatchQuery) IsMathExpression() bool {
	return q.MetricQueryType == MetricQueryTypeSearch && q.MetricEditorMode == MetricEditorModeRaw && !q.IsUserDefinedSearchExpression()
}

func (q *CloudWatchQuery) isSearchExpression() bool {
	return q.MetricQueryType == MetricQueryTypeSearch && (q.IsUserDefinedSearchExpression() || q.IsInferredSearchExpression())
}

func (q *CloudWatchQuery) IsUserDefinedSearchExpression() bool {
	return q.MetricQueryType == MetricQueryTypeSearch && q.MetricEditorMode == MetricEditorModeRaw && strings.Contains(q.Expression, "SEARCH(")
}

func (q *CloudWatchQuery) IsInferredSearchExpression() bool {
	if q.MetricQueryType != MetricQueryTypeSearch || q.MetricEditorMode != MetricEditorModeBuilder {
		return false
	}

	if q.AccountId != nil && *q.AccountId == "all" {
		return true
	}

	if len(q.Dimensions) == 0 {
		return !q.MatchExact
	}
	if !q.MatchExact {
		return true
	}

	for _, values := range q.Dimensions {
		if len(values) > 1 {
			return true
		}
		for _, v := range values {
			if v == "*" {
				return true
			}
		}
	}
	return false
}

func (q *CloudWatchQuery) IsMultiValuedDimensionExpression() bool {
	if q.MetricQueryType != MetricQueryTypeSearch || q.MetricEditorMode != MetricEditorModeBuilder {
		return false
	}

	for _, values := range q.Dimensions {
		for _, v := range values {
			if v == "*" {
				return false
			}
		}

		if len(values) > 1 {
			return true
		}
	}

	return false
}

func (q *CloudWatchQuery) BuildDeepLink(startTime time.Time, endTime time.Time) (string, error) {
	if q.IsMathExpression() || q.MetricQueryType == MetricQueryTypeQuery {
		return "", nil
	}

	link := &cloudWatchLink{
		Title:   q.RefId,
		View:    "timeSeries",
		Stacked: false,
		Region:  q.Region,
		Start:   startTime.UTC().Format(time.RFC3339),
		End:     endTime.UTC().Format(time.RFC3339),
	}

	if q.isSearchExpression() {
		metricExpressions := &metricExpression{Expression: q.UsedExpression}
		metricExpressions.Label = q.Label
		link.Metrics = []interface{}{metricExpressions}
	} else {
		metricStat := []interface{}{q.Namespace, q.MetricName}
		for dimensionKey, dimensionValues := range q.Dimensions {
			metricStat = append(metricStat, dimensionKey, dimensionValues[0])
		}
		metricStatMeta := &metricStatMeta{
			Stat:   q.Statistic,
			Period: q.Period,
		}
		metricStatMeta.Label = q.Label
		if q.AccountId != nil {
			metricStatMeta.AccountId = *q.AccountId
		}
		metricStat = append(metricStat, metricStatMeta)
		link.Metrics = []interface{}{metricStat}
	}

	linkProps, err := json.Marshal(link)
	if err != nil {
		return "", fmt.Errorf("could not marshal link: %w", err)
	}

	url, err := url.Parse(fmt.Sprintf(`https://%s/cloudwatch/deeplink.js`, getEndpoint(q.Region)))
	if err != nil {
		return "", fmt.Errorf("unable to parse CloudWatch console deep link")
	}

	fragment := url.Query()
	fragment.Set("graph", string(linkProps))

	query := url.Query()
	query.Set("region", q.Region)
	url.RawQuery = query.Encode()

	return fmt.Sprintf(`%s#metricsV2:%s`, url.String(), fragment.Encode()), nil
}

const timeSeriesQuery = "timeSeriesQuery"

var validMetricDataID = regexp.MustCompile(`^[a-z][a-zA-Z0-9_]*$`)

type metricsDataQuery struct {
	dataquery.CloudWatchMetricsQuery
	Type              string `json:"type"`
	TimezoneUTCOffset string `json:"timezoneUTCOffset"`
}

// ParseMetricDataQueries decodes the metric data queries json, validates, sets default values and returns an array of CloudWatchQueries.
// The CloudWatchQuery has a 1 to 1 mapping to a query editor row
func ParseMetricDataQueries(dataQueries []backend.DataQuery, startTime time.Time, endTime time.Time, defaultRegion string, logger log.Logger,
	crossAccountQueryingEnabled bool) ([]*CloudWatchQuery, error) {
	var metricDataQueries = make(map[string]metricsDataQuery)
	for _, query := range dataQueries {
		var metricsDataQuery metricsDataQuery
		err := json.Unmarshal(query.JSON, &metricsDataQuery)
		if err != nil {
			return nil, &QueryError{Err: err, RefID: query.RefID}
		}

		queryType := metricsDataQuery.Type
		if queryType != timeSeriesQuery && queryType != "" {
			continue
		}

		metricDataQueries[query.RefID] = metricsDataQuery
	}

	result := make([]*CloudWatchQuery, 0, len(metricDataQueries))

	for refId, mdq := range metricDataQueries {
		cwQuery := &CloudWatchQuery{
			logger:            logger,
			RefId:             refId,
			Id:                mdq.Id,
			Region:            mdq.Region,
			Namespace:         mdq.Namespace,
			TimezoneUTCOffset: mdq.TimezoneUTCOffset,
		}

		if mdq.MetricName != nil {
			cwQuery.MetricName = *mdq.MetricName
		}

		if mdq.MetricQueryType != nil {
			cwQuery.MetricQueryType = *mdq.MetricQueryType
		}

		if mdq.SqlExpression != nil {
			cwQuery.SqlExpression = *mdq.SqlExpression
		}

		if mdq.Expression != nil {
			cwQuery.Expression = *mdq.Expression
		}

		if mdq.Label != nil {
			cwQuery.Label = *mdq.Label
		}

		if err := cwQuery.validateAndSetDefaults(refId, mdq, startTime, endTime, defaultRegion, crossAccountQueryingEnabled); err != nil {
			return nil, &QueryError{Err: err, RefID: refId}
		}

		cwQuery.applyMacros(startTime, endTime)

		cwQuery.migrateLegacyQuery(mdq)

		result = append(result, cwQuery)
	}

	return result, nil
}

func (q *CloudWatchQuery) applyMacros(startTime, endTime time.Time) {
	if q.GetGetMetricDataAPIMode() == GMDApiModeMathExpression {
		q.Expression = strings.ReplaceAll(q.Expression, "$__period_auto", strconv.Itoa(calculatePeriodBasedOnTimeRange(startTime, endTime)))
	}
}

func (q *CloudWatchQuery) migrateLegacyQuery(query metricsDataQuery) {
	q.Statistic = getStatistic(query)
	q.Label = getLabel(query)
}

func (q *CloudWatchQuery) validateAndSetDefaults(refId string, metricsDataQuery metricsDataQuery, startTime, endTime time.Time,
	defaultRegionValue string, crossAccountQueryingEnabled bool) error {
	if metricsDataQuery.Statistic == nil && metricsDataQuery.Statistics == nil {
		return fmt.Errorf("query must have either statistic or statistics field")
	}

	var err error
	q.Period, err = getPeriod(metricsDataQuery, startTime, endTime)
	if err != nil {
		return err
	}

	q.Dimensions = map[string][]string{}
	if metricsDataQuery.Dimensions != nil {
		q.Dimensions, err = parseDimensions(*metricsDataQuery.Dimensions)
		if err != nil {
			return fmt.Errorf("failed to parse dimensions: %v", err)
		}
	}

	if crossAccountQueryingEnabled {
		q.AccountId = metricsDataQuery.AccountId
	}

	if metricsDataQuery.Id == "" {
		// Why not just use refId if id is not specified in the frontend? When specifying an id in the editor,
		// and alphabetical must be used. The id must be unique, so if an id like for example a, b or c would be used,
		// it would likely collide with some ref id. That's why the `query` prefix is used.
		suffix := refId
		if !validMetricDataID.MatchString(suffix) {
			newUUID := uuid.NewString()
			suffix = strings.ReplaceAll(newUUID, "-", "")
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
	if metricsDataQuery.Type == "" {
		// If no type is provided we assume we are called by alerting service, which requires to return data!
		// Note, this is sort of a hack, but the official Grafana interfaces do not carry the information
		// who (which service) called the TsdbQueryEndpoint.Query(...) function.
		q.ReturnData = true
	}

	if metricsDataQuery.MetricEditorMode == nil && metricsDataQuery.Expression != nil && len(*metricsDataQuery.Expression) > 0 {
		// this should only ever happen if this is an alerting query that has not yet been migrated in the frontend
		q.MetricEditorMode = MetricEditorModeRaw
	} else {
		if metricsDataQuery.MetricEditorMode != nil {
			q.MetricEditorMode = *metricsDataQuery.MetricEditorMode
		} else {
			q.MetricEditorMode = MetricEditorModeBuilder
		}
	}

	if q.Region == defaultRegion {
		q.Region = defaultRegionValue
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
		return query.Statistics[0]
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

func getLabel(query metricsDataQuery) string {
	deprecatedAlias := query.Alias //nolint:staticcheck

	if query.Label != nil {
		return *query.Label
	}
	if deprecatedAlias != nil && *deprecatedAlias == "" {
		return ""
	}

	var result string
	fullAliasField := ""
	if deprecatedAlias != nil {
		fullAliasField = *deprecatedAlias
	}
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
	result = fullAliasField
	return result
}

func calculatePeriodBasedOnTimeRange(startTime, endTime time.Time) int {
	deltaInSeconds := endTime.Sub(startTime).Seconds()
	periods := getRetainedPeriods(time.Since(startTime))
	datapoints := int(math.Ceil(deltaInSeconds / 2000))
	period := periods[len(periods)-1]
	for _, value := range periods {
		if datapoints <= value {
			period = value
			break
		}
	}

	return period
}

func getPeriod(query metricsDataQuery, startTime, endTime time.Time) (int, error) {
	periodString := ""
	if query.Period != nil {
		periodString = *query.Period
	}
	var period int
	var err error
	if strings.ToLower(periodString) == "auto" || periodString == "" {
		period = calculatePeriodBasedOnTimeRange(startTime, endTime)
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
	sortedDimensions := make(map[string][]string, len(dimensions))
	keys := make([]string, 0, len(dimensions))
	for k := range dimensions {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		sortedDimensions[k] = dimensions[k]
	}
	return sortedDimensions
}

func getEndpoint(region string) string {
	partition, _ := endpoints.PartitionForRegion(endpoints.DefaultPartitions(), region)
	url := defaultConsoleURL
	if partition.ID() == endpoints.AwsUsGovPartitionID {
		url = usGovConsoleURL
	}
	if partition.ID() == endpoints.AwsCnPartitionID {
		url = chinaConsoleURL
	}
	return fmt.Sprintf("%s.%s", region, url)
}
