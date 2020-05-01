package cloudwatch

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

const (
	CLOUDWATCH_DEFAULT_REGION = "default"

	CLOUDWATCH_TS_FORMAT = "2006-01-02 15:04:05.000"
)

var (
	// In order to properly cache sessions per-datasource we need to
	// keep a state for each datasource.
	executors    = make(map[int64]*CloudWatchExecutor)
	executorLock = sync.Mutex{}
)

// CloudWatchExecutor represents a struct holding enough information to execute
// cloudwatch queries for a specific datasource. It caches AWS SDK Sessions on
// a region basis for each datasource version in order to load configuration as
// seldom as possible.
type CloudWatchExecutor struct {
	*models.DataSource

	// clients is our interface to access AWS service-specific API clients
	clients clientCache

	// We cache custom metrics and dimensions on a per-datasource per-version basis
	// These are of type (profile -> region -> namespace)
	customMetricsMetricsMap    map[string]map[string]map[string]*CustomMetricsCache
	metricsCacheLock           sync.Mutex
	customMetricsDimensionsMap map[string]map[string]map[string]*CustomMetricsCache
	dimensionsCacheLock        sync.Mutex
}

// getExecutor finds the appropriate CloudWatchExecutor for the given
// datasource using a global cache protected by a mutex. If there is none
// cached a new one will be created.
func getExecutor(dsInfo *models.DataSource) *CloudWatchExecutor {
	executorLock.Lock()
	defer executorLock.Unlock()

	// If the version has been updated we want to break the cache
	if exec := executors[dsInfo.Id]; exec != nil && exec.DataSource.Version >= dsInfo.Version {
		return exec
	}

	exec := &CloudWatchExecutor{
		DataSource:                 dsInfo,
		clients:                    newSessionCache(),
		customMetricsMetricsMap:    make(map[string]map[string]map[string]*CustomMetricsCache),
		customMetricsDimensionsMap: make(map[string]map[string]map[string]*CustomMetricsCache),
	}

	executors[dsInfo.Id] = exec
	return exec
}

type DatasourceInfo struct {
	Id int64

	Profile       string
	Region        string
	AuthType      string
	AssumeRoleArn string
	Namespace     string

	AccessKey string
	SecretKey string
}

func NewCloudWatchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return getExecutor(dsInfo), nil
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

func (e *CloudWatchExecutor) alertQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, queryContext *tsdb.TsdbQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	const maxAttempts = 8
	const pollPeriod = 1000 * time.Millisecond

	queryParams := queryContext.Queries[0].Model
	startQueryOutput, err := e.executeStartQuery(ctx, queryParams, queryContext.TimeRange)

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
		if res, err := e.executeGetQueryResults(ctx, requestParams); err != nil {
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

// getDsInfo gets the CloudWatchExecutor's region-specific DataSourceInfo from
// the embedded models.DataSource. Given CLOUDWATCH_DEFAULT_REGION it will fall
// back to the region configured as default for the datasource.
func (e *CloudWatchExecutor) getDsInfo(region string) *DatasourceInfo {
	if region == CLOUDWATCH_DEFAULT_REGION {
		region = e.DataSource.JsonData.Get("defaultRegion").MustString()
	}

	authType := e.DataSource.JsonData.Get("authType").MustString()
	assumeRoleArn := e.DataSource.JsonData.Get("assumeRoleArn").MustString()
	decrypted := e.DataSource.DecryptedValues()
	accessKey := decrypted["accessKey"]
	secretKey := decrypted["secretKey"]

	datasourceInfo := &DatasourceInfo{
		Id:            e.DataSource.Id,
		Region:        region,
		Profile:       e.DataSource.Database,
		AuthType:      authType,
		AssumeRoleArn: assumeRoleArn,
		AccessKey:     accessKey,
		SecretKey:     secretKey,
	}

	return datasourceInfo
}

func (e *CloudWatchExecutor) executeLogAlertQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	queryParams := queryContext.Queries[0].Model
	queryParams.Set("subtype", "StartQuery")
	queryParams.Set("queryString", queryParams.Get("expression").MustString(""))

	dsInfo := e.getDsInfo(queryParams.Get("region").MustString(CLOUDWATCH_DEFAULT_REGION))
	queryParams.Set("region", dsInfo.Region)

	logsClient, err := e.clients.logsClient(dsInfo)
	if err != nil {
		return nil, err
	}

	result, err := e.executeStartQuery(ctx, queryParams, queryContext.TimeRange)
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
