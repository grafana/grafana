package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) AdminRotateDataEncryptionKeys(c *models.ReqContext) response.Response {
	if err := hs.SecretsService.RotateDataKeys(c.Req.Context()); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to rotate data key", err)
	}

	return response.Respond(http.StatusNoContent, "")
}
