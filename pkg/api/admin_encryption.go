package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func (hs *HTTPServer) AdminRotateDataEncryptionKeys(c *contextmodel.ReqContext) response.Response {
	if err := hs.SecretsService.RotateDataKeys(c.Req.Context()); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to rotate data keys", err)
	}

	return response.Respond(http.StatusNoContent, "")
}

func (hs *HTTPServer) AdminReEncryptEncryptionKeys(c *contextmodel.ReqContext) response.Response {
	if err := hs.SecretsService.ReEncryptDataKeys(c.Req.Context()); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to re-encrypt data keys", err)
	}

	return response.Respond(http.StatusOK, "Data encryption keys re-encrypted successfully")
}

func (hs *HTTPServer) AdminReEncryptSecrets(c *contextmodel.ReqContext) response.Response {
	success, err := hs.SecretsMigrator.ReEncryptSecrets(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to re-encrypt secrets", err)
	}

	if !success {
		return response.Error(http.StatusPartialContent, fmt.Sprintf("Something unexpected happened - %s", hs.Cfg.UserFacingDefaultError), err)
	}

	return response.Respond(http.StatusOK, "Secrets re-encrypted successfully")
}

func (hs *HTTPServer) AdminRollbackSecrets(c *contextmodel.ReqContext) response.Response {
	success, err := hs.SecretsMigrator.RollBackSecrets(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to rollback secrets", err)
	}

	if !success {
		return response.Error(http.StatusPartialContent, fmt.Sprintf("Something unexpected happened - %s", hs.Cfg.UserFacingDefaultError), err)
	}

	return response.Respond(http.StatusOK, "Secrets rolled back successfully")
}
