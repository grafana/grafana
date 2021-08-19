package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

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
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
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
}

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
	LogsService          *LogsService          `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
}

func (s *CloudWatchService) Init() error {
	plog.Debug("initing")

	im := datasource.NewInstanceManager(NewInstanceSettings())

	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: newExecutor(s.LogsService, im, s.Cfg, awsds.NewSessionCache()),
	})

	if err := s.BackendPluginManager.RegisterAndStart(context.Background(), "cloudwatch", factory); err != nil {
		plog.Error("Failed to register plugin", "error", err)
	}
	return nil
}

type SessionCache interface {
	GetSession(region string, s awsds.AWSDatasourceSettings) (*session.Session, error)
}

func newExecutor(logsService *LogsService, im instancemgmt.InstanceManager, cfg *setting.Cfg, sessions SessionCache) *cloudWatchExecutor {
	return &cloudWatchExecutor{
		logsService: logsService,
		im:          im,
		cfg:         cfg,
		sessions:    sessions,
	}
}

func NewInstanceSettings() datasource.InstanceFactoryFunc {
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

		model := datasourceInfo{
			profile:       jsonData.Profile,
			region:        jsonData.Region,
			assumeRoleARN: jsonData.AssumeRoleARN,
			externalID:    jsonData.ExternalID,
			endpoint:      jsonData.Endpoint,
			namespace:     jsonData.Namespace,
			datasourceID:  settings.ID,
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
	logsService *LogsService
	im          instancemgmt.InstanceManager
	cfg         *setting.Cfg
	sessions    SessionCache
}

func (e *cloudWatchExecutor) newSession(region string, pluginCtx backend.PluginContext) (*session.Session, error) {
	dsInfo, err := e.getDSInfo(pluginCtx)
	if err != nil {
		return nil, err
	}

	if region == defaultRegion {
		region = dsInfo.region
	}

	return e.sessions.GetSession(region, awsds.AWSDatasourceSettings{
		Profile:       dsInfo.profile,
		Region:        region,
		AuthType:      dsInfo.authType,
		AssumeRoleARN: dsInfo.assumeRoleARN,
		ExternalID:    dsInfo.externalID,
		Endpoint:      dsInfo.endpoint,
		DefaultRegion: dsInfo.region,
		AccessKey:     dsInfo.accessKey,
		SecretKey:     dsInfo.secretKey,
	})
}

func (e *cloudWatchExecutor) getCWClient(region string, pluginCtx backend.PluginContext) (cloudwatchiface.CloudWatchAPI, error) {
	sess, err := e.newSession(region, pluginCtx)
	if err != nil {
		return nil, err
	}
	return NewCWClient(sess), nil
}

func (e *cloudWatchExecutor) getCWLogsClient(region string, pluginCtx backend.PluginContext) (cloudwatchlogsiface.CloudWatchLogsAPI, error) {
	sess, err := e.newSession(region, pluginCtx)
	if err != nil {
		return nil, err
	}

	logsClient := NewCWLogsClient(sess)

	return logsClient, nil
}

func (e *cloudWatchExecutor) getEC2Client(region string, pluginCtx backend.PluginContext) (ec2iface.EC2API, error) {
	sess, err := e.newSession(region, pluginCtx)
	if err != nil {
		return nil, err
	}

	return newEC2Client(sess), nil
}

func (e *cloudWatchExecutor) getRGTAClient(region string, pluginCtx backend.PluginContext) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI,
	error) {
	sess, err := e.newSession(region, pluginCtx)
	if err != nil {
		return nil, err
	}

	return newRGTAClient(sess), nil
}

func (e *cloudWatchExecutor) alertQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	queryContext backend.DataQuery, model *simplejson.Json) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	const maxAttempts = 8
	const pollPeriod = 1000 * time.Millisecond

	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, model, queryContext.TimeRange)
	if err != nil {
		return nil, err
	}

	requestParams := simplejson.NewFromAny(map[string]interface{}{
		"region":  model.Get("region").MustString(""),
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

func (e *cloudWatchExecutor) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	/*
		Unlike many other data sources, with Cloudwatch Logs query requests don't receive the results as the response
		to the query, but rather an ID is first returned. Following this, a client is expected to send requests along
		with the ID until the status of the query is complete, receiving (possibly partial) results each time. For
		queries made via dashboards and Explore, the logic of making these repeated queries is handled on the
		frontend, but because alerts are executed on the backend the logic needs to be reimplemented here.
	*/
	q := req.Queries[0]
	model, err := simplejson.NewJson(q.JSON)
	if err != nil {
		return nil, err
	}
	_, fromAlert := req.Headers["FromAlert"]
	isLogAlertQuery := fromAlert && model.Get("queryMode").MustString("") == "Logs"

	if isLogAlertQuery {
		return e.executeLogAlertQuery(ctx, req)
	}

	queryType := model.Get("type").MustString("")

	var result *backend.QueryDataResponse
	switch queryType {
	case "metricFindQuery":
		result, err = e.executeMetricFindQuery(ctx, model, q, req.PluginContext)
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, model, q, req.PluginContext)
	case "logAction":
		result, err = e.executeLogActions(ctx, req)
	case "liveLogAction":
		result, err = e.executeLiveLogQuery(ctx, req)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, req)
	}

	return result, err
}

func (e *cloudWatchExecutor) executeLogAlertQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		model.Set("subtype", "StartQuery")
		model.Set("queryString", model.Get("expression").MustString(""))

		region := model.Get("region").MustString(defaultRegion)
		if region == defaultRegion {
			dsInfo, err := e.getDSInfo(req.PluginContext)
			if err != nil {
				return nil, err
			}
			model.Set("region", dsInfo.region)
		}

		logsClient, err := e.getCWLogsClient(region, req.PluginContext)
		if err != nil {
			return nil, err
		}

		result, err := e.executeStartQuery(ctx, logsClient, model, q.TimeRange)
		if err != nil {
			return nil, err
		}

		model.Set("queryId", *result.QueryId)

		getQueryResultsOutput, err := e.alertQuery(ctx, logsClient, q, model)
		if err != nil {
			return nil, err
		}

		dataframe, err := logsResultsToDataframes(getQueryResultsOutput)
		if err != nil {
			return nil, err
		}

		var frames []*data.Frame

		statsGroups := model.Get("statsGroups").MustStringArray()
		if len(statsGroups) > 0 && len(dataframe.Fields) > 0 {
			frames, err = groupResults(dataframe, statsGroups)
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
