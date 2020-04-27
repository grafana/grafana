package cloudwatch

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana-plugin-sdk-go/data"
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
	ExternalId    string
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

	logsClientsByRegion := make(map[string](*cloudwatchlogs.CloudWatchLogs))
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

func (e *CloudWatchExecutor) alertQuery(ctx context.Context, logsClient *cloudwatchlogs.CloudWatchLogs, queryContext *tsdb.TsdbQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	const maxAttempts = 8
	const pollPeriod = 1000 * time.Millisecond

	queryParams := queryContext.Queries[0].Model
	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, queryParams, queryContext.TimeRange)

	if err != nil {
		return nil, err
	}

	requestParams := simplejson.NewFromAny(map[string]interface{}{
		"region":  queryParams.Get("region").MustString(""),
		"queryId": *startQueryOutput.QueryId,
	})

	ticker := time.NewTicker(pollPeriod)
	defer ticker.Stop()

	attemptCount := 1
	for range ticker.C {
		if res, err := e.executeGetQueryResults(ctx, logsClient, requestParams); err != nil {
			return nil, err
		} else if isTerminated(*res.Status) {
			return res, err
		} else if attemptCount >= maxAttempts {
			return res, fmt.Errorf("fetching of query results exceeded max number of attempts")
		}

		attemptCount++
	}

	return nil, nil
}

func (e *CloudWatchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	var result *tsdb.Response
	e.DataSource = dsInfo

	/*
		Unlike many other data sources,	with Cloudwatch Logs query requests don't receive the results as the response to the query, but rather
		an ID is first returned. Following this, a client is expected to send requests along with the ID until the status of the query is complete,
		receiving (possibly partial) results each time. For queries made via dashboards and Explore, the logic of making these repeated queries is handled on
		the frontend, but because alerts are executed on the backend the logic needs to be reimplemented here.
	*/
	queryParams := queryContext.Queries[0].Model
	_, fromAlert := queryContext.Headers["FromAlert"]
	isLogAlertQuery := fromAlert && queryParams.Get("mode").MustString("") == "Logs"

	if isLogAlertQuery {
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
	getQueryResultsOutput, err := e.alertQuery(ctx, logsClient, queryContext)
	if err != nil {
		return nil, err
	}

	dataframe, err := queryResultsToDataframe(getQueryResultsOutput)
	if err != nil {
		return nil, err
	}

	dataframeEnc, err := dataframe.MarshalArrow()
	if err != nil {
		return nil, err
	}

	response := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	response.Results["A"] = &tsdb.QueryResult{
		RefId:      "A",
		Dataframes: [][]byte{dataframeEnc},
	}

	return response, nil
}

func queryResultsToDataframe(results *cloudwatchlogs.GetQueryResultsOutput) (*data.Frame, error) {
	rowCount := len(results.Results)
	fieldValues := make(map[string]interface{})
	for i, row := range results.Results {
		for _, resultField := range row {
			// Strip @ptr field from results as it's not needed
			if *resultField.Field == "@ptr" {
				continue
			}

			if _, exists := fieldValues[*resultField.Field]; !exists {
				if _, err := time.Parse(CLOUDWATCH_TS_FORMAT, *resultField.Value); err == nil {
					fieldValues[*resultField.Field] = make([]*time.Time, rowCount)
				} else if _, err := strconv.ParseFloat(*resultField.Value, 64); err == nil {
					fieldValues[*resultField.Field] = make([]*float64, rowCount)
				} else {
					continue
				}
			}

			if timeField, ok := fieldValues[*resultField.Field].([]*time.Time); ok {
				parsedTime, err := time.Parse(CLOUDWATCH_TS_FORMAT, *resultField.Value)
				if err != nil {
					return nil, err
				}

				timeField[i] = &parsedTime
			} else if numericField, ok := fieldValues[*resultField.Field].([]*float64); ok {
				parsedFloat, err := strconv.ParseFloat(*resultField.Value, 64)
				if err != nil {
					return nil, err
				}
				numericField[i] = &parsedFloat
			}
		}
	}

	newFields := make([]*data.Field, 0)
	for fieldName, vals := range fieldValues {
		newFields = append(newFields, data.NewField(fieldName, nil, vals))

		if fieldName == "@timestamp" {
			newFields[len(newFields)-1].SetConfig(&data.FieldConfig{Title: "Time"})
		}
	}

	frame := data.NewFrame("CloudWatchLogsResponse", newFields...)
	return frame, nil
}

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}
