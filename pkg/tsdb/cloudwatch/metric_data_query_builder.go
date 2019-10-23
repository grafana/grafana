package cloudwatch

import (
	"fmt"
	"sort"
	"strconv"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
)

func (mdib *metricDataInputBuilder) buildMetricDataQueries(query *cloudWatchQuery) ([]*cloudwatch.MetricDataQuery, error) {
	metridDataQueries := make([]*cloudwatch.MetricDataQuery, 0)
	query.SearchExpressions = []string{}

	for i, stat := range query.Statistics {
		mdq := &cloudwatch.MetricDataQuery{
			Id:         aws.String(getQueryID(query, i)),
			ReturnData: aws.Bool(query.ReturnData),
		}
		if query.Expression != "" {
			mdq.Expression = aws.String(query.Expression)
		} else {
			if query.isSearchExpression() {
				searchExpression := buildSearchExpression(query, *stat)
				query.SearchExpressions = append(query.SearchExpressions, searchExpression)
				mdq.Expression = aws.String(searchExpression)
			} else {
				mdq.MetricStat = &cloudwatch.MetricStat{
					Metric: &cloudwatch.Metric{
						Namespace:  aws.String(query.Namespace),
						MetricName: aws.String(query.MetricName),
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
				mdq.MetricStat.Stat = stat
			}
		}
		metridDataQueries = append(metridDataQueries, mdq)
	}
	return metridDataQueries, nil
}

func buildSearchExpression(query *cloudWatchQuery, stat string) string {
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
	for key, values := range knownDimensions {
		keyFilter := fmt.Sprintf("%s=%s", key, join(values, " OR ", `"`, `"`, "(", ")"))
		searchTerm = appendSearch(searchTerm, keyFilter)
	}

	if query.MatchExact {
		schema := query.Namespace
		if len(dimensionNames) > 0 {
			sort.Strings(dimensionNames)
			schema += fmt.Sprintf(",%s", join(dimensionNames, ",", "", "", "", ""))
		}

		return fmt.Sprintf("SEARCH('{%s} %s', '%s', %s)", schema, searchTerm, stat, strconv.Itoa(query.Period))
	}

	sort.Strings(dimensionNamesWithoutKnownValues)
	searchTerm = appendSearch(searchTerm, join(dimensionNamesWithoutKnownValues, " ", `"`, `"`, "", ""))
	return fmt.Sprintf(`SEARCH('Namespace="%s" %s', '%s', %s)`, query.Namespace, searchTerm, stat, strconv.Itoa(query.Period))
}

func join(arr []string, delimiter string, valuePrefix string, valueSuffix string, resultPrefix string, resultSuffix string) string {
	result := ""
	for index, value := range arr {
		result += valuePrefix + value + valueSuffix
		if index+1 != len(arr) {
			result += delimiter
		}
	}

	if len(arr) > 1 {
		result = resultPrefix + result + resultSuffix
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
