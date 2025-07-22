package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"
	"github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi"

	"github.com/grafana/grafana-aws-sdk/pkg/awsauth"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
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

	defaultRegion = "default"
	logsQueryMode = "Logs"
	// QueryTypes
	annotationQuery = "annotationQuery"
	logAction       = "logAction"
	timeSeriesQuery = "timeSeriesQuery"
)

type DataQueryJson struct {
	dataquery.CloudWatchAnnotationQuery
	Type string `json:"type,omitempty"`
}

type DataSource struct {
	Settings          models.CloudWatchSettings
	ProxyOpts         *proxy.Options
	AWSConfigProvider awsauth.ConfigProvider

	logger          log.Logger
	tagValueCache   *cache.Cache
	resourceHandler backend.CallResourceHandler
}

func (ds *DataSource) newAWSConfig(ctx context.Context, region string) (aws.Config, error) {
	if region == defaultRegion {
		if len(ds.Settings.Region) == 0 {
			return aws.Config{}, models.ErrMissingRegion
		}
		region = ds.Settings.Region
	}
	authSettings := awsauth.Settings{
		CredentialsProfile: ds.Settings.Profile,
		LegacyAuthType:     ds.Settings.AuthType,
		AssumeRoleARN:      ds.Settings.AssumeRoleARN,
		ExternalID:         ds.Settings.ExternalID,
		Endpoint:           ds.Settings.Endpoint,
		Region:             region,
		AccessKey:          ds.Settings.AccessKey,
		SecretKey:          ds.Settings.SecretKey,
		HTTPClient:         &http.Client{},
	}
	if ds.Settings.GrafanaSettings.SecureSocksDSProxyEnabled && ds.Settings.SecureSocksProxyEnabled {
		authSettings.ProxyOptions = ds.ProxyOpts
	}
	cfg, err := ds.AWSConfigProvider.GetConfig(ctx, authSettings)
	if err != nil {
		return aws.Config{}, err
	}
	return cfg, nil
}

func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	instanceSettings, err := models.LoadCloudWatchSettings(ctx, settings)
	if err != nil {
		return nil, fmt.Errorf("error reading settings: %w", err)
	}

	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, err
	}

	ds := &DataSource{
		Settings: instanceSettings,
		// this is used to build a custom dialer when secure socks proxy is enabled
		ProxyOpts:         opts.ProxyOptions,
		AWSConfigProvider: awsauth.NewConfigProvider(),
		logger:            backend.NewLoggerWith("logger", "grafana-cloudwatch-datasource"),
		tagValueCache:     cache.New(tagValueCacheExpiration, tagValueCacheExpiration*5),
	}
	ds.resourceHandler = httpadapter.New(ds.newResourceMux())
	return ds, nil
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

func (ds *DataSource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx = instrumentContext(ctx, string(backend.EndpointCallResource), req.PluginContext)
	return ds.resourceHandler.CallResource(ctx, req, sender)
}

func (ds *DataSource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
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
		return executeSyncLogQuery(ctx, ds, req)
	}

	var result *backend.QueryDataResponse
	switch model.Type {
	case annotationQuery:
		result, err = ds.executeAnnotationQuery(ctx, model, q)
	case logAction:
		result, err = ds.executeLogActions(ctx, req)
	case timeSeriesQuery:
		fallthrough
	default:
		result, err = ds.executeTimeSeriesQuery(ctx, req)
	}

	return result, err
}

func (ds *DataSource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx = instrumentContext(ctx, string(backend.EndpointCheckHealth), req.PluginContext)
	status := backend.HealthStatusOk
	metricsTest := "Successfully queried the CloudWatch metrics API."
	logsTest := "Successfully queried the CloudWatch logs API."

	err := ds.checkHealthMetrics(ctx, req.PluginContext)
	if err != nil {
		status = backend.HealthStatusError
		metricsTest = fmt.Sprintf("CloudWatch metrics query failed: %s", err.Error())
	}

	err = ds.checkHealthLogs(ctx)
	if err != nil {
		status = backend.HealthStatusError
		logsTest = fmt.Sprintf("CloudWatch logs query failed: %s", err.Error())
	}

	return &backend.CheckHealthResult{
		Status:  status,
		Message: fmt.Sprintf("1. %s\n2. %s", metricsTest, logsTest),
	}, nil
}

func (ds *DataSource) checkHealthMetrics(ctx context.Context, _ backend.PluginContext) error {
	namespace := "AWS/Billing"
	metric := "EstimatedCharges"
	params := &cloudwatch.ListMetricsInput{
		Namespace:  &namespace,
		MetricName: &metric,
	}

	cfg, err := ds.newAWSConfig(ctx, defaultRegion)
	if err != nil {
		return err
	}

	metricClient := clients.NewMetricsClient(NewCWClient(cfg), ds.Settings.GrafanaSettings.ListMetricsPageLimit)
	_, err = metricClient.ListMetricsWithPageLimit(ctx, params)
	return err
}

func (ds *DataSource) checkHealthLogs(ctx context.Context) error {
	cfg, err := ds.getAWSConfig(ctx, defaultRegion)
	if err != nil {
		return err
	}
	logsClient := NewLogsAPI(cfg)
	_, err = logsClient.DescribeLogGroups(ctx, &cloudwatchlogs.DescribeLogGroupsInput{Limit: aws.Int32(1)})
	return err
}

func (ds *DataSource) getAWSConfig(ctx context.Context, region string) (aws.Config, error) {
	return ds.newAWSConfig(ctx, region)
}

func (ds *DataSource) getCWClient(ctx context.Context, region string) (models.CWClient, error) {
	cfg, err := ds.getAWSConfig(ctx, region)
	if err != nil {
		return nil, err
	}
	return NewCWClient(cfg), nil
}

func (ds *DataSource) getCWLogsClient(ctx context.Context, region string) (models.CWLogsClient, error) {
	cfg, err := ds.getAWSConfig(ctx, region)
	if err != nil {
		return nil, err
	}

	logsClient := NewCWLogsClient(cfg)

	return logsClient, nil
}

func (ds *DataSource) getEC2Client(ctx context.Context, region string) (models.EC2APIProvider, error) {
	cfg, err := ds.getAWSConfig(ctx, region)
	if err != nil {
		return nil, err
	}

	return NewEC2API(cfg), nil
}

func (ds *DataSource) getRGTAClient(ctx context.Context, region string) (resourcegroupstaggingapi.GetResourcesAPIClient,
	error) {
	cfg, err := ds.getAWSConfig(ctx, region)
	if err != nil {
		return nil, err
	}

	return NewRGTAClient(cfg), nil
}

var terminatedStates = []cloudwatchlogstypes.QueryStatus{
	cloudwatchlogstypes.QueryStatusComplete,
	cloudwatchlogstypes.QueryStatusCancelled,
	cloudwatchlogstypes.QueryStatusFailed,
	cloudwatchlogstypes.QueryStatusTimeout,
}

func isTerminated(queryStatus cloudwatchlogstypes.QueryStatus) bool {
	return slices.Contains(terminatedStates, queryStatus)
}
