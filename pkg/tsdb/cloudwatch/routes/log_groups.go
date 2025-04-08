package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func LogGroupsHandler(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	request, err := resources.ParseLogGroupsRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("cannot set both log group name prefix and pattern", http.StatusBadRequest, err)
	}

	service, err := newLogGroupsService(ctx, pluginCtx, reqCtxFactory, request.Region)
	if err != nil {
		return nil, models.NewHttpError("newLogGroupsService error", http.StatusInternalServerError, err)
	}

	logGroups, err := service.GetLogGroupsWithContext(ctx, request)
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
var newLogGroupsService = func(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
	reqCtx, err := reqCtxFactory(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewLogGroupsService(reqCtx.LogsAPIProvider, features.IsEnabled(ctx, features.FlagCloudWatchCrossAccountQuerying)), nil
}
