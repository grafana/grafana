package cloudwatch

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/sync/errgroup"
)

type CloudWatchExecutor struct {
	*models.DataSource
	ec2Svc  ec2iface.EC2API
	rgtaSvc resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI
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
	results := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	resultChan := make(chan *tsdb.QueryResult, len(queryContext.Queries))

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
			results.Results[RefId] = &tsdb.QueryResult{
				Error: err,
			}
			return results, nil
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
			results.Results[query.RefId] = &tsdb.QueryResult{
				Error: fmt.Errorf("Invalid query: id should be set if using expression"),
			}
			return results, nil
		}

		eg.Go(func() error {
			defer func() {
				if err := recover(); err != nil {
					plog.Error("Execute Query Panic", "error", err, "stack", log.Stack(1))
					if theErr, ok := err.(error); ok {
						resultChan <- &tsdb.QueryResult{
							RefId: query.RefId,
							Error: theErr,
						}
					}
				}
			}()

			queryRes, err := e.executeQuery(ectx, query, queryContext)
			if ae, ok := err.(awserr.Error); ok && ae.Code() == "500" {
				return err
			}
			if err != nil {
				resultChan <- &tsdb.QueryResult{
					RefId: query.RefId,
					Error: err,
				}
				return nil
			}
			resultChan <- queryRes
			return nil
		})
	}

	if len(getMetricDataQueries) > 0 {
		for region, getMetricDataQuery := range getMetricDataQueries {
			q := getMetricDataQuery
			eg.Go(func() error {
				defer func() {
					if err := recover(); err != nil {
						plog.Error("Execute Get Metric Data Query Panic", "error", err, "stack", log.Stack(1))
						if theErr, ok := err.(error); ok {
							resultChan <- &tsdb.QueryResult{
								Error: theErr,
							}
						}
					}
				}()

				queryResponses, err := e.executeGetMetricDataQuery(ectx, region, q, queryContext)
				if ae, ok := err.(awserr.Error); ok && ae.Code() == "500" {
					return err
				}
				for _, queryRes := range queryResponses {
					if err != nil {
						queryRes.Error = err
					}
					resultChan <- queryRes
				}
				return nil
			})
		}
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}
	close(resultChan)
	for result := range resultChan {
		results.Results[result.RefId] = result
	}

	return results, nil
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
		// 1 minutes resolution metrics is stored for 15 days, 15 * 24 * 60 = 21600
		if query.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(query.Period)) > 21600) {
			return queryResponses, errors.New("too long query period")
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
		queryRes := tsdb.NewQueryResult()
		queryRes.RefId = queries[id].RefId
		query := queries[id]

		for label, r := range lr {
			if *r.StatusCode != "Complete" {
				return queryResponses, fmt.Errorf("Part of query is failed: %s", *r.StatusCode)
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
				expectedTimestamp := r.Timestamps[j].Add(time.Duration(query.Period) * time.Second)
				if j > 0 && expectedTimestamp.Before(*t) {
					series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), float64(expectedTimestamp.Unix()*1000)))
				}
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(*r.Values[j]), float64((*t).Unix())*1000))
			}

			queryRes.Series = append(queryRes.Series, &series)
			queryRes.Meta = simplejson.New()
		}
		queryResponses = append(queryResponses, queryRes)
	}

	return queryResponses, nil
}

func formatAlias(query *CloudWatchQuery, stat string, dimensions map[string]string, label string) string {
	region := query.Region
	namespace := query.Namespace
	metricName := query.MetricName
	period := strconv.Itoa(query.Period)
	if len(query.Id) > 0 && len(query.Expression) > 0 {
		if strings.Index(query.Expression, "SEARCH(") == 0 {
			pIndex := strings.LastIndex(query.Expression, ",")
			period = strings.Trim(query.Expression[pIndex+1:], " )")
			sIndex := strings.LastIndex(query.Expression[:pIndex], ",")
			stat = strings.Trim(query.Expression[sIndex+1:pIndex], " '")
		} else if len(query.Alias) > 0 {
			// expand by Alias
		} else {
			return query.Id
		}
	}

	data := map[string]string{}
	data["region"] = region
	data["namespace"] = namespace
	data["metric"] = metricName
	data["stat"] = stat
	data["period"] = period
	if len(label) != 0 {
		data["label"] = label
	}
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
