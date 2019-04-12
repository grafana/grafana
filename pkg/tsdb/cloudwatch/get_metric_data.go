package cloudwatch

import (
	"context"
	"errors"
	"fmt"
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
		metrics.M_Aws_CloudWatch_GetMetricData.Add(float64(len(params.MetricDataQueries)))

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

	for id, lr := range mdr {
		queryRes, err := parseGetMetricDataResponse(lr, queries[id])
		if err != nil {
			return queryResponses, err
		}
		queryResponses = append(queryResponses, queryRes)
	}

	return queryResponses, nil
}

func parseGetMetricDataQuery(queries map[string]*CloudWatchQuery, queryContext *tsdb.TsdbQuery) (*cloudwatch.GetMetricDataInput, error) {
	// validate query
	for _, query := range queries {
		if !(len(query.Statistics) == 1 && len(query.ExtendedStatistics) == 0) &&
			!(len(query.Statistics) == 0 && len(query.ExtendedStatistics) == 1) {
			return nil, errors.New("Statistics count should be 1")
		}
	}

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
		// 1 minutes resolution metrics is stored for 15 days, 15 * 24 * 60 = 21600
		if query.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(query.Period)) > 21600) {
			return nil, errors.New("too long query period")
		}

		mdq := &cloudwatch.MetricDataQuery{
			Id:         aws.String(query.Id),
			ReturnData: aws.Bool(query.ReturnData),
		}
		if query.Expression != "" {
			mdq.Expression = aws.String(query.Expression)
		} else {
			mdq.MetricStat = &cloudwatch.MetricStat{
				Metric: &cloudwatch.Metric{
					Namespace:  aws.String(query.Namespace),
					MetricName: aws.String(query.MetricName),
				},
				Period: aws.Int64(int64(query.Period)),
			}
			for _, d := range query.Dimensions {
				mdq.MetricStat.Metric.Dimensions = append(mdq.MetricStat.Metric.Dimensions,
					&cloudwatch.Dimension{
						Name:  d.Name,
						Value: d.Value,
					})
			}
			if len(query.Statistics) == 1 {
				mdq.MetricStat.Stat = query.Statistics[0]
			} else {
				mdq.MetricStat.Stat = query.ExtendedStatistics[0]
			}
		}
		params.MetricDataQueries = append(params.MetricDataQueries, mdq)
	}
	return params, nil
}

func parseGetMetricDataResponse(lr map[string]*cloudwatch.MetricDataResult, query *CloudWatchQuery) (*tsdb.QueryResult, error) {
	queryRes := tsdb.NewQueryResult()
	queryRes.RefId = query.RefId

	for label, r := range lr {
		if *r.StatusCode != "Complete" {
			return queryRes, fmt.Errorf("Part of query is failed: %s", *r.StatusCode)
		}

		series := tsdb.TimeSeries{
			Tags:   map[string]string{},
			Points: make([]tsdb.TimePoint, 0),
		}
		for _, d := range query.Dimensions {
			series.Tags[*d.Name] = *d.Value
		}
		s := ""
		if len(query.Statistics) == 1 {
			s = *query.Statistics[0]
		} else {
			s = *query.ExtendedStatistics[0]
		}
		series.Name = formatAlias(query, s, series.Tags, label)

		for j, t := range r.Timestamps {
			if j > 0 {
				expectedTimestamp := r.Timestamps[j-1].Add(time.Duration(query.Period) * time.Second)
				if expectedTimestamp.Before(*t) {
					series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), float64(expectedTimestamp.Unix()*1000)))
				}
			}
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(*r.Values[j]), float64((*t).Unix())*1000))
		}

		queryRes.Series = append(queryRes.Series, &series)
		queryRes.Meta = simplejson.New()
	}
	return queryRes, nil
}
