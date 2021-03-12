package cloudwatch

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

const cloudWatchTSFormat = "2006-01-02 15:04:05.000"
const defaultRegion = "default"

// Constants also defined in datasource/cloudwatch/datasource.ts
const logIdentifierInternal = "__log__grafana_internal__"
const logStreamIdentifierInternal = "__logstream__grafana_internal__"

var plog = log.New("tsdb.cloudwatch")
var aliasFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "CloudWatchService",
		InitPriority: registry.Low,
		Instance:     &CloudWatchService{},
	})
}

type CloudWatchService struct {
	LogsService *LogsService `inject:""`
	Cfg         *setting.Cfg `inject:""`
	sessions    SessionCache
}

func (s *CloudWatchService) Init() error {
	s.sessions = awsds.NewSessionCache()
	return nil
}

func (s *CloudWatchService) NewExecutor(*models.DataSource) (plugins.DataPlugin, error) {
	return newExecutor(s.LogsService, s.Cfg, s.sessions), nil
}

type SessionCache interface {
	GetSession(region string, s awsds.AWSDatasourceSettings) (*session.Session, error)
}

func newExecutor(logsService *LogsService, cfg *setting.Cfg, sessions SessionCache) *cloudWatchExecutor {
	return &cloudWatchExecutor{
		cfg:         cfg,
		logsService: logsService,
		sessions:    sessions,
	}
}

// cloudWatchExecutor executes CloudWatch requests.
type cloudWatchExecutor struct {
	*models.DataSource

	ec2Client  ec2iface.EC2API
	rgtaClient resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI

	logsService *LogsService
	cfg         *setting.Cfg
	sessions    SessionCache
}

func (e *cloudWatchExecutor) newSession(region string) (*session.Session, error) {
	awsDatasourceSettings := e.getAWSDatasourceSettings(region)

	return e.sessions.GetSession(region, *awsDatasourceSettings)
}

func (e *cloudWatchExecutor) getCWClient(region string) (cloudwatchiface.CloudWatchAPI, error) {
	sess, err := e.newSession(region)
	if err != nil {
		return nil, err
	}
	return NewCWClient(sess), nil
}

func (e *cloudWatchExecutor) getCWLogsClient(region string) (cloudwatchlogsiface.CloudWatchLogsAPI, error) {
	sess, err := e.newSession(region)
	if err != nil {
		return nil, err
	}

	logsClient := NewCWLogsClient(sess)

	return logsClient, nil
}

func (e *cloudWatchExecutor) getEC2Client(region string) (ec2iface.EC2API, error) {
	if e.ec2Client != nil {
		return e.ec2Client, nil
	}

	sess, err := e.newSession(region)
	if err != nil {
		return nil, err
	}
	e.ec2Client = newEC2Client(sess)

	return e.ec2Client, nil
}

func (e *cloudWatchExecutor) getRGTAClient(region string) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI,
	error) {
	if e.rgtaClient != nil {
		return e.rgtaClient, nil
	}

	sess, err := e.newSession(region)
	if err != nil {
		return nil, err
	}
	e.rgtaClient = newRGTAClient(sess)

	return e.rgtaClient, nil
}

func (e *cloudWatchExecutor) alertQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	queryContext plugins.DataQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	const maxAttempts = 8
	const pollPeriod = 1000 * time.Millisecond

	queryParams := queryContext.Queries[0].Model
	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, queryParams, *queryContext.TimeRange)
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
		res, err := e.executeGetQueryResults(ctx, logsClient, requestParams)
		if err != nil {
			return nil, err
		}
		if isTerminated(*res.Status) {
			return res, err
		}
		if attemptCount >= maxAttempts {
			return res, fmt.Errorf("fetching of query results exceeded max number of attempts")
		}

		attemptCount++
	}

	return nil, nil
}

// DataQuery executes a CloudWatch query.
func (e *cloudWatchExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	queryContext plugins.DataQuery) (plugins.DataResponse, error) {
	e.DataSource = dsInfo

	/*
		Unlike many other data sources, with Cloudwatch Logs query requests don't receive the results as the response
		to the query, but rather an ID is first returned. Following this, a client is expected to send requests along
		with the ID until the status of the query is complete, receiving (possibly partial) results each time. For
		queries made via dashboards and Explore, the logic of making these repeated queries is handled on the
		frontend, but because alerts are executed on the backend the logic needs to be reimplemented here.
	*/
	queryParams := queryContext.Queries[0].Model
	_, fromAlert := queryContext.Headers["FromAlert"]
	isLogAlertQuery := fromAlert && queryParams.Get("queryMode").MustString("") == "Logs"

	if isLogAlertQuery {
		return e.executeLogAlertQuery(ctx, queryContext)
	}

	queryType := queryParams.Get("type").MustString("")

	var err error
	var result plugins.DataResponse
	switch queryType {
	case "metricFindQuery":
		result, err = e.executeMetricFindQuery(ctx, queryContext)
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, queryContext)
	case "logAction":
		result, err = e.executeLogActions(ctx, queryContext)
	case "liveLogAction":
		result, err = e.executeLiveLogQuery(ctx, queryContext)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, queryContext)
	}

	return result, err
}

