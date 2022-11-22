package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/clients"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

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

type DataSource struct {
	Settings   models.CloudWatchSettings
	HTTPClient *http.Client
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

var logger = log.New("tsdb.cloudwatch")
var aliasFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

func ProvideService(cfg *setting.Cfg, httpClientProvider httpclient.Provider, features featuremgmt.FeatureToggles) *CloudWatchService {
	logger.Debug("Initializing")

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
	e := &cloudWatchExecutor{
		im:       im,
		cfg:      cfg,
		sessions: sessions,
		features: features,
	}

	e.resourceHandler = httpadapter.New(e.newResourceMux())
	return e
}

func (e *cloudWatchExecutor) getRequestContext(pluginCtx backend.PluginContext, region string) (models.RequestContext, error) {
	r := region
	instance, err := e.getInstance(pluginCtx)
	if region == defaultRegion {
		if err != nil {
			return models.RequestContext{}, err
		}
		r = instance.Settings.Region
	}

	sess, err := e.newSession(pluginCtx, r)
	if err != nil {
		return models.RequestContext{}, err
	}
	return models.RequestContext{
		MetricsClientProvider: clients.NewMetricsClient(NewMetricsAPI(sess), e.cfg),
		Settings:              instance.Settings,
	}, nil
}

func NewInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		instanceSettings, err := models.LoadCloudWatchSettings(settings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		httpClient, err := httpClientProvider.New()
		if err != nil {
			return nil, fmt.Errorf("error creating http client: %w", err)
		}

		return DataSource{
			Settings:   instanceSettings,
			HTTPClient: httpClient,
		}, nil
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

	session, err := e.newSession(pluginCtx, defaultRegion)
	if err != nil {
		return err
	}
	metricClient := clients.NewMetricsClient(NewMetricsAPI(session), e.cfg)
	_, err = metricClient.ListMetricsWithPageLimit(params)
	return err
}

func (e *cloudWatchExecutor) checkHealthLogs(pluginCtx backend.PluginContext) error {
	parameters := url.Values{
		"limit": []string{"1"},
	}

	_, err := e.handleGetLogGroups(pluginCtx, parameters)
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

	err = e.checkHealthLogs(req.PluginContext)
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
	instance, err := e.getInstance(pluginCtx)
	if err != nil {
		return nil, err
	}

	if region == defaultRegion {
		region = instance.Settings.Region
	}

	return e.sessions.GetSession(awsds.SessionConfig{
		// https://github.com/grafana/grafana/issues/46365
		// HTTPClient: dsInfo.HTTPClient,
		Settings: awsds.AWSDatasourceSettings{
			Profile:       instance.Settings.Profile,
			Region:        region,
			AuthType:      instance.Settings.AuthType,
			AssumeRoleARN: instance.Settings.AssumeRoleARN,
			ExternalID:    instance.Settings.ExternalID,
			Endpoint:      instance.Settings.Endpoint,
			DefaultRegion: instance.Settings.Region,
			AccessKey:     instance.Settings.AccessKey,
			SecretKey:     instance.Settings.SecretKey,
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
	logger := logger.FromContext(ctx)
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
		result, err = e.executeLogActions(ctx, logger, req)
	case timeSeriesQuery:
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, logger, req)
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
			instance, err := e.getInstance(req.PluginContext)
			if err != nil {
				return nil, err
			}
			model.Region = instance.Settings.Region
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

func (e *cloudWatchExecutor) getInstance(pluginCtx backend.PluginContext) (*DataSource, error) {
	i, err := e.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(DataSource)

	return &instance, nil
}

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}

// NewMetricsAPI is a CloudWatch metrics api factory.
//
// Stubbable by tests.
var NewMetricsAPI = func(sess *session.Session) models.CloudWatchMetricsAPIProvider {
	return cloudwatch.New(sess)
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
