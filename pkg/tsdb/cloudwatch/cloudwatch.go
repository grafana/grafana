package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type datasourceInfo struct {
	profile       string
	region        string
	authType      awsds.AuthType
	assumeRoleARN string
	externalID    string
	namespace     string
	endpoint      string

	accessKey string
	secretKey string

	datasourceID int64

	HTTPClient *http.Client
}

type DataQueryJson struct {
	QueryType       string `json:"type,omitempty"`
	QueryMode       string
	PrefixMatching  bool
	Region          string
	Namespace       string
	MetricName      string
	Dimensions      map[string]interface{}
	Statistic       *string
	Period          string
	ActionPrefix    string
	AlarmNamePrefix string
}

const (
	cloudWatchTSFormat = "2006-01-02 15:04:05.000"
	defaultRegion      = "default"

	// Constants also defined in datasource/cloudwatch/datasource.ts
	logIdentifierInternal       = "__log__grafana_internal__"
	logStreamIdentifierInternal = "__logstream__grafana_internal__"

	alertMaxAttempts = 8
	alertPollPeriod  = 1000 * time.Millisecond
	logsQueryMode    = "Logs"

	// QueryTypes
	annotationQuery = "annotationQuery"
	logAction       = "logAction"
	timeSeriesQuery = "timeSeriesQuery"
)

var plog = log.New("tsdb.cloudwatch")
var aliasFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
var baseLimit = int64(1)

func ProvideService(cfg *setting.Cfg, httpClientProvider httpclient.Provider, features featuremgmt.FeatureToggles) *CloudWatchService {
	plog.Debug("initing")

	executor := newExecutor(datasource.NewInstanceManager(NewInstanceSettings(httpClientProvider)), cfg, awsds.NewSessionCache(), features)

	return &CloudWatchService{
		Cfg:      cfg,
		Executor: executor,
	}
}

type CloudWatchService struct {
	Cfg      *setting.Cfg
	Executor *cloudWatchExecutor
}

type SessionCache interface {
	GetSession(c awsds.SessionConfig) (*session.Session, error)
}

func newExecutor(im instancemgmt.InstanceManager, cfg *setting.Cfg, sessions SessionCache, features featuremgmt.FeatureToggles) *cloudWatchExecutor {
	cwe := &cloudWatchExecutor{
		im:       im,
		cfg:      cfg,
		sessions: sessions,
		features: features,
	}
	cwe.resourceHandler = httpadapter.New(cwe.newResourceMux())
	return cwe
}

func NewInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := struct {
			Profile       string `json:"profile"`
			Region        string `json:"defaultRegion"`
			AssumeRoleARN string `json:"assumeRoleArn"`
			ExternalID    string `json:"externalId"`
			Endpoint      string `json:"endpoint"`
			Namespace     string `json:"customMetricsNamespaces"`
			AuthType      string `json:"authType"`
		}{}

		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		httpClient, err := httpClientProvider.New()
		if err != nil {
			return nil, fmt.Errorf("error creating http client: %w", err)
		}

		model := datasourceInfo{
			profile:       jsonData.Profile,
			region:        jsonData.Region,
			assumeRoleARN: jsonData.AssumeRoleARN,
			externalID:    jsonData.ExternalID,
			endpoint:      jsonData.Endpoint,
			namespace:     jsonData.Namespace,
			datasourceID:  settings.ID,
			HTTPClient:    httpClient,
		}

		at := awsds.AuthTypeDefault
		switch jsonData.AuthType {
		case "credentials":
			at = awsds.AuthTypeSharedCreds
		case "keys":
			at = awsds.AuthTypeKeys
		case "default":
			at = awsds.AuthTypeDefault
		case "ec2_iam_role":
			at = awsds.AuthTypeEC2IAMRole
		case "arn":
			at = awsds.AuthTypeDefault
			plog.Warn("Authentication type \"arn\" is deprecated, falling back to default")
		default:
			plog.Warn("Unrecognized AWS authentication type", "type", jsonData.AuthType)
		}

		model.authType = at

		if model.profile == "" {
			model.profile = settings.Database // legacy support
		}

		model.accessKey = settings.DecryptedSecureJSONData["accessKey"]
		model.secretKey = settings.DecryptedSecureJSONData["secretKey"]

		return model, nil
	}
}

