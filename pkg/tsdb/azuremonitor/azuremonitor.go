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

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/resourcegraph"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func ProvideService(cfg *setting.Cfg, httpClientProvider *httpclient.Provider, features featuremgmt.FeatureToggles) *Service {
	proxy := &httpServiceProxy{}
	executors := map[string]azDatasourceExecutor{
		azureMonitor:       &metrics.AzureMonitorDatasource{Proxy: proxy, Features: features},
		azureLogAnalytics:  &loganalytics.AzureLogAnalyticsDatasource{Proxy: proxy},
		azureResourceGraph: &resourcegraph.AzureResourceGraphDatasource{Proxy: proxy},
		azureTraces:        &loganalytics.AzureLogAnalyticsDatasource{Proxy: proxy},
	}

	im := datasource.NewInstanceManager(NewInstanceSettings(cfg, httpClientProvider, executors))

	s := &Service{
		im:        im,
		executors: executors,
	}

	s.queryMux = s.newQueryMux()
	s.resourceHandler = httpadapter.New(s.newResourceMux())

	return s
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return s.queryMux.QueryData(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.resourceHandler.CallResource(ctx, req, sender)
}

type Service struct {
	im        instancemgmt.InstanceManager
	executors map[string]azDatasourceExecutor

	queryMux        *datasource.QueryTypeMux
	resourceHandler backend.CallResourceHandler
}

func getDatasourceService(settings *backend.DataSourceInstanceSettings, cfg *setting.Cfg, clientProvider *httpclient.Provider, dsInfo types.DatasourceInfo, routeName string) (types.DatasourceService, error) {
	route := dsInfo.Routes[routeName]
	client, err := newHTTPClient(route, dsInfo, settings, cfg, clientProvider)
	if err != nil {
		return types.DatasourceService{}, err
	}
	return types.DatasourceService{
		URL:        dsInfo.Routes[routeName].URL,
		HTTPClient: client,
	}, nil
}

func NewInstanceSettings(cfg *setting.Cfg, clientProvider *httpclient.Provider, executors map[string]azDatasourceExecutor) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonDataObj := map[string]any{}
		err := json.Unmarshal(settings.JSONData, &jsonDataObj)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		azSettings := types.AzureSettings{}
		err = json.Unmarshal(settings.JSONData, &azSettings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		cloud, err := getAzureCloud(cfg, &azSettings.AzureClientSettings)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		}

		routesForModel, err := getAzureRoutes(cloud, settings.JSONData)
		if err != nil {
			return nil, err
		}

		credentials, err := getAzureCredentials(cfg, &azSettings.AzureClientSettings, settings.DecryptedSecureJSONData)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		}

		model := types.DatasourceInfo{
			Cloud:                   cloud,
			Credentials:             credentials,
			Settings:                azSettings.AzureMonitorSettings,
			JSONData:                jsonDataObj,
			DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
			DatasourceID:            settings.ID,
			Routes:                  routesForModel,
			Services:                map[string]types.DatasourceService{},
		}

		for routeName := range executors {
			service, err := getDatasourceService(&settings, cfg, clientProvider, model, routeName)
			if err != nil {
				return nil, err
			}
			model.Services[routeName] = service
		}

		return model, nil
	}
}

func getCustomizedCloudSettings(cloud string, jsonData json.RawMessage) (types.AzureMonitorCustomizedCloudSettings, error) {
	customizedCloudSettings := types.AzureMonitorCustomizedCloudSettings{}
	err := json.Unmarshal(jsonData, &customizedCloudSettings)
	if err != nil {
		return types.AzureMonitorCustomizedCloudSettings{}, fmt.Errorf("error getting customized cloud settings: %w", err)
	}
	return customizedCloudSettings, nil
}

func getAzureRoutes(cloud string, jsonData json.RawMessage) (map[string]types.AzRoute, error) {
	if cloud == azsettings.AzureCustomized {
		customizedCloudSettings, err := getCustomizedCloudSettings(cloud, jsonData)
		if err != nil {
			return nil, err
		}
		if customizedCloudSettings.CustomizedRoutes == nil {
			return nil, fmt.Errorf("unable to instantiate routes, customizedRoutes must be set")
		}
		azureRoutes := customizedCloudSettings.CustomizedRoutes
		return azureRoutes, nil
	} else {
		return routes[cloud], nil
	}
}

