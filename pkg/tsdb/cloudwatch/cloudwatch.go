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

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/sync/errgroup"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
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
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, queryContext)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, queryContext)
	}

	return result, err
}

func (e *CloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	eg, ectx := errgroup.WithContext(ctx)

	getMetricDataQueries := make(map[string]map[string]*CloudWatchQuery)
	for i, model := range queryContext.Queries {
		queryType := model.Model.Get("type").MustString()
		if queryType != "timeSeriesQuery" && queryType != "" {
			continue
		}

		RefId := queryContext.Queries[i].RefId
		query, err := parseQuery(queryContext.Queries[i].Model)
		if err != nil {
			result.Results[RefId] = &tsdb.QueryResult{
				Error: err,
			}
			return result, nil
		}
		query.RefId = RefId

		if query.Id != "" {
			if _, ok := getMetricDataQueries[query.Region]; !ok {
				getMetricDataQueries[query.Region] = make(map[string]*CloudWatchQuery)
			}
			getMetricDataQueries[query.Region][query.Id] = query
			continue
		}

		if query.Id == "" && query.Expression != "" {
			result.Results[query.RefId] = &tsdb.QueryResult{
				Error: fmt.Errorf("Invalid query: id should be set if using expression"),
			}
			return result, nil
		}

		eg.Go(func() error {
			queryRes, err := e.executeQuery(ectx, query, queryContext)
			if ae, ok := err.(awserr.Error); ok && ae.Code() == "500" {
				return err
			}
			result.Results[queryRes.RefId] = queryRes
			if err != nil {
				result.Results[queryRes.RefId].Error = err
			}
			return nil
		})
	}

	if len(getMetricDataQueries) > 0 {
		for region, getMetricDataQuery := range getMetricDataQueries {
			q := getMetricDataQuery
			eg.Go(func() error {
				queryResponses, err := e.executeGetMetricDataQuery(ectx, region, q, queryContext)
				if ae, ok := err.(awserr.Error); ok && ae.Code() == "500" {
					return err
				}
				for _, queryRes := range queryResponses {
					result.Results[queryRes.RefId] = queryRes
					if err != nil {
						result.Results[queryRes.RefId].Error = err
					}
				}
				return nil
			})
		}
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	return result, nil
}

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

	if endTime.Before(startTime) {
		return nil, fmt.Errorf("Invalid time range: End time can't be before start time")
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

	// 1 minutes resolutin metrics is stored for 15 days, 15 * 24 * 60 = 21600
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

func (e *CloudWatchExecutor) executeGetMetricDataQuery(ctx context.Context, region string, queries map[string]*CloudWatchQuery, queryContext *tsdb.TsdbQuery) ([]*tsdb.QueryResult, error) {
	queryResponses := make([]*tsdb.QueryResult, 0)

	// validate query
	for _, query := range queries {
		if !(len(query.Statistics) == 1 && len(query.ExtendedStatistics) == 0) &&
			!(len(query.Statistics) == 0 && len(query.ExtendedStatistics) == 1) {
			return queryResponses, errors.New("Statistics count should be 1")
		}
	}

	client, err := e.getClient(region)
	if err != nil {
		return queryResponses, err
	}

	startTime, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		return queryResponses, err
	}

	endTime, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		return queryResponses, err
	}

	params := &cloudwatch.GetMetricDataInput{
		StartTime: aws.Time(startTime),
		EndTime:   aws.Time(endTime),
		ScanBy:    aws.String("TimestampAscending"),
	}
	for _, query := range queries {
		// 1 minutes resolutin metrics is stored for 15 days, 15 * 24 * 60 = 21600
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

	nextToken := ""
	mdr := make(map[string]*cloudwatch.MetricDataResult)
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
				mdr[*r.Id] = r
			} else {
				mdr[*r.Id].Timestamps = append(mdr[*r.Id].Timestamps, r.Timestamps...)
				mdr[*r.Id].Values = append(mdr[*r.Id].Values, r.Values...)
			}
		}

		if resp.NextToken == nil || *resp.NextToken == "" {
			break
		}
		nextToken = *resp.NextToken
	}

	for i, r := range mdr {
		if *r.StatusCode != "Complete" {
			return queryResponses, fmt.Errorf("Part of query is failed: %s", *r.StatusCode)
		}

		queryRes := tsdb.NewQueryResult()
		queryRes.RefId = queries[i].RefId
		query := queries[*r.Id]

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
		series.Name = formatAlias(query, s, series.Tags)

		for j, t := range r.Timestamps {
			expectedTimestamp := r.Timestamps[j].Add(time.Duration(query.Period) * time.Second)
			if j > 0 && expectedTimestamp.Before(*t) {
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), float64(expectedTimestamp.Unix()*1000)))
			}
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(*r.Values[j]), float64((*t).Unix())*1000))
		}

		queryRes.Series = append(queryRes.Series, &series)
		queryResponses = append(queryResponses, queryRes)
	}

	return queryResponses, nil
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
	if alias == "" {
		alias = "{{metric}}_{{stat}}"
	}

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

func formatAlias(query *CloudWatchQuery, stat string, dimensions map[string]string) string {
	if len(query.Id) > 0 && len(query.Expression) > 0 {
		return query.Id
	}

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
