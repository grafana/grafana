package cloudwatch

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

const (
	cloudWatchDefaultRegion = "default"
	cloudWatchTSFormat      = "2006-01-02 15:04:05.000"
)

var (
	// In order to properly cache sessions per data source we need to
	// keep a state for each data source.
	executors    = make(map[int64]*CloudWatchExecutor)
	executorLock = sync.Mutex{}
	aliasFormat  = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	plog         = log.New("tsdb.cloudwatch")
)

// CloudWatchExecutor represents a structure holding enough information to execute
// CloudWatch queries for a specific data source. It caches AWS SDK Sessions on
// a regional basis for each data source version in order to load configuration as
// seldomly as possible.
type CloudWatchExecutor struct {
	*models.DataSource

	// clients is our interface to access AWS service-specific API clients
	clients clientCache

	// We cache custom metrics and dimensions on a per data source, per version basis
	// These are of type (profile -> region -> namespace)
	customMetricsMetricsMap    map[string]map[string]map[string]*CustomMetricsCache
	metricsCacheLock           sync.Mutex
	customMetricsDimensionsMap map[string]map[string]map[string]*CustomMetricsCache
	dimensionsCacheLock        sync.Mutex
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

// Constants also defined in datasource/cloudwatch/datasource.ts
const logIdentifierInternal = "__log__grafana_internal__"
const logStreamIdentifierInternal = "__logstream__grafana_internal__"

// NewCloudWatchExecutor finds the appropriate CloudWatchExecutor for the given
// data source, using a global cache protected by a mutex. If there is none
// cached, a new one will be created.
func NewCloudWatchExecutor(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	executorLock.Lock()
	defer executorLock.Unlock()

	// If the version has been updated we want to break the cache
	if exec := executors[datasource.Id]; exec != nil && exec.DataSource.Version >= datasource.Version {
		return exec, nil
	}

	exec := &CloudWatchExecutor{
		DataSource:                 datasource,
		clients:                    newSessionCache(),
		customMetricsMetricsMap:    make(map[string]map[string]map[string]*CustomMetricsCache),
		customMetricsDimensionsMap: make(map[string]map[string]map[string]*CustomMetricsCache),
	}
	executors[datasource.Id] = exec
	return exec, nil
}

func init() {
	tsdb.RegisterTsdbQueryEndpoint("cloudwatch", NewCloudWatchExecutor)
}

func (e *CloudWatchExecutor) alertQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, queryContext *tsdb.TsdbQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
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
	e.DataSource = dsInfo

	/*
		Unlike many other data sources,	with Cloudwatch Logs query requests don't receive the results as the response to the query, but rather
		an ID is first returned. Following this, a client is expected to send requests along with the ID until the status of the query is complete,
		receiving (possibly partial) results each time. For queries made via dashboards and Explore, the logic of making these repeated queries is handled on
		the frontend, but because alerts are executed on the backend the logic needs to be reimplemented here.
	*/
	queryParams := queryContext.Queries[0].Model
	_, fromAlert := queryContext.Headers["FromAlert"]
	isLogAlertQuery := fromAlert && queryParams.Get("queryMode").MustString("") == "Logs"

	if isLogAlertQuery {
		return e.executeLogAlertQuery(ctx, queryContext)
	}

	queryType := queryParams.Get("type").MustString("")

	var err error
	var result *tsdb.Response
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

// getDSInfo gets the CloudWatchExecutor's region-specific DataSourceInfo from
// the embedded models.DataSource. Given cloudWatchDefaultRegion it will fall
// back to the region configured as default for the data source.
func (e *CloudWatchExecutor) getDSInfo(region string) *DatasourceInfo {
	if region == cloudWatchDefaultRegion {
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

	dsInfo := e.getDSInfo(queryParams.Get("region").MustString(cloudWatchDefaultRegion))
	queryParams.Set("region", dsInfo.Region)

	logsClient, err := e.clients.logsClient(dsInfo)
	if err != nil {
		return nil, err
	}

	result, err := e.executeStartQuery(ctx, logsClient, queryParams, queryContext.TimeRange)
	if err != nil {
		return nil, err
	}

	queryParams.Set("queryId", *result.QueryId)

	// Get query results
	getQueryResultsOutput, err := e.alertQuery(ctx, logsClient, queryContext)
	if err != nil {
		return nil, err
	}

	dataframe, err := logsResultsToDataframes(getQueryResultsOutput)
	if err != nil {
		return nil, err
	}

	statsGroups := queryParams.Get("statsGroups").MustStringArray()
	if len(statsGroups) > 0 && len(dataframe.Fields) > 0 {
		groupedFrames, err := groupResults(dataframe, statsGroups)
		if err != nil {
			return nil, err
		}

		encodedFrames := make([][]byte, 0)
		for _, frame := range groupedFrames {
			dataframeEnc, err := frame.MarshalArrow()
			if err != nil {
				return nil, err
			}
			encodedFrames = append(encodedFrames, dataframeEnc)
		}

		response := &tsdb.Response{
			Results: make(map[string]*tsdb.QueryResult),
		}

		response.Results["A"] = &tsdb.QueryResult{
			RefId:      "A",
			Dataframes: encodedFrames,
		}

		return response, nil
	}

	dataframeEnc, err := dataframe.MarshalArrow()
	if err != nil {
		return nil, err
	}

	response := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			"A": {
				RefId:      "A",
				Dataframes: [][]byte{dataframeEnc},
			},
		},
	}
	return response, nil
}

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}
