package cloudwatch

import (
	"fmt"
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
	searchExpression := fmt.Sprintf("SEARCH('")
	counter := 1
	dimensionSchemaKeys := ""
	dimensionKeys := ""
	searchTerm := fmt.Sprintf("MetricName=\"%s\"", query.MetricName)

	for key, values := range query.Dimensions {
		dimensionSchemaKeys += fmt.Sprintf(",%s", key)
		hasStar := false
		keySearchTerm := fmt.Sprintf("%s=(", key)
		for i, value := range values {
			keySearchTerm += fmt.Sprintf("\"%s\"", value)
			if len(values) > 1 && i+1 != len(values) {
				keySearchTerm += " OR "
			}
			if value == "*" {
				hasStar = true
				break
			}
		}
		keySearchTerm += ")"

		if !hasStar {
			searchTerm += fmt.Sprintf(" %s", keySearchTerm)
		}

		if hasStar || len(values) == 0 {
			if dimensionKeys == "" {
				dimensionKeys = fmt.Sprintf("\"%s\"", key)
			} else {
				dimensionKeys += fmt.Sprintf(" \"%s\"", key)
			}
		}

		counter++
	}

	if query.MatchExact {
		return fmt.Sprintf("SEARCH('{%s%s} %s', '%s', %s)", query.Namespace, dimensionSchemaKeys, searchTerm, stat, strconv.Itoa(query.Period))
	} else {
		searchExpression += fmt.Sprintf("Namespace=\"%s\"", query.Namespace)
		if searchTerm != "" {
			searchExpression += fmt.Sprintf(" %s", searchTerm)
		}
		if dimensionKeys != "" {
			searchExpression += fmt.Sprintf(" %s", dimensionKeys)
		}
		// return fmt.Sprintf("SEARCH('Namespace=\"%s\" %s %s', '%s', %s)", query.Namespace, searchTerm, dimensionKeys, stat, strconv.Itoa(query.Period))
	}

	return fmt.Sprintf("%s', '%s', %s)", searchExpression, stat, strconv.Itoa(query.Period))
}
