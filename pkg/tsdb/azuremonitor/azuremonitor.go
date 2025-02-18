package azuremonitor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-azure-sdk-go/v2/azusercontext"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azmoncredentials"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/resourcegraph"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/utils"
)

func ProvideService(httpClientProvider *httpclient.Provider) *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.azuremonitor")
	proxy := &httpServiceProxy{
		logger: logger,
	}
	executors := map[string]azDatasourceExecutor{
		azureMonitor:       &metrics.AzureMonitorDatasource{Proxy: proxy, Logger: logger},
		azureLogAnalytics:  &loganalytics.AzureLogAnalyticsDatasource{Proxy: proxy, Logger: logger},
		azureResourceGraph: &resourcegraph.AzureResourceGraphDatasource{Proxy: proxy, Logger: logger},
		azureTraces:        &loganalytics.AzureLogAnalyticsDatasource{Proxy: proxy, Logger: logger},
		traceExemplar:      &loganalytics.AzureLogAnalyticsDatasource{Proxy: proxy, Logger: logger},
	}

	im := datasource.NewInstanceManager(NewInstanceSettings(httpClientProvider, executors, logger))

	s := &Service{
		im:        im,
		executors: executors,
		logger:    logger,
	}

	s.queryMux = s.newQueryMux()
	s.resourceHandler = httpadapter.New(s.newResourceMux())

	return s
}

func handleDeprecatedQueryTypes(req *backend.QueryDataRequest) *backend.QueryDataResponse {
	// Logic to handle deprecated query types that haven't been migrated
	responses := backend.Responses{}
	for _, q := range req.Queries {
		if q.QueryType == "Application Insights" || q.QueryType == "Insights Analytics" {
			responses[q.RefID] = backend.DataResponse{
				Error:       fmt.Errorf("query type: '%s' is no longer supported. Please migrate this query (see https://grafana.com/docs/grafana/v9.0/datasources/azuremonitor/deprecated-application-insights/ for details)", q.QueryType),
				ErrorSource: backend.ErrorSourceDownstream,
			}
		}
	}

	return &backend.QueryDataResponse{
		Responses: responses,
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	responses := handleDeprecatedQueryTypes(req)

	if len(responses.Responses) > 0 {
		return responses, nil
	}

	return s.queryMux.QueryData(azusercontext.WithUserFromQueryReq(ctx, req), req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.resourceHandler.CallResource(azusercontext.WithUserFromResourceReq(ctx, req), req, sender)
}

type Service struct {
	im        instancemgmt.InstanceManager
	executors map[string]azDatasourceExecutor

	queryMux        *datasource.QueryTypeMux
	resourceHandler backend.CallResourceHandler
	logger          log.Logger
}

func getDatasourceService(ctx context.Context, settings *backend.DataSourceInstanceSettings, azureSettings *azsettings.AzureSettings, clientProvider *httpclient.Provider, dsInfo types.DatasourceInfo, routeName string, logger log.Logger) (types.DatasourceService, error) {
	route := dsInfo.Routes[routeName]
	client, err := newHTTPClient(ctx, route, dsInfo, settings, azureSettings, clientProvider)
	if err != nil {
		return types.DatasourceService{}, err
	}
	return types.DatasourceService{
		URL:        dsInfo.Routes[routeName].URL,
		HTTPClient: client,
		Logger:     logger,
	}, nil
}

func NewInstanceSettings(clientProvider *httpclient.Provider, executors map[string]azDatasourceExecutor, logger log.Logger) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := map[string]any{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		azMonitorSettings := types.AzureMonitorSettings{}
		err = json.Unmarshal(settings.JSONData, &azMonitorSettings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		azureSettings, err := azsettings.ReadSettings(ctx)
		if err != nil {
			logger.Error("failed to read Azure settings from Grafana", "error", err.Error())
			return nil, err
		}

		credentials, err := azmoncredentials.FromDatasourceData(jsonData, settings.DecryptedSecureJSONData)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		} else if credentials == nil {
			credentials = azmoncredentials.GetDefaultCredentials(azureSettings)
		}

		routesForModel, err := getAzureMonitorRoutes(azureSettings, credentials, settings.JSONData)
		if err != nil {
			return nil, err
		}

		if credentials.AzureAuthType() == azcredentials.AzureAuthCurrentUserIdentity && !backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled("azureMonitorEnableUserAuth") {
			return nil, backend.DownstreamError(errors.New("current user authentication is not enabled for azure monitor"))
		}

		model := types.DatasourceInfo{
			Credentials:             credentials,
			Settings:                azMonitorSettings,
			JSONData:                jsonData,
			DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
			DatasourceID:            settings.ID,
			Routes:                  routesForModel,
			Services:                map[string]types.DatasourceService{},
		}

		for routeName := range executors {
			service, err := getDatasourceService(ctx, &settings, azureSettings, clientProvider, model, routeName, logger)
			if err != nil {
				return nil, err
			}
			model.Services[routeName] = service
		}

		return model, nil
	}
}

type azDatasourceExecutor interface {
	ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, fromAlert bool) (*backend.QueryDataResponse, error)
	ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) (http.ResponseWriter, error)
}

