package cloudwatch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

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
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/clients"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/patrickmn/go-cache"
)

const (
	tagValueCacheExpiration = time.Hour * 24

	// headerFromExpression is used by datasources to identify expression queries
	headerFromExpression = "X-Grafana-From-Expr"

	// headerFromAlert is used by datasources to identify alert queries
	headerFromAlert = "FromAlert"
)

type DataQueryJson struct {
	dataquery.CloudWatchAnnotationQuery
	Type string `json:"type,omitempty"`
}

type DataSource struct {
	Settings      models.CloudWatchSettings
	HTTPClient    *http.Client
	sessions      SessionCache
	tagValueCache *cache.Cache
	ProxyOpts     *proxy.Options
}

const (
	defaultRegion = "default"
	logsQueryMode = "Logs"
	// QueryTypes
	annotationQuery = "annotationQuery"
	logAction       = "logAction"
	timeSeriesQuery = "timeSeriesQuery"
)

func ProvideService(httpClientProvider *httpclient.Provider) *CloudWatchService {
	logger := backend.NewLoggerWith("logger", "tsdb.cloudwatch")
	logger.Debug("Initializing")

	executor := newExecutor(
		datasource.NewInstanceManager(NewInstanceSettings(httpClientProvider)),
		logger,
	)

	return &CloudWatchService{
		Executor: executor,
	}
}

type CloudWatchService struct {
	Executor *cloudWatchExecutor
}

type SessionCache interface {
	GetSessionWithAuthSettings(c awsds.GetSessionConfig, as awsds.AuthSettings) (*session.Session, error)
}

func newExecutor(im instancemgmt.InstanceManager, logger log.Logger) *cloudWatchExecutor {
	e := &cloudWatchExecutor{
		im:     im,
		logger: logger,
	}

	e.resourceHandler = httpadapter.New(e.newResourceMux())
	return e
}

func NewInstanceSettings(httpClientProvider *httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		instanceSettings, err := models.LoadCloudWatchSettings(ctx, settings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		opts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			return nil, err
		}

		httpClient, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, fmt.Errorf("error creating http client: %w", err)
		}

		return DataSource{
			Settings:      instanceSettings,
			HTTPClient:    httpClient,
			tagValueCache: cache.New(tagValueCacheExpiration, tagValueCacheExpiration*5),
			sessions:      awsds.NewSessionCache(),
			// this is used to build a custom dialer when secure socks proxy is enabled
			ProxyOpts: opts.ProxyOptions,
		}, nil
	}
}

// cloudWatchExecutor executes CloudWatch requests
type cloudWatchExecutor struct {
	im     instancemgmt.InstanceManager
	logger log.Logger

	resourceHandler backend.CallResourceHandler
}

// instrumentContext adds plugin key-values to the context; later, logger.FromContext(ctx) will provide a logger
// that adds these values to its output.
// TODO: move this into the sdk (see https://github.com/grafana/grafana/issues/82033)
func instrumentContext(ctx context.Context, endpoint string, pCtx backend.PluginContext) context.Context {
	p := []any{"endpoint", endpoint, "pluginId", pCtx.PluginID}
	if pCtx.DataSourceInstanceSettings != nil {
		p = append(p, "dsName", pCtx.DataSourceInstanceSettings.Name)
		p = append(p, "dsUID", pCtx.DataSourceInstanceSettings.UID)
	}
	if pCtx.User != nil {
		p = append(p, "uname", pCtx.User.Login)
	}
	return log.WithContextualAttributes(ctx, p)
}

func (e *cloudWatchExecutor) getRequestContext(ctx context.Context, pluginCtx backend.PluginContext, region string) (models.RequestContext, error) {
	r := region
	instance, err := e.getInstance(ctx, pluginCtx)
	if region == defaultRegion {
		if err != nil {
			return models.RequestContext{}, err
		}
		r = instance.Settings.Region
	}

	ec2Client, err := e.getEC2Client(ctx, pluginCtx, defaultRegion)
	if err != nil {
		return models.RequestContext{}, err
	}

	sess, err := instance.newSession(r)
	if err != nil {
		return models.RequestContext{}, err
	}

	return models.RequestContext{
		OAMAPIProvider:        NewOAMAPI(sess),
		MetricsClientProvider: clients.NewMetricsClient(NewMetricsAPI(sess), instance.Settings.GrafanaSettings.ListMetricsPageLimit),
		LogsAPIProvider:       NewLogsAPI(sess),
		EC2APIProvider:        ec2Client,
		Settings:              instance.Settings,
		Logger:                e.logger.FromContext(ctx),
	}, nil
}

