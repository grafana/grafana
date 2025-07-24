package cloudwatch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/clients"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func (ds *DataSource) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/ebs-volume-ids", ds.handleResourceReq(ds.handleGetEbsVolumeIds))
	mux.HandleFunc("/ec2-instance-attribute", ds.handleResourceReq(ds.handleGetEc2InstanceAttribute))
	mux.HandleFunc("/resource-arns", ds.handleResourceReq(ds.handleGetResourceArns))
	mux.HandleFunc("/log-groups", ds.resourceRequestMiddleware(ds.LogGroupsHandler))
	mux.HandleFunc("/metrics", ds.resourceRequestMiddleware(ds.MetricsHandler))
	mux.HandleFunc("/dimension-values", ds.resourceRequestMiddleware(ds.DimensionValuesHandler))
	mux.HandleFunc("/dimension-keys", ds.resourceRequestMiddleware(ds.DimensionKeysHandler))
	mux.HandleFunc("/accounts", ds.resourceRequestMiddleware(ds.AccountsHandler))
	mux.HandleFunc("/namespaces", ds.resourceRequestMiddleware(ds.NamespacesHandler))
	mux.HandleFunc("/log-group-fields", ds.resourceRequestMiddleware(ds.LogGroupFieldsHandler))
	mux.HandleFunc("/external-id", ds.resourceRequestMiddleware(ds.ExternalIdHandler))
	mux.HandleFunc("/regions", ds.resourceRequestMiddleware(ds.RegionsHandler))
	// remove this once AWS's Cross Account Observability is supported in GovCloud
	mux.HandleFunc("/legacy-log-groups", ds.handleResourceReq(ds.handleGetLogGroups))

	return mux
}

type handleFn func(ctx context.Context, parameters url.Values) ([]suggestData, error)

// TODO: merge this and resourceRequestMiddleware
func (ds *DataSource) handleResourceReq(handleFunc handleFn) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		logger := ds.logger.FromContext(ctx)
		err := req.ParseForm()
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err), logger)
			return
		}
		data, err := handleFunc(ctx, req.URL.Query())
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err), logger)
			return
		}
		body, err := json.Marshal(data)
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err), logger)
			return
		}
		rw.WriteHeader(http.StatusOK)
		_, err = rw.Write(body)
		if err != nil {
			ds.logger.Error("Unable to write HTTP response", "error", err)
			return
		}
	}
}

func writeResponse(rw http.ResponseWriter, code int, msg string, logger log.Logger) {
	rw.WriteHeader(code)
	_, err := rw.Write([]byte(msg))
	if err != nil {
		logger.Error("Unable to write HTTP response", "error", err)
	}
}

func (ds *DataSource) LogGroupsHandler(ctx context.Context, parameters url.Values) ([]byte, *models.HttpError) {
	request, err := resources.ParseLogGroupsRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("cannot set both log group name prefix and pattern", http.StatusBadRequest, err)
	}

	service, err := ds.GetLogGroupsService(ctx, request.Region)
	if err != nil {
		return nil, models.NewHttpError("GetLogGroupsService error", http.StatusInternalServerError, err)
	}

	logGroups, err := service.GetLogGroups(ctx, request)
	if err != nil {
		return nil, models.NewHttpError("GetLogGroups error", http.StatusInternalServerError, err)
	}

	logGroupsResponse, err := json.Marshal(logGroups)
	if err != nil {
		return nil, models.NewHttpError("LogGroupsHandler json error", http.StatusInternalServerError, err)
	}

	return logGroupsResponse, nil
}
func (ds *DataSource) MetricsHandler(ctx context.Context, parameters url.Values) ([]byte, *models.HttpError) {
	metricsRequest, err := resources.GetMetricsRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in MetricsHandler", http.StatusBadRequest, err)
	}

	service, err := ds.GetListMetricsService(ctx, metricsRequest.Region)
	if err != nil {
		return nil, models.NewHttpError("error in MetricsHandler", http.StatusInternalServerError, err)
	}

	var response []resources.ResourceResponse[resources.Metric]
	switch metricsRequest.Type() {
	case resources.AllMetricsRequestType:
		response = services.GetAllHardCodedMetrics()
	case resources.MetricsByNamespaceRequestType:
		response, err = services.GetHardCodedMetricsByNamespace(metricsRequest.Namespace)
	case resources.CustomNamespaceRequestType:
		response, err = service.GetMetricsByNamespace(ctx, metricsRequest)
	}
	if err != nil {
		return nil, models.NewHttpError("error in MetricsHandler", http.StatusInternalServerError, err)
	}

	metricsResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in MetricsHandler", http.StatusInternalServerError, err)
	}

	return metricsResponse, nil
}

