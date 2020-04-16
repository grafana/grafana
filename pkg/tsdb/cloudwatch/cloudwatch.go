package cloudwatch

import (
	"context"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type CloudWatchExecutor struct {
	*models.DataSource
	ec2Svc  ec2iface.EC2API
	rgtaSvc resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI

	logsClientsByRegion map[string](*cloudwatchlogs.CloudWatchLogs)
	mux                 sync.Mutex
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

const CLOUDWATCH_TS_FORMAT = "2006-01-02 15:04:05.000"

func (e *CloudWatchExecutor) getLogsClient(region string) (*cloudwatchlogs.CloudWatchLogs, error) {
	e.mux.Lock()
	defer e.mux.Unlock()

	if logsClient, ok := e.logsClientsByRegion[region]; ok {
		return logsClient, nil
	}

	dsInfo := retrieveDsInfo(e.DataSource, region)
	newLogsClient, err := retrieveLogsClient(dsInfo)

	if err != nil {
		return nil, err
	}

	e.logsClientsByRegion[region] = newLogsClient

	return newLogsClient, nil
}

func NewCloudWatchExecutor(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	dsInfo := retrieveDsInfo(datasource, "default")
	defaultLogsClient, err := retrieveLogsClient(dsInfo)

	if err != nil {
		return nil, err
	}

	logsClientsByRegion := make(map[string](*cloudwatchlogs.CloudWatchLogs), 0)
	logsClientsByRegion[dsInfo.Region] = defaultLogsClient
	logsClientsByRegion["default"] = defaultLogsClient

	return &CloudWatchExecutor{
		logsClientsByRegion: logsClientsByRegion,
	}, nil
}

var (
	plog        log.Logger
	aliasFormat *regexp.Regexp
)

func init() {
	plog = log.New("tsdb.cloudwatch")
	tsdb.RegisterTsdbQueryEndpoint("cloudwatch", NewCloudWatchExecutor)
	aliasFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
}

func (e *CloudWatchExecutor) AlertQuery(logsClient *cloudwatchlogs.CloudWatchLogs, ctx context.Context, queryContext *tsdb.TsdbQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	const MaxAttempts = 5
	const PollPeriod = 500 * time.Millisecond

	queryParams := queryContext.Queries[0].Model
	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, queryParams, queryContext.TimeRange)

	if err != nil {
		return nil, err
	}

	requestParams := simplejson.NewFromAny(map[string]interface{}{
		"region":  queryParams.Get("region").MustString(""),
		"queryId": *startQueryOutput.QueryId,
	})

	ticker := time.NewTicker(PollPeriod)
	defer ticker.Stop()

	attemptCount := 0
	for range ticker.C {
		if res, err := e.executeGetQueryResults(ctx, logsClient, requestParams); err != nil {
			return nil, err
		} else if isTerminated(*res.Status) || attemptCount > MaxAttempts {
			return res, err
		}

		attemptCount++
	}

	return nil, nil
}

func (e *CloudWatchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	var result *tsdb.Response
	e.DataSource = dsInfo

	queryParams := queryContext.Queries[0].Model
	isLogAlertQuery := queryParams.Get("fromAlert").MustBool(false) && queryParams.Get("mode").MustString("") == "Logs"

	if isLogAlertQuery {
		// plog.Info("Executing log alert query...")
		return e.executeLogAlertQuery(ctx, queryContext)
	}

	queryType := queryParams.Get("type").MustString("")
	var err error

	switch queryType {
	case "metricFindQuery":
		result, err = e.executeMetricFindQuery(ctx, queryContext)
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, queryContext)
	case "logAction":
		result, err = e.executeLogActions(ctx, queryContext)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, queryContext)
	}

	return result, err
}

func (e *CloudWatchExecutor) executeLogAlertQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	queryParams := queryContext.Queries[0].Model
	queryParams.Set("subtype", "StartQuery")
	queryParams.Set("queryString", queryParams.Get("expression").MustString(""))

	region := queryParams.Get("region").MustString("default")
	if region == "default" {
		region = e.DataSource.JsonData.Get("defaultRegion").MustString()
		queryParams.Set("region", region)
	}

	logsClient, err := e.getLogsClient(region)
	if err != nil {
		return nil, err
	}

	result, err := e.executeStartQuery(ctx, logsClient, queryParams, queryContext.TimeRange)
	if err != nil {
		return nil, err
	}

	queryParams.Set("queryId", *result.QueryId)

	// Get Query Results
	resp, err := e.AlertQuery(logsClient, ctx, queryContext)
	if err != nil {
		return nil, err
	}

	timeSeriesSlice, err := queryResultsToTimeseries(resp)
	if err != nil {
		return nil, err
	}

	response := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	response.Results["A"] = &tsdb.QueryResult{
		RefId:  "A",
		Series: timeSeriesSlice,
	}

	return response, nil
}

func queryResultsToTimeseries(results *cloudwatchlogs.GetQueryResultsOutput) (tsdb.TimeSeriesSlice, error) {
	timeColIndex := 0
	numericFieldIndices := make([]int, 0)
	for i, col := range results.Results[0] {
		if *col.Field == "@timestamp" {
			timeColIndex = i
		} else if _, err := strconv.ParseFloat(*col.Value, 64); err == nil {
			numericFieldIndices = append(numericFieldIndices, i)
		}
	}

	timeSeriesSlice := make(tsdb.TimeSeriesSlice, len(numericFieldIndices))

	for i := 0; i < len(numericFieldIndices); i++ {
		timeSeriesSlice[i] = &tsdb.TimeSeries{
			Points: make([]tsdb.TimePoint, 0),
		}
	}

	for _, row := range results.Results {
		timePoint, err := time.Parse(CLOUDWATCH_TS_FORMAT, *row[timeColIndex].Value)

		if err != nil {
			return nil, err
		}

		for i, j := range numericFieldIndices {
			numPoint, _ := strconv.ParseFloat(*row[j].Value, 64)
			timeSeriesSlice[i].Points = append(timeSeriesSlice[i].Points,
				tsdb.NewTimePoint(null.FloatFrom(numPoint), float64(timePoint.Unix()*1000)),
			)
		}
	}

	return timeSeriesSlice, nil
}

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}
