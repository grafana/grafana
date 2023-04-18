package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sync"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/query"
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
	defaultRegion = "default"
	logsQueryMode = "Logs"
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

func NewInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		instanceSettings, err := models.LoadCloudWatchSettings(settings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		httpClient, err := httpClientProvider.New(opts)
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
	im          instancemgmt.InstanceManager
	cfg         *setting.Cfg
	sessions    SessionCache
	features    featuremgmt.FeatureToggles
	regionCache sync.Map

	resourceHandler backend.CallResourceHandler
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
		OAMAPIProvider:        NewOAMAPI(sess),
		MetricsClientProvider: clients.NewMetricsClient(NewMetricsAPI(sess), e.cfg),
		LogsAPIProvider:       NewLogsAPI(sess),
		Settings:              instance.Settings,
		Features:              e.features,
	}, nil
}

func (e *cloudWatchExecutor) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return e.resourceHandler.CallResource(ctx, req, sender)
}

func (e *cloudWatchExecutor) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := logger.FromContext(ctx)
	/*
		Unlike many other data sources, with Cloudwatch Logs query requests don't receive the results as the response
		to the query, but rather an ID is first returned. Following this, a client is expected to send requests along
		with the ID until the status of the query is complete, receiving (possibly partial) results each time. For
		queries made via dashboards and Explore, the logic of making these repeated queries is handled on the
		frontend, but because alerts and expressions are executed on the backend the logic needs to be reimplemented here.
	*/
	q := req.Queries[0]
	var model DataQueryJson
	err := json.Unmarshal(q.JSON, &model)
	if err != nil {
		return nil, err
	}

	_, fromAlert := req.Headers[ngalertmodels.FromAlertHeaderName]
	fromExpression := req.GetHTTPHeader(query.HeaderFromExpression) != ""
	isSyncLogQuery := (fromAlert || fromExpression) && model.QueryMode == logsQueryMode
	if isSyncLogQuery {
		return executeSyncLogQuery(ctx, e, req)
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
	session, err := e.newSession(pluginCtx, defaultRegion)
	if err != nil {
		return err
	}
	logsClient := NewLogsAPI(session)
	_, err = logsClient.DescribeLogGroups(&cloudwatchlogs.DescribeLogGroupsInput{Limit: aws.Int64(1)})
	return err
}

func (e *cloudWatchExecutor) newSession(pluginCtx backend.PluginContext, region string) (*session.Session, error) {
	instance, err := e.getInstance(pluginCtx)
	if err != nil {
		return nil, err
	}

	if region == defaultRegion {
		region = instance.Settings.Region
	}

	sess, err := e.sessions.GetSession(awsds.SessionConfig{
		// https://github.com/grafana/grafana/issues/46365
		// HTTPClient: instance.HTTPClient,
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
	if err != nil {
		return nil, err
	}

	// work around until https://github.com/grafana/grafana/issues/39089 is implemented
	if e.cfg.SecureSocksDSProxy.Enabled && instance.Settings.SecureSocksProxyEnabled {
		// only update the transport to try to avoid the issue mentioned here https://github.com/grafana/grafana/issues/46365
		sess.Config.HTTPClient.Transport = instance.HTTPClient.Transport
	}

	return sess, nil
}

func (e *cloudWatchExecutor) getInstance(pluginCtx backend.PluginContext) (*DataSource, error) {
	i, err := e.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(DataSource)
	return &instance, nil
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

func (e *cloudWatchExecutor) getEC2Client(pluginCtx backend.PluginContext, region string) (models.EC2APIProvider, error) {
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

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}
