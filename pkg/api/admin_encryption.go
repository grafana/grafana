package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) AdminRotateDataEncryptionKeys(c *models.ReqContext) response.Response {
	if err := hs.SecretsService.RotateDataKeys(c.Req.Context()); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to rotate data keys", err)
	}

	return response.Respond(http.StatusNoContent, "")
}

func (hs *HTTPServer) AdminReEncryptEncryptionKeys(c *models.ReqContext) response.Response {
	if err := hs.SecretsService.ReEncryptDataKeys(c.Req.Context()); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to re-encrypt data keys", err)
	}

	return response.Respond(http.StatusNoContent, "")
}

func (hs *HTTPServer) AdminReEncryptSecrets(c *models.ReqContext) response.Response {
	if err := hs.secretsMigrator.ReEncryptSecrets(c.Req.Context()); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to re-encrypt secrets", err)
	}

	return response.Respond(http.StatusNoContent, "")
}

func (hs *HTTPServer) AdminRollbackSecrets(c *models.ReqContext) response.Response {
	if err := hs.secretsMigrator.RollBackSecrets(c.Req.Context()); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to rollback secrets", err)
	}

	return response.Respond(http.StatusNoContent, "")
}
