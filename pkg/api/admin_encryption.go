package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) AdminRotateDEK(c *models.ReqContext) response.Response {
	if err := hs.SecretsService.RotateDataKey(c.Req.Context()); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to rotate data key", err)
	}

	return response.Empty(http.StatusOK)
}