// cloudWatchExecutor executes CloudWatch requests.
type cloudWatchExecutor struct {
	im       instancemgmt.InstanceManager
	cfg      *setting.Cfg
	sessions SessionCache
	features featuremgmt.FeatureToggles

	resourceHandler backend.CallResourceHandler
}

func (e *cloudWatchExecutor) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return e.resourceHandler.CallResource(ctx, req, sender)
}

func (e *cloudWatchExecutor) checkHealthMetrics(pluginCtx backend.PluginContext) error {
	namespace := "AWS/Billing"
	metric := "EstimatedCharges"
	params := &cloudwatch.ListMetricsInput{
		Namespace:  &namespace,
		MetricName: &metric,
	}
	_, err := e.listMetrics(pluginCtx, defaultRegion, params)
	return err
}

func (e *cloudWatchExecutor) checkHealthLogs(ctx context.Context, pluginCtx backend.PluginContext) error {
	logsClient, err := e.getCWLogsClient(pluginCtx, defaultRegion)
	if err != nil {
		return err
	}

	parameters := LogQueryJson{
		Limit: &baseLimit,
	}

	_, err = e.handleDescribeLogGroups(ctx, logsClient, parameters)
	return err
}

func (e *cloudWatchExecutor) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	status := backend.HealthStatusOk
	metricsTest := "Successfully queried the CloudWatch metrics API."
	logsTest := "Successfully queried the CloudWatch logs API."

	err := e.checkHealthMetrics(req.PluginContext)
	if err != nil {
		status = backend.HealthStatusError
		metricsTest = fmt.Sprintf("CloudWatch metrics query failed: %s", err.Error())
	}

	err = e.checkHealthLogs(ctx, req.PluginContext)
	if err != nil {
		status = backend.HealthStatusError
		logsTest = fmt.Sprintf("CloudWatch logs query failed: %s", err.Error())
	}

	return &backend.CheckHealthResult{
		Status:  status,
		Message: fmt.Sprintf("1. %s\n2. %s", metricsTest, logsTest),
	}, nil
}

func (e *cloudWatchExecutor) newSession(pluginCtx backend.PluginContext, region string) (*session.Session, error) {
	dsInfo, err := e.getDSInfo(pluginCtx)
	if err != nil {
		return nil, err
	}

	if region == defaultRegion {
		region = dsInfo.region
	}

	return e.sessions.GetSession(awsds.SessionConfig{
		// https://github.com/grafana/grafana/issues/46365
		// HTTPClient: dsInfo.HTTPClient,
		Settings: awsds.AWSDatasourceSettings{
			Profile:       dsInfo.profile,
			Region:        region,
			AuthType:      dsInfo.authType,
			AssumeRoleARN: dsInfo.assumeRoleARN,
			ExternalID:    dsInfo.externalID,
			Endpoint:      dsInfo.endpoint,
			DefaultRegion: dsInfo.region,
			AccessKey:     dsInfo.accessKey,
			SecretKey:     dsInfo.secretKey,
		},
		UserAgentName: aws.String("Cloudwatch"),
	})
}

func (e *cloudWatchExecutor) getCWClient(pluginCtx backend.PluginContext, region string) (cloudwatchiface.CloudWatchAPI, error) {
	sess, err := e.newSession(pluginCtx, region)
	if err != nil {
		return nil, err
	}
	return NewCWClient(sess), nil
}