func (s *Service) getDataSourceFromPluginReq(ctx context.Context, req *backend.QueryDataRequest) (types.DatasourceInfo, error) {
	i, err := s.im.Get(ctx, req.PluginContext)
	if err != nil {
		return types.DatasourceInfo{}, err
	}
	dsInfo, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("unable to convert datasource from service instance")
	}
	dsInfo.OrgID = req.PluginContext.OrgID

	dsInfo.DatasourceName = req.PluginContext.DataSourceInstanceSettings.Name
	dsInfo.DatasourceUID = req.PluginContext.DataSourceInstanceSettings.UID
	return dsInfo, nil
}

func (s *Service) newQueryMux() *datasource.QueryTypeMux {
	mux := datasource.NewQueryTypeMux()
	for dsType := range s.executors {
		// Make a copy of the string to keep the reference after the iterator
		dst := dsType
		mux.HandleFunc(dsType, func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			executor := s.executors[dst]
			dsInfo, err := s.getDataSourceFromPluginReq(ctx, req)
			if err != nil {
				return nil, err
			}
			service, ok := dsInfo.Services[dst]
			if !ok {
				return nil, fmt.Errorf("missing service for %s", dst)
			}
			// FromAlert header is defined in pkg/services/ngalert/models/constants.go
			fromAlert := req.Headers["FromAlert"] == "true"
			return executor.ExecuteTimeSeriesQuery(ctx, req.Queries, dsInfo, service.HTTPClient, service.URL, fromAlert)
		})
	}
	return mux
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (types.DatasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return types.DatasourceInfo{}, err
	}

	instance, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}

func queryMetricHealth(ctx context.Context, dsInfo types.DatasourceInfo) (*http.Response, error) {
	url := fmt.Sprintf("%v/subscriptions?api-version=%v", dsInfo.Routes["Azure Monitor"].URL, utils.SubscriptionsApiVersion)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	res, err := dsInfo.Services["Azure Monitor"].HTTPClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", types.ErrorAzureHealthCheck, err)
	}

	return res, nil
}

func checkAzureLogAnalyticsHealth(ctx context.Context, dsInfo types.DatasourceInfo, subscription string) (*http.Response, error) {
	workspacesUrl := fmt.Sprintf("%v/subscriptions/%v/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview", dsInfo.Routes["Azure Monitor"].URL, subscription)
	workspacesReq, err := http.NewRequestWithContext(ctx, http.MethodGet, workspacesUrl, nil)
	if err != nil {
		return nil, err
	}
	res, err := dsInfo.Services["Azure Monitor"].HTTPClient.Do(workspacesReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", types.ErrorAzureHealthCheck, err)
	}
	var target struct {
		Value []types.LogAnalyticsWorkspaceResponse
	}
	err = json.NewDecoder(res.Body).Decode(&target)
	if err != nil {
		return nil, err
	}

	if len(target.Value) == 0 {
		return nil, errors.New("no default workspace found")
	}
	defaultWorkspaceId := target.Value[0].Properties.CustomerId

	body, err := json.Marshal(map[string]any{
		"query": "AzureActivity | limit 1",
	})
	if err != nil {
		return nil, err
	}

	workspaceUrl := fmt.Sprintf("%v/v1/workspaces/%v/query", dsInfo.Routes["Azure Log Analytics"].URL, defaultWorkspaceId)
	workspaceReq, err := http.NewRequestWithContext(ctx, http.MethodPost, workspaceUrl, bytes.NewBuffer(body))
	workspaceReq.Header.Set("Content-Type", "application/json")
	if err != nil {
		return nil, err
	}

	res, err = dsInfo.Services["Azure Log Analytics"].HTTPClient.Do(workspaceReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", types.ErrorAzureHealthCheck, err)
	}

	return res, nil
}

func checkAzureMonitorResourceGraphHealth(ctx context.Context, dsInfo types.DatasourceInfo, subscription string) (*http.Response, error) {
	body, err := json.Marshal(map[string]any{
		"query":         "Resources | project id | limit 1",
		"subscriptions": []string{subscription},
	})
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%v/providers/Microsoft.ResourceGraph/resources?api-version=%v", dsInfo.Routes["Azure Resource Graph"].URL, resourcegraph.ArgAPIVersion)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	request.Header.Set("Content-Type", "application/json")
	if err != nil {
		return nil, err
	}

	res, err := dsInfo.Services["Azure Resource Graph"].HTTPClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", types.ErrorAzureHealthCheck, err)
	}

	return res, nil
}

