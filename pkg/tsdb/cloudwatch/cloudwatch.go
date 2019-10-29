package cloudwatch

import (
	"context"
	"regexp"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/sync/errgroup"
)

type CloudWatchExecutor struct {
	*models.DataSource
	mdpb    *metricDataParamBuilder
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
	maxNoOfSearchExpressions = 1
	maxNoOfMetricDataQueries = 100
)

func NewCloudWatchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	mdpb := &metricDataParamBuilder{maxNoOfSearchExpressions, maxNoOfMetricDataQueries}
	return &CloudWatchExecutor{mdpb: mdpb}, nil
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

	queries, err := e.parseQueries(queryContext)
	if err != nil {
		return results, err
	}

	queriesByRegion := e.groupQueriesByRegion(queries)
	metricDataParamsByRegion := make(map[string][]*metricDataParam)
	for region, queries := range queriesByRegion {
		metricDataParams, err := e.mdpb.build(queryContext, queries)
		if err != nil {
			return results, err
		}
		metricDataParamsByRegion[region] = metricDataParams
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
	// resultChan := make(chan *tsdb.QueryResult, len(queryContext.Queries)*50)
	eg, ectx := errgroup.WithContext(ctx)

	if len(metricDataParamsByRegion) > 0 {
		for region, metricDataParams := range metricDataParamsByRegion {
			// for index := 0; index < 50; index++ {
			mdps := metricDataParams
			r := region
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

				queryResponses := make(map[string]*tsdb.QueryResult, 0)
				client, err := e.getClient(r)
				if err != nil {
					return err
				}

				// metricDataOutputs := make([]*cloudwatch.GetMetricDataOutput, 0)
				for _, mdp := range mdps {
					plog.Info("executeRequest", "", r)
					mdo, err := e.executeRequest(ectx, client, mdp.MetricDataInput)
					if err != nil {
						if ae, ok := err.(awserr.Error); ok && ae.Code() == "Throttling" {
							for refID := range mdp.getUniqueRefIDs() {
								resultChan <- &tsdb.QueryResult{
									RefId: refID,
									Error: ae,
								}
							}
							return nil
						}
						return err
					}
					queryResponses, err = e.parseResponse(queryResponses, mdo, mdp.groupQueriesByID())

					// metricDataOutputs = append(metricDataOutputs, mdo...)
				}

				// regionQueriesByID := e.groupQueriesByID(queriesByRegion[r])
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
			// }
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

func (e *CloudWatchExecutor) groupQueriesByRegion(queries map[string]*cloudWatchQuery) map[string][]*cloudWatchQuery {
	queriesByRegion := make(map[string][]*cloudWatchQuery)

	for _, query := range queries {
		if _, ok := queriesByRegion[query.Region]; !ok {
			queriesByRegion[query.Region] = make([]*cloudWatchQuery, 0)
		}
		queriesByRegion[query.Region] = append(queriesByRegion[query.Region], query)
	}

	return queriesByRegion
}

func (e *CloudWatchExecutor) groupQueriesByID(queries []*cloudWatchQuery) map[string]*cloudWatchQuery {
	queriesByID := make(map[string]*cloudWatchQuery)
	for _, query := range queries {
		queriesByID[query.Id] = query
	}

	return queriesByID
}
