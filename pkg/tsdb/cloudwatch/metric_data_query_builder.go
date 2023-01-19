package cloudwatch

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func (e *cloudWatchExecutor) buildMetricDataQuery(logger log.Logger, query *models.CloudWatchQuery) (*cloudwatch.MetricDataQuery, error) {
	mdq := &cloudwatch.MetricDataQuery{
		Id:         aws.String(query.Id),
		ReturnData: aws.Bool(query.ReturnData),
	}

	if e.features.IsEnabled(featuremgmt.FlagCloudWatchDynamicLabels) && len(query.Label) > 0 {
		mdq.Label = &query.Label
	}

	switch query.GetGetMetricDataAPIMode() {
	case models.GMDApiModeMathExpression:
		mdq.Period = aws.Int64(int64(query.Period))
		mdq.Expression = aws.String(query.Expression)
	case models.GMDApiModeSQLExpression:
		mdq.Period = aws.Int64(int64(query.Period))
		mdq.Expression = aws.String(query.SqlExpression)
	case models.GMDApiModeInferredSearchExpression:
		mdq.Expression = aws.String(buildSearchExpression(query, query.Statistic))
	case models.GMDApiModeMetricStat:
		mdq.MetricStat = &cloudwatch.MetricStat{
			Metric: &cloudwatch.Metric{
				Namespace:  aws.String(query.Namespace),
				MetricName: aws.String(query.MetricName),
				Dimensions: make([]*cloudwatch.Dimension, 0),
			},
			Period: aws.Int64(int64(query.Period)),
		}
		for key, values := range query.Dimensions {
			mdq.MetricStat.Metric.Dimensions = append(mdq.MetricStat.Metric.Dimensions,
				&cloudwatch.Dimension{
					Name:  aws.String(key),
					Value: aws.String(values[0]),
				})
		}
		mdq.MetricStat.Stat = aws.String(query.Statistic)
		mdq.AccountId = query.AccountId
	}

	if mdq.Expression != nil {
		query.UsedExpression = *mdq.Expression
	} else {
		query.UsedExpression = ""
	}

	return mdq, nil
}

func buildSearchExpression(query *models.CloudWatchQuery, stat string) string {
	knownDimensions := make(map[string][]string)
	dimensionNames := []string{}
	dimensionNamesWithoutKnownValues := []string{}

	for key, values := range query.Dimensions {
		dimensionNames = append(dimensionNames, key)
		hasWildcard := false
		for _, value := range values {
			if value == "*" {
				hasWildcard = true
				break
			}
		}
		if hasWildcard {
			dimensionNamesWithoutKnownValues = append(dimensionNamesWithoutKnownValues, key)
		} else {
			knownDimensions[key] = values
		}
	}

	searchTerm := fmt.Sprintf(`MetricName="%s"`, query.MetricName)
	keys := []string{}
	for k := range knownDimensions {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, key := range keys {
		values := escapeDoubleQuotes(knownDimensions[key])
		valueExpression := join(values, " OR ", `"`, `"`)
		if len(knownDimensions[key]) > 1 {
			valueExpression = fmt.Sprintf(`(%s)`, valueExpression)
		}
		keyFilter := fmt.Sprintf(`"%s"=%s`, key, valueExpression)
		searchTerm = appendSearch(searchTerm, keyFilter)
	}

	var account string
	if query.AccountId != nil && *query.AccountId != "all" {
		account = fmt.Sprintf(":aws.AccountId=%q", *query.AccountId)
	}

	if query.MatchExact {
		schema := fmt.Sprintf("%q", query.Namespace)
		if len(dimensionNames) > 0 {
			sort.Strings(dimensionNames)
			schema += fmt.Sprintf(",%s", join(dimensionNames, ",", `"`, `"`))
		}
		schema = fmt.Sprintf("{%s}", schema)
		schemaSearchTermAndAccount := strings.TrimSpace(strings.Join([]string{schema, searchTerm, account}, " "))
		return fmt.Sprintf("REMOVE_EMPTY(SEARCH('%s', '%s', %s))", schemaSearchTermAndAccount, stat, strconv.Itoa(query.Period))
	}

	sort.Strings(dimensionNamesWithoutKnownValues)
	searchTerm = appendSearch(searchTerm, join(dimensionNamesWithoutKnownValues, " ", `"`, `"`))
	namespace := fmt.Sprintf("Namespace=%q", query.Namespace)
	namespaceSearchTermAndAccount := strings.TrimSpace(strings.Join([]string{namespace, searchTerm, account}, " "))
	return fmt.Sprintf(`REMOVE_EMPTY(SEARCH('%s', '%s', %s))`, namespaceSearchTermAndAccount, stat, strconv.Itoa(query.Period))
}

func escapeDoubleQuotes(arr []string) []string {
	result := []string{}
	for _, value := range arr {
		value = strings.ReplaceAll(value, `"`, `\"`)
		result = append(result, value)
	}

	return result
}

func join(arr []string, delimiter string, valuePrefix string, valueSuffix string) string {
	result := ""
	for index, value := range arr {
		result += valuePrefix + value + valueSuffix
		if index+1 != len(arr) {
			result += delimiter
		}
	}

	return result
}

func appendSearch(target string, value string) string {
	if value != "" {
		if target == "" {
			return value
		}
		return fmt.Sprintf("%v %v", target, value)
	}

	return target
}
