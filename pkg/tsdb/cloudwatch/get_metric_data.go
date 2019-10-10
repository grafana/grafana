package cloudwatch

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *CloudWatchExecutor) executeGetMetricDataQuery(ctx context.Context, region string, queries map[string]*CloudWatchQuery, queryContext *tsdb.TsdbQuery) ([]*tsdb.QueryResult, error) {
	queryResponses := make([]*tsdb.QueryResult, 0)

	client, err := e.getClient(region)
	if err != nil {
		return queryResponses, err
	}

	params, err := parseGetMetricDataQuery(queries, queryContext)
	if err != nil {
		return queryResponses, err
	}

	nextToken := ""
	mdr := make(map[string]map[string]*cloudwatch.MetricDataResult)
	for {
		if nextToken != "" {
			params.NextToken = aws.String(nextToken)
		}
		resp, err := client.GetMetricDataWithContext(ctx, params)
		if err != nil {
			return queryResponses, err
		}
		metrics.MAwsCloudWatchGetMetricData.Add(float64(len(params.MetricDataQueries)))

		for _, r := range resp.MetricDataResults {
			if _, ok := mdr[*r.Id]; !ok {
				mdr[*r.Id] = make(map[string]*cloudwatch.MetricDataResult)
				mdr[*r.Id][*r.Label] = r
			} else if _, ok := mdr[*r.Id][*r.Label]; !ok {
				mdr[*r.Id][*r.Label] = r
			} else {
				mdr[*r.Id][*r.Label].Timestamps = append(mdr[*r.Id][*r.Label].Timestamps, r.Timestamps...)
				mdr[*r.Id][*r.Label].Values = append(mdr[*r.Id][*r.Label].Values, r.Values...)
			}
		}

		if resp.NextToken == nil || *resp.NextToken == "" {
			break
		}
		nextToken = *resp.NextToken
	}

	for _, query := range queries {
		queryRes := tsdb.NewQueryResult()
		queryRes.RefId = query.RefId
		queryRes.Meta = simplejson.New()
		for i, stat := range query.Statistics {
			lr := mdr[getQueryID(query, i)]
			series, err := parseGetMetricDataTimeSeries(lr, query, *stat)
			if err != nil {
				return queryResponses, err
			}
			queryRes.Series = append(queryRes.Series, *series...)
		}
		queryResponses = append(queryResponses, queryRes)
	}

	return queryResponses, nil
}

func queryResponseExist(queryResponses []*tsdb.QueryResult, refID string) bool {
	for _, qr := range queryResponses {
		if qr.RefId == refID {
			return true
		}
	}
	return false
}

func parseGetMetricDataQuery(queries map[string]*CloudWatchQuery, queryContext *tsdb.TsdbQuery) (*cloudwatch.GetMetricDataInput, error) {
	startTime, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	params := &cloudwatch.GetMetricDataInput{
		StartTime: aws.Time(startTime),
		EndTime:   aws.Time(endTime),
		ScanBy:    aws.String("TimestampAscending"),
	}
	for _, query := range queries {
		for i, stat := range query.Statistics {

			// 1 minutes resolution metrics is stored for 15 days, 15 * 24 * 60 = 21600
			if query.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(query.Period)) > 21600) {
				return nil, errors.New("too long query period")
			}

			mdq := &cloudwatch.MetricDataQuery{
				Id:         aws.String(getQueryID(query, i)),
				ReturnData: aws.Bool(query.ReturnData),
			}
			if query.Expression != "" {
				mdq.Expression = aws.String(query.Expression)
			} else {
				dimensionKeys := ""
				searchTerm := fmt.Sprintf("MetricName=\"%v\"", query.MetricName)
				// stats := ""
				// stats = *query.Statistics[0]
				for _, d := range query.Dimensions {
					dimensionKeys += fmt.Sprintf(",%s", *d.Name)
					searchTerm += fmt.Sprintf(" %s=\"%s\"", *d.Name, *d.Value)
				}
				searchExpression := fmt.Sprintf("SEARCH(' {%s%s} %s', '%s', %s)", query.Namespace, dimensionKeys, searchTerm, *stat, strconv.Itoa(query.Period))
				mdq.Expression = aws.String(searchExpression)
			}
			params.MetricDataQueries = append(params.MetricDataQueries, mdq)

		}
	}
	return params, nil
}

func parseGetMetricDataTimeSeries(lr map[string]*cloudwatch.MetricDataResult, query *CloudWatchQuery, stat string) (*tsdb.TimeSeriesSlice, error) {
	result := tsdb.TimeSeriesSlice{}
	for label, r := range lr {
		if *r.StatusCode != "Complete" {
			return &result, fmt.Errorf("Part of query is failed: %s", *r.StatusCode)
		}

		series := tsdb.TimeSeries{
			Tags:   map[string]string{},
			Points: make([]tsdb.TimePoint, 0),
		}
		for _, d := range query.Dimensions {
			series.Tags[*d.Name] = *d.Value
		}

		series.Name = formatAlias(query, stat, series.Tags, label)

		for j, t := range r.Timestamps {
			if j > 0 {
				expectedTimestamp := r.Timestamps[j-1].Add(time.Duration(query.Period) * time.Second)
				if expectedTimestamp.Before(*t) {
					series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), float64(expectedTimestamp.Unix()*1000)))
				}
			}
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(*r.Values[j]), float64((*t).Unix())*1000))
		}
		result = append(result, &series)
	}
	return &result, nil
}

func getQueryID(query *CloudWatchQuery, statIndex int) string {
	queryID := query.Identifier
	if len(query.Statistics) > 1 {
		queryID = query.Identifier + "_____" + strconv.Itoa(statIndex)
	}
	return queryID
}
