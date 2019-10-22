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
	counter := 1
	dimensionKeys := ""
	searchTerm := fmt.Sprintf("MetricName=\"%v\" ", query.MetricName)
	for key, values := range query.Dimensions {
		dimensionKeys += fmt.Sprintf(",%s", key)
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
		if len(query.Dimensions) > 1 && counter != 1 && !hasStar {
			keySearchTerm = fmt.Sprintf(" AND %s", keySearchTerm)
		}

		if !hasStar {
			searchTerm += keySearchTerm
		}

		counter++
	}
	searchExpression := fmt.Sprintf("SEARCH('{%s%s} %s', '%s', %s)", query.Namespace, dimensionKeys, searchTerm, stat, strconv.Itoa(query.Period))
	return searchExpression
}
