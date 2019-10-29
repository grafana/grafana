package cloudwatch

import (
	"fmt"
	"sort"
	"strconv"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
)

func (mdpb *metricDataParamBuilder) buildMetricDataQuery(query *cloudWatchQuery) (*cloudwatch.MetricDataQuery, error) {
	mdq := &cloudwatch.MetricDataQuery{
		Id:         aws.String(query.Id),
		ReturnData: aws.Bool(query.ReturnData),
	}
	if query.Expression != "" {
		mdq.Expression = aws.String(query.Expression)
	} else {
		if query.isSearchExpression() {
			query.SearchExpression = buildSearchExpression(query, query.Stats)
			mdq.Expression = aws.String(query.SearchExpression)
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
			mdq.MetricStat.Stat = aws.String(query.Stats)
		}
	}

	return mdq, nil
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
	sortedKnownDimensions := sortDimensions(knownDimensions)
	for key, values := range sortedKnownDimensions {
		valueExpression := join(values, " OR ", `"`, `"`)
		if len(values) > 1 {
			valueExpression = fmt.Sprintf(`(%s)`, valueExpression)
		}
		keyFilter := fmt.Sprintf(`"%s"=%s`, key, valueExpression)
		searchTerm = appendSearch(searchTerm, keyFilter)
	}

	if query.MatchExact {
		schema := query.Namespace
		if len(dimensionNames) > 0 {
			sort.Strings(dimensionNames)
			schema += fmt.Sprintf(",%s", join(dimensionNames, ",", "", ""))
		}

		return fmt.Sprintf("REMOVE_EMPTY(SEARCH('{%s} %s', '%s', %s))", schema, searchTerm, stat, strconv.Itoa(query.Period))
	}

	sort.Strings(dimensionNamesWithoutKnownValues)
	searchTerm = appendSearch(searchTerm, join(dimensionNamesWithoutKnownValues, " ", `"`, `"`))
	return fmt.Sprintf(`REMOVE_EMPTY(SEARCH('Namespace="%s" %s', '%s', %s))`, query.Namespace, searchTerm, stat, strconv.Itoa(query.Period))
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