// getRequestContextOnlySettings is useful for resource endpoints that are called before auth has been configured such as external-id that need access to settings but nothing else
func (e *cloudWatchExecutor) getRequestContextOnlySettings(ctx context.Context, pluginCtx backend.PluginContext, _ string) (models.RequestContext, error) {
	instance, err := e.getInstance(ctx, pluginCtx)
	if err != nil {
		return models.RequestContext{}, err
	}

	return models.RequestContext{
		OAMAPIProvider:        nil,
		MetricsClientProvider: nil,
		LogsAPIProvider:       nil,
		EC2APIProvider:        nil,
		Settings:              instance.Settings,
		Logger:                e.logger.FromContext(ctx),
	}, nil
}

func (e *cloudWatchExecutor) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx = instrumentContext(ctx, string(backend.EndpointCallResource), req.PluginContext)
	return e.resourceHandler.CallResource(ctx, req, sender)
}

func (e *cloudWatchExecutor) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx = instrumentContext(ctx, string(backend.EndpointQueryData), req.PluginContext)
	q := req.Queries[0]
	var model DataQueryJson
	err := json.Unmarshal(q.JSON, &model)
	if err != nil {
		return nil, err
	}

	_, fromAlert := req.Headers[headerFromAlert]
	fromExpression := req.GetHTTPHeader(headerFromExpression) != ""
	// Public dashboard queries execute like alert queries, i.e. they execute on the backend, therefore, we need to handle them synchronously.
	// Since `model.Type` is set during execution on the frontend by the query runner and isn't saved with the query, we are checking here is
	// missing the `model.Type` property and if it is a log query in order to determine if it is a public dashboard query.
	queryMode := ""
	if model.QueryMode != "" {
		queryMode = string(model.QueryMode)
	}
	fromPublicDashboard := model.Type == "" && queryMode == logsQueryMode
	isSyncLogQuery := ((fromAlert || fromExpression) && queryMode == logsQueryMode) || fromPublicDashboard
	if isSyncLogQuery {
		return executeSyncLogQuery(ctx, e, req)
	}

	var result *backend.QueryDataResponse
	switch model.Type {
	case annotationQuery:
		result, err = e.executeAnnotationQuery(ctx, req.PluginContext, model, q)
	case logAction:
		result, err = e.executeLogActions(ctx, req)
	case timeSeriesQuery:
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, req)
	}

	return result, err
}

func (e *cloudWatchExecutor) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx = instrumentContext(ctx, string(backend.EndpointCheckHealth), req.PluginContext)
	status := backend.HealthStatusOk
	metricsTest := "Successfully queried the CloudWatch metrics API."
	logsTest := "Successfully queried the CloudWatch logs API."

	err := e.checkHealthMetrics(ctx, req.PluginContext)
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

func (e *cloudWatchExecutor) checkHealthMetrics(ctx context.Context, pluginCtx backend.PluginContext) error {
	namespace := "AWS/Billing"
	metric := "EstimatedCharges"
	params := &cloudwatch.ListMetricsInput{
		Namespace:  &namespace,
		MetricName: &metric,
	}

	instance, err := e.getInstance(ctx, pluginCtx)
	if err != nil {
		return err
	}

	session, err := instance.newSession(defaultRegion)
	if err != nil {
		return err
	}

	metricClient := clients.NewMetricsClient(NewMetricsAPI(session), instance.Settings.GrafanaSettings.ListMetricsPageLimit)
	_, err = metricClient.ListMetricsWithPageLimit(ctx, params)
	return err
}

func (e *cloudWatchExecutor) checkHealthLogs(ctx context.Context, pluginCtx backend.PluginContext) error {
	session, err := e.newSessionFromContext(ctx, pluginCtx, defaultRegion)
	if err != nil {
		return err
	}
	logsClient := NewLogsAPI(session)
	_, err = logsClient.DescribeLogGroupsWithContext(ctx, &cloudwatchlogs.DescribeLogGroupsInput{Limit: aws.Int64(1)})
	return err
}

