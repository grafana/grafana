package cloudwatch

import (
	"context"
	"errors"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/metrics"
)

type CloudWatchExecutor struct {
	*models.DataSource
	ec2Svc ec2iface.EC2API
}

type DatasourceInfo struct {
	Profile       string
	Region        string
	AuthType      string
	AssumeRoleArn string
	Namespace     string

	AccessKey string
	SecretKey string
}

func NewCloudWatchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &CloudWatchExecutor{}, nil
}

var (
	plog               log.Logger
	standardStatistics map[string]bool
	aliasFormat        *regexp.Regexp
)

func init() {
	plog = log.New("tsdb.cloudwatch")
	tsdb.RegisterTsdbQueryEndpoint("cloudwatch", NewCloudWatchExecutor)
	standardStatistics = map[string]bool{
		"Average":     true,
		"Maximum":     true,
		"Minimum":     true,
		"Sum":         true,
		"SampleCount": true,
	}
	aliasFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
}

func (e *CloudWatchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	var result *tsdb.Response
	e.DataSource = dsInfo
	queryType := queryContext.Queries[0].Model.Get("type").MustString("")
	var err error

	switch queryType {
	case "metricFindQuery":
		result, err = e.executeMetricFindQuery(ctx, queryContext)
		break
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, queryContext)
		break
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, queryContext)
		break
	}

	return result, err
}

func (e *CloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	errCh := make(chan error, 1)
	resCh := make(chan *tsdb.QueryResult, 1)

	currentlyExecuting := 0
	for i, model := range queryContext.Queries {
		queryType := model.Model.Get("type").MustString()
		if queryType != "timeSeriesQuery" && queryType != "" {
			continue
		}
		currentlyExecuting++
		go func(refId string, index int) {
			queryRes, err := e.executeQuery(ctx, queryContext.Queries[index].Model, queryContext)
			currentlyExecuting--
			if err != nil {
				errCh <- err
			} else {
				queryRes.RefId = refId
				resCh <- queryRes
			}
		}(model.RefId, i)
	}

	for currentlyExecuting != 0 {
		select {
		case res := <-resCh:
			result.Results[res.RefId] = res
		case err := <-errCh:
			return result, err
		case <-ctx.Done():
			return result, ctx.Err()
		}
	}

	return result, nil
}

func (e *CloudWatchExecutor) executeQuery(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery) (*tsdb.QueryResult, error) {
	query, err := parseQuery(parameters)
	if err != nil {
		return nil, err
	}

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

	params := &cloudwatch.GetMetricStatisticsInput{
		Namespace:  aws.String(query.Namespace),
		MetricName: aws.String(query.MetricName),
		Dimensions: query.Dimensions,
		Period:     aws.Int64(int64(query.Period)),
		StartTime:  aws.Time(startTime),
		EndTime:    aws.Time(endTime),
	}
	if len(query.Statistics) > 0 {
		params.Statistics = query.Statistics
	}
	if len(query.ExtendedStatistics) > 0 {
		params.ExtendedStatistics = query.ExtendedStatistics
	}

	if setting.Env == setting.DEV {
		plog.Debug("CloudWatch query", "raw query", params)
	}

	resp, err := client.GetMetricStatisticsWithContext(ctx, params, request.WithResponseReadTimeout(10*time.Second))
	if err != nil {
		return nil, err
	}
	metrics.M_Aws_CloudWatch_GetMetricStatistics.Inc()

	queryRes, err := parseResponse(resp, query)
	if err != nil {
		return nil, err
	}

	return queryRes, nil
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

	period := 300
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
	if alias == "" {
		alias = "{{metric}}_{{stat}}"
	}

	return &CloudWatchQuery{
		Region:             region,
		Namespace:          namespace,
		MetricName:         metricName,
		Dimensions:         dimensions,
		Statistics:         aws.StringSlice(statistics),
		ExtendedStatistics: aws.StringSlice(extendedStatistics),
		Period:             period,
		Alias:              alias,
	}, nil
}

func formatAlias(query *CloudWatchQuery, stat string, dimensions map[string]string) string {
	data := map[string]string{}
	data["region"] = query.Region
	data["namespace"] = query.Namespace
	data["metric"] = query.MetricName
	data["stat"] = stat
	data["period"] = strconv.Itoa(query.Period)
	for k, v := range dimensions {
		data[k] = v
	}

	result := aliasFormat.ReplaceAllFunc([]byte(query.Alias), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := data[labelName]; exists {
			return []byte(val)
		}

		return in
	})

	return string(result)
}

func parseResponse(resp *cloudwatch.GetMetricStatisticsOutput, query *CloudWatchQuery) (*tsdb.QueryResult, error) {
	queryRes := tsdb.NewQueryResult()

	var value float64
	for _, s := range append(query.Statistics, query.ExtendedStatistics...) {
		series := tsdb.TimeSeries{
			Tags:   map[string]string{},
			Points: make([]tsdb.TimePoint, 0),
		}
		for _, d := range query.Dimensions {
			series.Tags[*d.Name] = *d.Value
		}
		series.Name = formatAlias(query, *s, series.Tags)

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
	}

	return queryRes, nil
}