func (e *cloudWatchExecutor) executeLogAlertQuery(ctx context.Context, queryContext plugins.DataQuery) (
	plugins.DataResponse, error) {
	queryParams := queryContext.Queries[0].Model
	queryParams.Set("subtype", "StartQuery")
	queryParams.Set("queryString", queryParams.Get("expression").MustString(""))

	region := queryParams.Get("region").MustString(defaultRegion)
	if region == defaultRegion {
		region = e.DataSource.JsonData.Get("defaultRegion").MustString()
		queryParams.Set("region", region)
	}

	logsClient, err := e.getCWLogsClient(region)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	result, err := e.executeStartQuery(ctx, logsClient, queryParams, *queryContext.TimeRange)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	queryParams.Set("queryId", *result.QueryId)

	// Get query results
	getQueryResultsOutput, err := e.alertQuery(ctx, logsClient, queryContext)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	dataframe, err := logsResultsToDataframes(getQueryResultsOutput)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	statsGroups := queryParams.Get("statsGroups").MustStringArray()
	if len(statsGroups) > 0 && len(dataframe.Fields) > 0 {
		groupedFrames, err := groupResults(dataframe, statsGroups)
		if err != nil {
			return plugins.DataResponse{}, err
		}

		response := plugins.DataResponse{
			Results: make(map[string]plugins.DataQueryResult),
		}

		response.Results["A"] = plugins.DataQueryResult{
			RefID:      "A",
			Dataframes: plugins.NewDecodedDataFrames(groupedFrames),
		}

		return response, nil
	}

	response := plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{
			"A": {
				RefID:      "A",
				Dataframes: plugins.NewDecodedDataFrames(data.Frames{dataframe}),
			},
		},
	}
	return response, nil
}

func (e *cloudWatchExecutor) getAWSDatasourceSettings(region string) *awsds.AWSDatasourceSettings {
	if region == defaultRegion {
		region = e.DataSource.JsonData.Get("defaultRegion").MustString()
	}

	atStr := e.DataSource.JsonData.Get("authType").MustString()
	assumeRoleARN := e.DataSource.JsonData.Get("assumeRoleArn").MustString()
	externalID := e.DataSource.JsonData.Get("externalId").MustString()
	endpoint := e.DataSource.JsonData.Get("endpoint").MustString()
	decrypted := e.DataSource.DecryptedValues()
	accessKey := decrypted["accessKey"]
	secretKey := decrypted["secretKey"]

	at := awsds.AuthTypeDefault
	switch atStr {
	case "credentials":
		at = awsds.AuthTypeSharedCreds
	case "keys":
		at = awsds.AuthTypeKeys
	case "default":
		at = awsds.AuthTypeDefault
	case "arn":
		at = awsds.AuthTypeDefault
		plog.Warn("Authentication type \"arn\" is deprecated, falling back to default")
	case "ec2_iam_role":
		at = awsds.AuthTypeEC2IAMRole
	default:
		plog.Warn("Unrecognized AWS authentication type", "type", atStr)
	}

	profile := e.DataSource.JsonData.Get("profile").MustString()
	if profile == "" {
		profile = e.DataSource.Database // legacy support
	}

	return &awsds.AWSDatasourceSettings{
		Region:        region,
		Profile:       profile,
		AuthType:      at,
		AssumeRoleARN: assumeRoleARN,
		ExternalID:    externalID,
		AccessKey:     accessKey,
		SecretKey:     secretKey,
		Endpoint:      endpoint,
	}
}

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}

// NewCWClient is a CloudWatch client factory.
//
// Stubbable by tests.
var NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
	client := cloudwatch.New(sess)
	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})

	return client
}

// NewCWLogsClient is a CloudWatch logs client factory.
//
// Stubbable by tests.
var NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
	client := cloudwatchlogs.New(sess)
	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})

	return client
}

// EC2 client factory.
//
// Stubbable by tests.
var newEC2Client = func(provider client.ConfigProvider) ec2iface.EC2API {
	return ec2.New(provider)
}

// RGTA client factory.
//
// Stubbable by tests.
var newRGTAClient = func(provider client.ConfigProvider) resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI {
	return resourcegroupstaggingapi.New(provider)
}