func metricCheckHealth(ctx context.Context, dsInfo types.DatasourceInfo, logger log.Logger) (message string, defaultSubscription string, status backend.HealthStatus) {
	defaultSubscription = dsInfo.Settings.SubscriptionId
	metricsRes, err := queryMetricHealth(ctx, dsInfo)
	if err != nil {
		if ok := errors.Is(err, types.ErrorAzureHealthCheck); ok {
			return fmt.Sprintf("Error connecting to Azure Monitor endpoint: %s", err.Error()), defaultSubscription, backend.HealthStatusError
		}
		return err.Error(), defaultSubscription, backend.HealthStatusError
	}
	defer func() {
		err := metricsRes.Body.Close()
		if err != nil {
			message += err.Error()
			status = backend.HealthStatusError
		}
	}()
	if metricsRes.StatusCode != 200 {
		body, err := io.ReadAll(metricsRes.Body)
		if err != nil {
			return err.Error(), defaultSubscription, backend.HealthStatusError
		}
		return fmt.Sprintf("Error connecting to Azure Monitor endpoint: %s", string(body)), defaultSubscription, backend.HealthStatusError
	}
	subscriptions, err := utils.ParseSubscriptions(metricsRes, logger)
	if err != nil {
		return err.Error(), defaultSubscription, backend.HealthStatusError
	}
	if defaultSubscription == "" && len(subscriptions) > 0 {
		defaultSubscription = subscriptions[0]
	}

	return "Successfully connected to Azure Monitor endpoint.", defaultSubscription, backend.HealthStatusOk
}

func logAnalyticsCheckHealth(ctx context.Context, dsInfo types.DatasourceInfo, defaultSubscription string) (message string, status backend.HealthStatus) {
	logsRes, err := checkAzureLogAnalyticsHealth(ctx, dsInfo, defaultSubscription)
	if err != nil {
		if err.Error() == "no default workspace found" {
			return "No Log Analytics workspaces found.", backend.HealthStatusUnknown
		}
		if ok := errors.Is(err, types.ErrorAzureHealthCheck); ok {
			return fmt.Sprintf("Error connecting to Azure Log Analytics endpoint: %s", err.Error()), backend.HealthStatusUnknown
		}
		return err.Error(), backend.HealthStatusError
	}
	defer func() {
		err := logsRes.Body.Close()
		if err != nil {
			message += err.Error()
			status = backend.HealthStatusError
		}
	}()
	if logsRes.StatusCode != 200 {
		body, err := io.ReadAll(logsRes.Body)
		if err != nil {
			return err.Error(), backend.HealthStatusError
		}
		return fmt.Sprintf("Error connecting to Azure Log Analytics endpoint: %s", string(body)), backend.HealthStatusError
	}
	return "Successfully connected to Azure Log Analytics endpoint.", backend.HealthStatusOk
}

func graphLogHealthCheck(ctx context.Context, dsInfo types.DatasourceInfo, defaultSubscription string) (message string, status backend.HealthStatus) {
	resourceGraphRes, err := checkAzureMonitorResourceGraphHealth(ctx, dsInfo, defaultSubscription)
	if err != nil {
		if ok := errors.Is(err, types.ErrorAzureHealthCheck); ok {
			return fmt.Sprintf("Error connecting to Azure Resource Graph endpoint: %s", err.Error()), backend.HealthStatusError
		}
		return err.Error(), backend.HealthStatusError
	}
	defer func() {
		err := resourceGraphRes.Body.Close()
		if err != nil {
			message += err.Error()
			status = backend.HealthStatusError
		}
	}()
	if resourceGraphRes.StatusCode != 200 {
		body, err := io.ReadAll(resourceGraphRes.Body)
		if err != nil {
			return err.Error(), backend.HealthStatusError
		}
		return fmt.Sprintf("Error connecting to Azure Resource Graph endpoint: %s", string(body)), backend.HealthStatusError
	}
	return "Successfully connected to Azure Resource Graph endpoint.", backend.HealthStatusOk
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx = azusercontext.WithUserFromHealthCheckReq(ctx, req)
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	status := backend.HealthStatusOk

	metricsLog, defaultSubscription, metricsStatus := metricCheckHealth(ctx, dsInfo, s.logger)
	if metricsStatus != backend.HealthStatusOk {
		status = metricsStatus
	}

	logAnalyticsLog, logAnalyticsStatus := logAnalyticsCheckHealth(ctx, dsInfo, defaultSubscription)
	if logAnalyticsStatus != backend.HealthStatusOk {
		status = logAnalyticsStatus
	}

	graphLog, graphStatus := graphLogHealthCheck(ctx, dsInfo, defaultSubscription)
	if graphStatus != backend.HealthStatusOk {
		status = graphStatus
	}

	if status == backend.HealthStatusOk {
		return &backend.CheckHealthResult{
			Status:  status,
			Message: "Successfully connected to all Azure Monitor endpoints.",
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  status,
		Message: "One or more health checks failed. See details below.",
		JSONDetails: []byte(
			fmt.Sprintf(`{"verboseMessage": %s }`, strconv.Quote(fmt.Sprintf("1. %s\n2. %s\n3. %s", metricsLog, logAnalyticsLog, graphLog))),
		),
	}, nil
}