type azDatasourceExecutor interface {
	ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string) (*backend.QueryDataResponse, error)
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
			return executor.ExecuteTimeSeriesQuery(ctx, req.Queries, dsInfo, service.HTTPClient, service.URL)
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

func queryMetricHealth(dsInfo types.DatasourceInfo) (*http.Response, error) {
	subscriptionsApiVersion := "2020-01-01"
	url := fmt.Sprintf("%v/subscriptions?api-version=%v", dsInfo.Routes["Azure Monitor"].URL, subscriptionsApiVersion)
	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	res, err := dsInfo.Services["Azure Monitor"].HTTPClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", types.ErrorAzureHealthCheck, err)
	}

	return res, nil
}

func checkAzureLogAnalyticsHealth(dsInfo types.DatasourceInfo, subscription string) (*http.Response, error) {
	workspacesUrl := fmt.Sprintf("%v/subscriptions/%v/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview", dsInfo.Routes["Azure Monitor"].URL, subscription)
	workspacesReq, err := http.NewRequest(http.MethodGet, workspacesUrl, nil)
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
	workspaceReq, err := http.NewRequest(http.MethodPost, workspaceUrl, bytes.NewBuffer(body))
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

func checkAzureMonitorResourceGraphHealth(dsInfo types.DatasourceInfo, subscription string) (*http.Response, error) {
	body, err := json.Marshal(map[string]any{
		"query":         "Resources | project id | limit 1",
		"subscriptions": []string{subscription},
	})
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%v/providers/Microsoft.ResourceGraph/resources?api-version=%v", dsInfo.Routes["Azure Resource Graph"].URL, resourcegraph.ArgAPIVersion)
	request, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
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

func metricCheckHealth(dsInfo types.DatasourceInfo) (message string, defaultSubscription string, status backend.HealthStatus) {
	defaultSubscription = dsInfo.Settings.SubscriptionId
	metricsRes, err := queryMetricHealth(dsInfo)
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
	subscriptions, err := parseSubscriptions(metricsRes)
	if err != nil {
		return err.Error(), defaultSubscription, backend.HealthStatusError
	}
	if defaultSubscription == "" && len(subscriptions) > 0 {
		defaultSubscription = subscriptions[0]
	}

	return "Successfully connected to Azure Monitor endpoint.", defaultSubscription, backend.HealthStatusOk
}

func logAnalyticsCheckHealth(dsInfo types.DatasourceInfo, defaultSubscription string) (message string, status backend.HealthStatus) {
	logsRes, err := checkAzureLogAnalyticsHealth(dsInfo, defaultSubscription)
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

func graphLogHealthCheck(dsInfo types.DatasourceInfo, defaultSubscription string) (message string, status backend.HealthStatus) {
	resourceGraphRes, err := checkAzureMonitorResourceGraphHealth(dsInfo, defaultSubscription)
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

func parseSubscriptions(res *http.Response) ([]string, error) {
	var target struct {
		Value []struct {
			SubscriptionId string `json:"subscriptionId"`
		}
	}
	err := json.NewDecoder(res.Body).Decode(&target)
	if err != nil {
		return nil, err
	}
	defer func() {
		err := res.Body.Close()
		backend.Logger.Error("Failed to close response body", "err", err)
	}()

	result := make([]string, len(target.Value))
	for i, v := range target.Value {
		result[i] = v.SubscriptionId
	}

	return result, nil
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	status := backend.HealthStatusOk

	metricsLog, defaultSubscription, metricsStatus := metricCheckHealth(dsInfo)
	if metricsStatus != backend.HealthStatusOk {
		status = metricsStatus
	}

	logAnalyticsLog, logAnalyticsStatus := logAnalyticsCheckHealth(dsInfo, defaultSubscription)
	if logAnalyticsStatus != backend.HealthStatusOk {
		status = logAnalyticsStatus
	}

	graphLog, graphStatus := graphLogHealthCheck(dsInfo, defaultSubscription)
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
