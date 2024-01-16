package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

func LogGroupFieldsHandler(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	request, err := resources.ParseLogGroupFieldsRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in LogGroupFieldsHandler", http.StatusBadRequest, err)
	}

	service, err := newLogGroupsService(ctx, pluginCtx, reqCtxFactory, request.Region)
	if err != nil {
		return nil, models.NewHttpError("newLogGroupsService error", http.StatusInternalServerError, err)
	}

	logGroupFields, err := service.GetLogGroupFieldsWithContext(ctx, request)
	if err != nil {
		return nil, models.NewHttpError("GetLogGroupFields error", http.StatusInternalServerError, err)
	}

	logGroupsResponse, err := json.Marshal(logGroupFields)
	if err != nil {
		return nil, models.NewHttpError("LogGroupFieldsHandler json error", http.StatusInternalServerError, err)
	}

	return logGroupsResponse, nil
}