func (ds *DataSource) newSession(region string) (*session.Session, error) {
	if region == defaultRegion {
		if len(ds.Settings.Region) == 0 {
			return nil, models.ErrMissingRegion
		}
		region = ds.Settings.Region
	}
	sess, err := ds.sessions.GetSessionWithAuthSettings(awsds.GetSessionConfig{
		// https://github.com/grafana/grafana/issues/46365
		// HTTPClient: instance.HTTPClient,
		Settings: awsds.AWSDatasourceSettings{
			Profile:       ds.Settings.Profile,
			Region:        region,
			AuthType:      ds.Settings.AuthType,
			AssumeRoleARN: ds.Settings.AssumeRoleARN,
			ExternalID:    ds.Settings.ExternalID,
			Endpoint:      ds.Settings.Endpoint,
			DefaultRegion: ds.Settings.Region,
			AccessKey:     ds.Settings.AccessKey,
			SecretKey:     ds.Settings.SecretKey,
		},
		UserAgentName: aws.String("Cloudwatch")},
		ds.Settings.GrafanaSettings)
	if err != nil {
		return nil, err
	}

	// work around until https://github.com/grafana/grafana/issues/39089 is implemented
	if ds.Settings.GrafanaSettings.SecureSocksDSProxyEnabled && ds.Settings.SecureSocksProxyEnabled {
		// only update the transport to try to avoid the issue mentioned here https://github.com/grafana/grafana/issues/46365
		// also, 'sess' is cached and reused, so the first time it might have the transport not set, the following uses it will
		if sess.Config.HTTPClient.Transport == nil {
			// following go standard library logic (https://pkg.go.dev/net/http#Client), if no Transport is provided,
			// then we use http.DefaultTransport
			defTransport, ok := http.DefaultTransport.(*http.Transport)
			if !ok {
				// this should not happen but validating just in case
				return nil, errors.New("default http client transport is not of type http.Transport")
			}
			sess.Config.HTTPClient.Transport = defTransport.Clone()
		}
		err = proxy.New(ds.ProxyOpts).ConfigureSecureSocksHTTPProxy(sess.Config.HTTPClient.Transport.(*http.Transport))
		if err != nil {
			return nil, fmt.Errorf("error configuring Secure Socks proxy for Transport: %w", err)
		}
	} else if sess.Config.HTTPClient != nil {
		// Workaround for https://github.com/grafana/grafana/issues/91356 - PDC transport set above
		// stays on the cached session after PDC is disabled
		sess.Config.HTTPClient.Transport = nil
	}
	return sess, nil
}

func (e *cloudWatchExecutor) newSessionFromContext(ctx context.Context, pluginCtx backend.PluginContext, region string) (*session.Session, error) {
	instance, err := e.getInstance(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	return instance.newSession(region)
}

func (e *cloudWatchExecutor) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*DataSource, error) {
	i, err := e.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(DataSource)
	return &instance, nil
}

func (e *cloudWatchExecutor) getCWClient(ctx context.Context, pluginCtx backend.PluginContext, region string) (cloudwatchiface.CloudWatchAPI, error) {
	sess, err := e.newSessionFromContext(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}
	return NewCWClient(sess), nil
}

func (e *cloudWatchExecutor) getCWLogsClient(ctx context.Context, pluginCtx backend.PluginContext, region string) (cloudwatchlogsiface.CloudWatchLogsAPI, error) {
	sess, err := e.newSessionFromContext(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}

	logsClient := NewCWLogsClient(sess)

	return logsClient, nil
}

func (e *cloudWatchExecutor) getEC2Client(ctx context.Context, pluginCtx backend.PluginContext, region string) (models.EC2APIProvider, error) {
	sess, err := e.newSessionFromContext(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return NewEC2Client(sess), nil
}

func (e *cloudWatchExecutor) getRGTAClient(ctx context.Context, pluginCtx backend.PluginContext, region string) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI,
	error) {
	sess, err := e.newSessionFromContext(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return newRGTAClient(sess), nil
}

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}
