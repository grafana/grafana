package cloudwatch

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *CloudWatchExecutor) executeQuery(ctx context.Context, query *CloudWatchQuery, queryContext *tsdb.TsdbQuery) (*tsdb.QueryResult, error) {
	client, err := e.getClient(query.Region)
	if err != nil {
		return nil, err
	}

	startTime, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	if !startTime.Before(endTime) {
		return nil, fmt.Errorf("Invalid time range: Start time must be before end time")
	}

	params := &cloudwatch.GetMetricStatisticsInput{
		Namespace:  aws.String(query.Namespace),
		MetricName: aws.String(query.MetricName),
		Dimensions: query.Dimensions,
		Period:     aws.Int64(int64(query.Period)),
	}
	if len(query.Statistics) > 0 {
		params.Statistics = query.Statistics
	}
	if len(query.ExtendedStatistics) > 0 {
		params.ExtendedStatistics = query.ExtendedStatistics
	}

	// 1 minutes resolution metrics is stored for 15 days, 15 * 24 * 60 = 21600
	if query.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(query.Period)) > 21600) {
		return nil, errors.New("too long query period")
	}
	var resp *cloudwatch.GetMetricStatisticsOutput
	for startTime.Before(endTime) {
		params.StartTime = aws.Time(startTime)
		if query.HighResolution {
			startTime = startTime.Add(time.Duration(1440*query.Period) * time.Second)
		} else {
			startTime = endTime
		}
		params.EndTime = aws.Time(startTime)

		if setting.Env == setting.DEV {
			plog.Debug("CloudWatch query", "raw query", params)
		}

		partResp, err := client.GetMetricStatisticsWithContext(ctx, params, request.WithResponseReadTimeout(10*time.Second))
		if err != nil {
			return nil, err
		}
		if resp != nil {
			resp.Datapoints = append(resp.Datapoints, partResp.Datapoints...)
		} else {
			resp = partResp

		}
		metrics.M_Aws_CloudWatch_GetMetricStatistics.Inc()
	}

	queryRes, err := parseResponse(resp, query)
	if err != nil {
		return nil, err
	}

	return queryRes, nil
}

func parseQuery(model *simplejson.Json) (*CloudWatchQuery, error) {
	region, err := model.Get("region").String()
	if err != nil {
		return nil, err
	}

	namespace, err := model.Get("namespace").String()
	if err != nil {
		return nil, err
	}

	metricName, err := model.Get("metricName").String()
	if err != nil {
		return nil, err
	}

	id := model.Get("id").MustString("")
	expression := model.Get("expression").MustString("")

	dimensions, err := parseDimensions(model)
	if err != nil {
		return nil, err
	}

	statistics, extendedStatistics, err := parseStatistics(model)
	if err != nil {
		return nil, err
	}

	p := model.Get("period").MustString("")
	if p == "" {
		if namespace == "AWS/EC2" {
			p = "300"
		} else {
			p = "60"
		}
	}

	var period int
	if regexp.MustCompile(`^\d+$`).Match([]byte(p)) {
		period, err = strconv.Atoi(p)
		if err != nil {
			return nil, err
		}
	} else {
		d, err := time.ParseDuration(p)
		if err != nil {
			return nil, err
		}
		period = int(d.Seconds())
	}

	alias := model.Get("alias").MustString()

	returnData := model.Get("returnData").MustBool(false)
	highResolution := model.Get("highResolution").MustBool(false)

	return &CloudWatchQuery{
		Region:             region,
		Namespace:          namespace,
		MetricName:         metricName,
		Dimensions:         dimensions,
		Statistics:         aws.StringSlice(statistics),
		ExtendedStatistics: aws.StringSlice(extendedStatistics),
		Period:             period,
		Alias:              alias,
		Id:                 id,
		Expression:         expression,
		ReturnData:         returnData,
		HighResolution:     highResolution,
	}, nil
}

func parseDimensions(model *simplejson.Json) ([]*cloudwatch.Dimension, error) {
	var result []*cloudwatch.Dimension

	for k, v := range model.Get("dimensions").MustMap() {
		kk := k
		if vv, ok := v.(string); ok {
			result = append(result, &cloudwatch.Dimension{
				Name:  &kk,
				Value: &vv,
			})
		} else {
			return nil, errors.New("failed to parse")
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return *result[i].Name < *result[j].Name
	})
	return result, nil
}

func parseStatistics(model *simplejson.Json) ([]string, []string, error) {
	var statistics []string
	var extendedStatistics []string

	for _, s := range model.Get("statistics").MustArray() {
		if ss, ok := s.(string); ok {
			if _, isStandard := standardStatistics[ss]; isStandard {
				statistics = append(statistics, ss)
			} else {
				extendedStatistics = append(extendedStatistics, ss)
			}
		} else {
			return nil, nil, errors.New("failed to parse")
		}
	}

	return statistics, extendedStatistics, nil
}

func parseResponse(resp *cloudwatch.GetMetricStatisticsOutput, query *CloudWatchQuery) (*tsdb.QueryResult, error) {
	queryRes := tsdb.NewQueryResult()

	queryRes.RefId = query.RefId
	var value float64
	for _, s := range append(query.Statistics, query.ExtendedStatistics...) {
		series := tsdb.TimeSeries{
			Tags:   map[string]string{},
			Points: make([]tsdb.TimePoint, 0),
		}
		for _, d := range query.Dimensions {
			series.Tags[*d.Name] = *d.Value
		}
		series.Name = formatAlias(query, *s, series.Tags, "")

		lastTimestamp := make(map[string]time.Time)
		sort.Slice(resp.Datapoints, func(i, j int) bool {
			return (*resp.Datapoints[i].Timestamp).Before(*resp.Datapoints[j].Timestamp)
		})
		for _, v := range resp.Datapoints {
			switch *s {
			case "Average":
				value = *v.Average
			case "Maximum":
				value = *v.Maximum
			case "Minimum":
				value = *v.Minimum
			case "Sum":
				value = *v.Sum
			case "SampleCount":
				value = *v.SampleCount
			default:
				if strings.Index(*s, "p") == 0 && v.ExtendedStatistics[*s] != nil {
					value = *v.ExtendedStatistics[*s]
				}
			}

			// terminate gap of data points
			timestamp := *v.Timestamp
			if _, ok := lastTimestamp[*s]; ok {
				nextTimestampFromLast := lastTimestamp[*s].Add(time.Duration(query.Period) * time.Second)
				for timestamp.After(nextTimestampFromLast) {
					series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), float64(nextTimestampFromLast.Unix()*1000)))
					nextTimestampFromLast = nextTimestampFromLast.Add(time.Duration(query.Period) * time.Second)
				}
			}
			lastTimestamp[*s] = timestamp

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(value), float64(timestamp.Unix()*1000)))
		}

		queryRes.Series = append(queryRes.Series, &series)
		queryRes.Meta = simplejson.New()
		if len(resp.Datapoints) > 0 && resp.Datapoints[0].Unit != nil {
			if unit, ok := cloudwatchUnitMappings[*resp.Datapoints[0].Unit]; ok {
				queryRes.Meta.Set("unit", unit)
			}
		}
	}

	return queryRes, nil
}
