package cloudwatch

import (
	"context"
	"regexp"

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
	mdib    *metricDataInputBuilder
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

const (
	maxNoOfSearchExpressions = 5
	maxNoOfMetricDataQueries = 100
)

func NewCloudWatchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	mdib := &metricDataInputBuilder{maxNoOfSearchExpressions, maxNoOfMetricDataQueries}
	return &CloudWatchExecutor{mdib: mdib}, nil
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

	metricDataInputsByRegion := make(map[string][]*cloudwatch.GetMetricDataInput)
	queriesByRegion, err := e.parseQueriesByRegion(queryContext)
	for region, queries := range queriesByRegion {
		metricQueries, err := e.mdib.buildMetricDataInput(queryContext, queries)
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

				client, err := e.getClient(region)
				if err != nil {
					return err
				}

				metricDataOutputs := make([]*cloudwatch.GetMetricDataOutput, 0)
				for _, query := range queries {
					res, err := e.executeRequest(ectx, client, query)
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
						case "Throttling":
							return err
						}
					}
					metricDataOutputs = append(metricDataOutputs, res...)
				}

				queryResponses, err := e.parseResponse(metricDataOutputs, queriesByRegion[region])
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
