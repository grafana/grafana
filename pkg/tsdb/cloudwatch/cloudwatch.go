package cloudwatch

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/infra/log"
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

	metricDataInputsByRegion := make(map[string][]*cloudwatch.GetMetricDataInput, 0)
	queriesByRegion, err := e.parseQueriesByRegion(queryContext)
	for region, queries := range queriesByRegion {
		metricQueries, err := e.buildGetMetricDataQueries(queryContext, queries)
		if err != nil {
			return results, err
		}
		metricDataInputsByRegion[region] = metricQueries
	}

	if err != nil {
		if e, ok := err.(*queryBuilderError); ok {
			results.Results[e.RefID] = &tsdb.QueryResult{
				Error: err,
			}
			return results, nil
		} else {
			return results, err
		}
	}

	resultChan := make(chan *tsdb.QueryResult, len(queryContext.Queries))
	eg, ectx := errgroup.WithContext(ctx)

	if len(metricDataInputsByRegion) > 0 {
		for region, metricDataQueries := range metricDataInputsByRegion {
			queries := metricDataQueries
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

				queryResponses := make([]*tsdb.QueryResult, 0)
				metricDataResults := make([]*cloudwatch.MetricDataResult, 0)
				for _, query := range queries {
					res, err := e.executeRequest(ectx, region, query)
					if err != nil {
						plog.Info("executeGetMetricDataQueryError", "", err)
					}

					if ae, ok := err.(awserr.Error); ok {
						plog.Info("errorcode", "", ae.Code())
						switch ae.Code() {
						case "InternalFailure":
							return err
						case "ValidationError":
							return err
						case "ThrottlingException":
							return fmt.Errorf("You've been throttled")
						}
					}
					metricDataResults = append(metricDataResults, res...)
					plog.Info("res", "", res)
				}

				queryResponses, err := e.parseResponse(metricDataResults, queriesByRegion[region])
				if err != nil {
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

	if string(result) == "" {
		return metricName + "_" + stat
	}

	return string(result)
}