func (ds *DataSource) DimensionValuesHandler(ctx context.Context, parameters url.Values) ([]byte, *models.HttpError) {
	dimensionValuesRequest, err := resources.GetDimensionValuesRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusBadRequest, err)
	}

	service, err := ds.GetListMetricsService(ctx, dimensionValuesRequest.Region)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	response, err := service.GetDimensionValuesByDimensionFilter(ctx, dimensionValuesRequest)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	dimensionValuesResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	return dimensionValuesResponse, nil
}

func (ds *DataSource) DimensionKeysHandler(ctx context.Context, parameters url.Values) ([]byte, *models.HttpError) {
	dimensionKeysRequest, err := resources.GetDimensionKeysRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusBadRequest, err)
	}

	service, err := ds.GetListMetricsService(ctx, dimensionKeysRequest.Region)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	var response []resources.ResourceResponse[string]
	switch dimensionKeysRequest.Type() {
	case resources.FilterDimensionKeysRequest:
		response, err = service.GetDimensionKeysByDimensionFilter(ctx, dimensionKeysRequest)
	default:
		response, err = services.GetHardCodedDimensionKeysByNamespace(dimensionKeysRequest.Namespace)
	}
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	jsonResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	return jsonResponse, nil
}

func (ds *DataSource) AccountsHandler(ctx context.Context, parameters url.Values) ([]byte, *models.HttpError) {
	region := parameters.Get("region")
	if region == "" {
		return nil, models.NewHttpError("error in AccountsHandler", http.StatusBadRequest, fmt.Errorf("region is required"))
	}

	service, err := ds.GetAccountsService(ctx, region)
	if err != nil {
		return nil, models.NewHttpError("error in AccountsHandler", http.StatusInternalServerError, err)
	}

	accounts, err := service.GetAccountsForCurrentUserOrRole(ctx)
	if err != nil {
		msg := "error getting accounts for current user or role"
		switch {
		case errors.Is(err, services.ErrAccessDeniedException):
			return nil, models.NewHttpError(msg, http.StatusForbidden, err)
		default:
			return nil, models.NewHttpError(msg, http.StatusInternalServerError, err)
		}
	}

	accountsResponse, err := json.Marshal(accounts)
	if err != nil {
		return nil, models.NewHttpError("error in AccountsHandler", http.StatusInternalServerError, err)
	}

	return accountsResponse, nil
}

func (ds *DataSource) NamespacesHandler(_ context.Context, _ url.Values) ([]byte, *models.HttpError) {
	response := services.GetHardCodedNamespaces()
	customNamespace := ds.Settings.Namespace
	if customNamespace != "" {
		customNamespaces := strings.Split(customNamespace, ",")
		for _, customNamespace := range customNamespaces {
			response = append(response, resources.ResourceResponse[string]{Value: customNamespace})
		}
	}
	sort.Slice(response, func(i, j int) bool {
		return response[i].Value < response[j].Value
	})

	namespacesResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in NamespacesHandler", http.StatusInternalServerError, err)
	}

	return namespacesResponse, nil
}

func (ds *DataSource) LogGroupFieldsHandler(ctx context.Context, parameters url.Values) ([]byte, *models.HttpError) {
	request, err := resources.ParseLogGroupFieldsRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in LogGroupFieldsHandler", http.StatusBadRequest, err)
	}

	service, err := ds.GetLogGroupsService(ctx, request.Region)
	if err != nil {
		return nil, models.NewHttpError("newLogGroupsService error", http.StatusInternalServerError, err)
	}

	logGroupFields, err := service.GetLogGroupFields(ctx, request)
	if err != nil {
		return nil, models.NewHttpError("GetLogGroupFields error", http.StatusInternalServerError, err)
	}

	logGroupsResponse, err := json.Marshal(logGroupFields)
	if err != nil {
		return nil, models.NewHttpError("LogGroupFieldsHandler json error", http.StatusInternalServerError, err)
	}

	return logGroupsResponse, nil
}

