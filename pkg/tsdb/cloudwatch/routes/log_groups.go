package routes

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func LogGroupsHandler(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	request, err := resources.ParseLogGroupsRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("cannot set both log group name prefix and pattern", http.StatusBadRequest, err)
	}

	service, err := newLogGroupsService(pluginCtx, reqCtxFactory, request.Region)
	if err != nil {
		return nil, models.NewHttpError("newLogGroupsService error", http.StatusInternalServerError, err)
	}

	logGroups, err := service.GetLogGroups(request)
	if err != nil {
		return nil, models.NewHttpError("GetLogGroups error", http.StatusInternalServerError, err)
	}

	logGroupsResponse, err := json.Marshal(logGroups)
	if err != nil {
		return nil, models.NewHttpError("LogGroupsHandler json error", http.StatusInternalServerError, err)
	}

	return logGroupsResponse, nil
}

// newLogGroupsService is a describe log groups service factory.
//
// Stubbable by tests.
var newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
	reqCtx, err := reqCtxFactory(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewLogGroupsService(reqCtx.LogsAPIProvider, reqCtx.Features.IsEnabled(featuremgmt.FlagCloudWatchCrossAccountQuerying)), nil
}
