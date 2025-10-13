package routes

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func ResourceRequestMiddleware(handleFunc models.RouteHandlerFunc, logger log.Logger, reqCtxFactory models.RequestContextFactoryFunc) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		if req.Method != "GET" {
			respondWithError(rw, models.NewHttpError("Invalid method", http.StatusMethodNotAllowed, nil))
			return
		}

		ctx := req.Context()
		pluginContext := backend.PluginConfigFromContext(ctx)
		json, httpError := handleFunc(ctx, pluginContext, reqCtxFactory, req.URL.Query())
		if httpError != nil {
			logger.FromContext(ctx).Error("Error handling resource request", "error", httpError.Message)
			respondWithError(rw, httpError)
			return
		}

		rw.Header().Set("Content-Type", "application/json")
		_, err := rw.Write(json)
		if err != nil {
			logger.FromContext(ctx).Error("Error handling resource request", "error", err)
			respondWithError(rw, models.NewHttpError("error writing response in resource request middleware", http.StatusInternalServerError, err))
		}
	}
}