func (e *cloudWatchExecutor) getCWLogsClient(pluginCtx backend.PluginContext, region string) (cloudwatchlogsiface.CloudWatchLogsAPI, error) {
	sess, err := e.newSession(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	logsClient := NewCWLogsClient(sess)

	return logsClient, nil
}

func (e *cloudWatchExecutor) getEC2Client(pluginCtx backend.PluginContext, region string) (ec2iface.EC2API, error) {
	sess, err := e.newSession(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return newEC2Client(sess), nil
}

func (e *cloudWatchExecutor) getRGTAClient(pluginCtx backend.PluginContext, region string) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI,
	error) {
	sess, err := e.newSession(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return newRGTAClient(sess), nil
}

func (e *cloudWatchExecutor) alertQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	queryContext backend.DataQuery, model LogQueryJson) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, model, queryContext.TimeRange)
	if err != nil {
		return nil, err
	}

	requestParams := LogQueryJson{
		Region:  model.Region,
		QueryId: *startQueryOutput.QueryId,
	}

	ticker := time.NewTicker(alertPollPeriod)
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
		if attemptCount >= alertMaxAttempts {
			return res, fmt.Errorf("fetching of query results exceeded max number of attempts")
		}

		attemptCount++
	}

	return nil, nil
}

func (e *cloudWatchExecutor) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	/*
		Unlike many other data sources, with Cloudwatch Logs query requests don't receive the results as the response
		to the query, but rather an ID is first returned. Following this, a client is expected to send requests along
		with the ID until the status of the query is complete, receiving (possibly partial) results each time. For
		queries made via dashboards and Explore, the logic of making these repeated queries is handled on the
		frontend, but because alerts are executed on the backend the logic needs to be reimplemented here.
	*/
	q := req.Queries[0]
	var model DataQueryJson
	err := json.Unmarshal(q.JSON, &model)
	if err != nil {
		return nil, err
	}
	_, fromAlert := req.Headers["FromAlert"]
	isLogAlertQuery := fromAlert && model.QueryMode == logsQueryMode

	if isLogAlertQuery {
		return e.executeLogAlertQuery(ctx, req)
	}

	var result *backend.QueryDataResponse
	switch model.QueryType {
	case annotationQuery:
		result, err = e.executeAnnotationQuery(req.PluginContext, model, q)
	case logAction:
		result, err = e.executeLogActions(ctx, req)
	case timeSeriesQuery:
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, req)
	}

	return result, err
}

func (e *cloudWatchExecutor) executeLogAlertQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		var model LogQueryJson
		err := json.Unmarshal(q.JSON, &model)
		if err != nil {
			continue
		}

		model.Subtype = "StartQuery"
		model.QueryString = model.Expression

		region := model.Region
		if model.Region == "" || region == defaultRegion {
			dsInfo, err := e.getDSInfo(req.PluginContext)
			if err != nil {
				return nil, err
			}
			model.Region = dsInfo.region
		}

		logsClient, err := e.getCWLogsClient(req.PluginContext, region)
		if err != nil {
			return nil, err
		}

		getQueryResultsOutput, err := e.alertQuery(ctx, logsClient, q, model)
		if err != nil {
			return nil, err
		}

		dataframe, err := logsResultsToDataframes(getQueryResultsOutput)
		if err != nil {
			return nil, err
		}

		var frames []*data.Frame
		if len(model.StatsGroups) > 0 && len(dataframe.Fields) > 0 {
			frames, err = groupResults(dataframe, model.StatsGroups)
			if err != nil {
				return nil, err
			}
		} else {
			frames = data.Frames{dataframe}
		}

		respD := resp.Responses["A"]
		respD.Frames = frames
		resp.Responses["A"] = respD
	}

	return resp, nil
}

func (e *cloudWatchExecutor) getDSInfo(pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := e.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(datasourceInfo)

	return &instance, nil
}

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}

// NewCWClient is a CloudWatch client factory.
//
// Stubbable by tests.
var NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
	return cloudwatch.New(sess)
}

// NewCWLogsClient is a CloudWatch logs client factory.
//
// Stubbable by tests.
var NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
	return cloudwatchlogs.New(sess)
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