func (ds *DataSource) ExternalIdHandler(_ context.Context, _ url.Values) ([]byte, *models.HttpError) {
	response := map[string]string{
		"externalId": ds.Settings.GrafanaSettings.ExternalID,
	}
	jsonResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in ExternalIdHandler", http.StatusInternalServerError, err)
	}

	return jsonResponse, nil
}

func (ds *DataSource) RegionsHandler(ctx context.Context, _ url.Values) ([]byte, *models.HttpError) {
	service, err := ds.GetRegionsService(ctx, defaultRegion)
	if err != nil {
		if errors.Is(err, models.ErrMissingRegion) {
			return nil, models.NewHttpError("Error in Regions Handler when connecting to aws without a default region selection", http.StatusBadRequest, err)
		}
		return nil, models.NewHttpError("Error in Regions Handler when connecting to aws", http.StatusInternalServerError, err)
	}

	regions, err := service.GetRegions(ctx)
	if err != nil {
		return nil, models.NewHttpError("Error in Regions Handler while fetching regions", http.StatusInternalServerError, err)
	}

	regionsResponse, err := json.Marshal(regions)
	if err != nil {
		return nil, models.NewHttpError("Error in Regions Handler while parsing regions", http.StatusInternalServerError, err)
	}

	return regionsResponse, nil
}

func (ds *DataSource) GetLogGroupsService(ctx context.Context, region string) (models.LogGroupsProvider, error) {
	awsConfig, err := ds.newAWSConfig(ctx, region)
	if err != nil {
		return nil, err
	}
	return services.NewLogGroupsService(NewLogsAPI(awsConfig), features.IsEnabled(ctx, features.FlagCloudWatchCrossAccountQuerying)), nil
}

func (ds *DataSource) GetListMetricsService(ctx context.Context, region string) (models.ListMetricsProvider, error) {
	awsConfig, err := ds.newAWSConfig(ctx, region)
	if err != nil {
		return nil, err
	}
	return services.NewListMetricsService(clients.NewMetricsClient(NewCWClient(awsConfig), ds.Settings.GrafanaSettings.ListMetricsPageLimit)), nil
}

func (ds *DataSource) GetAccountsService(ctx context.Context, region string) (models.AccountsProvider, error) {
	awsCfg, err := ds.newAWSConfig(ctx, region)
	if err != nil {
		return nil, err
	}
	return services.NewAccountsService(NewOAMAPI(awsCfg)), nil
}

func (ds *DataSource) GetRegionsService(ctx context.Context, region string) (models.RegionsAPIProvider, error) {
	awsCfg, err := ds.newAWSConfig(ctx, region)
	if err != nil {
		return nil, err
	}
	return services.NewRegionsService(NewEC2API(awsCfg), ds.logger), nil
}

// TODO: merge this and handleResourceReq
func (ds *DataSource) resourceRequestMiddleware(handleFunc models.RouteHandlerFunc) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		if req.Method != "GET" {
			respondWithError(rw, models.NewHttpError("Invalid method", http.StatusMethodNotAllowed, nil))
			return
		}

		ctx := req.Context()
		jsonResponse, httpError := handleFunc(ctx, req.URL.Query())
		if httpError != nil {
			ds.logger.FromContext(ctx).Error("Error handling resource request", "error", httpError.Message)
			respondWithError(rw, httpError)
			return
		}

		rw.Header().Set("Content-Type", "application/json")
		_, err := rw.Write(jsonResponse)
		if err != nil {
			ds.logger.FromContext(ctx).Error("Error handling resource request", "error", err)
			respondWithError(rw, models.NewHttpError("error writing response in resource request middleware", http.StatusInternalServerError, err))
		}
	}
}

func respondWithError(rw http.ResponseWriter, httpError *models.HttpError) {
	response, err := json.Marshal(httpError)
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}
	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(httpError.StatusCode)
	_, err = rw.Write(response)
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
	}
}
