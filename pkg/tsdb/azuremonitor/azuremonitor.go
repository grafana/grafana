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

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/resourcegraph"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

var logger = log.New("tsdb.azuremonitor")

func ProvideService(cfg *setting.Cfg, httpClientProvider *httpclient.Provider, tracer tracing.Tracer) *Service {
	proxy := &httpServiceProxy{}
	executors := map[string]azDatasourceExecutor{
		azureMonitor:       &metrics.AzureMonitorDatasource{Proxy: proxy},
		azureLogAnalytics:  &loganalytics.AzureLogAnalyticsDatasource{Proxy: proxy},
		azureResourceGraph: &resourcegraph.AzureResourceGraphDatasource{Proxy: proxy},
	}

	im := datasource.NewInstanceManager(NewInstanceSettings(cfg, httpClientProvider, executors))

	s := &Service{
		im:        im,
		executors: executors,
		tracer:    tracer,
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
	tracer          tracing.Tracer
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
		jsonData, err := simplejson.NewJson(settings.JSONData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		jsonDataObj := map[string]interface{}{}
		err = json.Unmarshal(settings.JSONData, &jsonDataObj)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		azMonitorSettings := types.AzureMonitorSettings{}
		err = json.Unmarshal(settings.JSONData, &azMonitorSettings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		cloud, err := getAzureCloud(cfg, jsonData)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		}

		routesForModel, err := getAzureRoutes(cloud, settings.JSONData)
		if err != nil {
			return nil, err
		}

		credentials, err := getAzureCredentials(cfg, jsonData, settings.DecryptedSecureJSONData)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		}

		model := types.DatasourceInfo{
			Cloud:                   cloud,
			Credentials:             credentials,
			Settings:                azMonitorSettings,
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
	ExecuteTimeSeriesQuery(ctx context.Context, logger log.Logger, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error)
	ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client)
}

func (s *Service) getDataSourceFromPluginReq(req *backend.QueryDataRequest) (types.DatasourceInfo, error) {
	i, err := s.im.Get(req.PluginContext)
	if err != nil {
		return types.DatasourceInfo{}, err
	}
	dsInfo, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("unable to convert datasource from service instance")
	}
	dsInfo.OrgID = req.PluginContext.OrgID
	return dsInfo, nil
}

func (s *Service) newQueryMux() *datasource.QueryTypeMux {
	mux := datasource.NewQueryTypeMux()
	for dsType := range s.executors {
		// Make a copy of the string to keep the reference after the iterator
		dst := dsType
		mux.HandleFunc(dsType, func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			executor := s.executors[dst]
			dsInfo, err := s.getDataSourceFromPluginReq(req)
			if err != nil {
				return nil, err
			}
			service, ok := dsInfo.Services[dst]
			if !ok {
				return nil, fmt.Errorf("missing service for %s", dst)
			}
			return executor.ExecuteTimeSeriesQuery(ctx, logger, req.Queries, dsInfo, service.HTTPClient, service.URL, s.tracer)
		})
	}
	return mux
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (types.DatasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return types.DatasourceInfo{}, err
	}

	instance, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}

func checkAzureMonitorMetricsHealth(dsInfo types.DatasourceInfo) (*http.Response, error) {
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

	body, err := json.Marshal(map[string]interface{}{
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
	body, err := json.Marshal(map[string]interface{}{
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
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	status := backend.HealthStatusOk
	metricsLog := "Successfully connected to Azure Monitor endpoint."
	logAnalyticsLog := "Successfully connected to Azure Log Analytics endpoint."
	graphLog := "Successfully connected to Azure Resource Graph endpoint."
	defaultSubscription := dsInfo.Settings.SubscriptionId

	metricsRes, err := checkAzureMonitorMetricsHealth(dsInfo)
	if err != nil || metricsRes.StatusCode != 200 {
		status = backend.HealthStatusError
		if err != nil {
			if ok := errors.Is(err, types.ErrorAzureHealthCheck); ok {
				metricsLog = fmt.Sprintf("Error connecting to Azure Monitor endpoint: %s", err.Error())
			} else {
				return nil, err
			}
		} else {
			body, err := io.ReadAll(metricsRes.Body)
			if err != nil {
				return nil, err
			}
			metricsLog = fmt.Sprintf("Error connecting to Azure Monitor endpoint: %s", string(body))
		}
	} else {
		subscriptions, err := parseSubscriptions(metricsRes)
		if err != nil {
			return nil, err
		}
		if defaultSubscription == "" && len(subscriptions) > 0 {
			defaultSubscription = subscriptions[0]
		}
	}

	logsRes, err := checkAzureLogAnalyticsHealth(dsInfo, defaultSubscription)
	if err != nil || logsRes.StatusCode != 200 {
		status = backend.HealthStatusError
		if err != nil {
			if err.Error() == "no default workspace found" {
				status = backend.HealthStatusUnknown
				logAnalyticsLog = "No Log Analytics workspaces found."
			} else if ok := errors.Is(err, types.ErrorAzureHealthCheck); ok {
				logAnalyticsLog = fmt.Sprintf("Error connecting to Azure Log Analytics endpoint: %s", err.Error())
			} else {
				return nil, err
			}
		} else {
			body, err := io.ReadAll(logsRes.Body)
			if err != nil {
				return nil, err
			}
			logAnalyticsLog = fmt.Sprintf("Error connecting to Azure Log Analytics endpoint: %s", string(body))
		}
	}

	resourceGraphRes, err := checkAzureMonitorResourceGraphHealth(dsInfo, defaultSubscription)
	if err != nil || resourceGraphRes.StatusCode != 200 {
		status = backend.HealthStatusError
		if err != nil {
			if ok := errors.Is(err, types.ErrorAzureHealthCheck); ok {
				graphLog = fmt.Sprintf("Error connecting to Azure Resource Graph endpoint: %s", err.Error())
			} else {
				return nil, err
			}
		} else {
			body, err := io.ReadAll(resourceGraphRes.Body)
			if err != nil {
				return nil, err
			}
			graphLog = fmt.Sprintf("Error connecting to Azure Resource Graph endpoint: %s", string(body))
		}
	}

	defer func() {
		if metricsRes != nil {
			if err := metricsRes.Body.Close(); err != nil {
				backend.Logger.Error("Failed to close response body", "err", err)
			}
		}
		if logsRes != nil {
			if err := logsRes.Body.Close(); logsRes != nil && err != nil {
				backend.Logger.Error("Failed to close response body", "err", err)
			}
		}
		if resourceGraphRes != nil {
			if err := resourceGraphRes.Body.Close(); resourceGraphRes != nil && err != nil {
				backend.Logger.Error("Failed to close response body", "err", err)
			}
		}
	}()

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
