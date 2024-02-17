package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"os"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

type ExternalIdResponse struct {
	ExternalId string `json:"externalId"`
}

func ExternalIdHandler(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	response := ExternalIdResponse{
		ExternalId: os.Getenv(awsds.GrafanaAssumeRoleExternalIdKeyName),
	}
	jsonResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in ExternalIdHandler", http.StatusInternalServerError, err)
	}

	return jsonResponse, nil
}
