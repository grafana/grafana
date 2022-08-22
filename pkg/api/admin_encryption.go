package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	skv "github.com/grafana/grafana/pkg/services/secrets/kvstore"
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

	return response.Respond(http.StatusOK, "Data encryption keys re-encrypted successfully")
}

func (hs *HTTPServer) AdminReEncryptSecrets(c *models.ReqContext) response.Response {
	success, err := hs.secretsMigrator.ReEncryptSecrets(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to re-encrypt secrets", err)
	}

	if !success {
		return response.Error(http.StatusPartialContent, "Something unexpected happened, refer to the server logs for more details", err)
	}

	return response.Respond(http.StatusOK, "Secrets re-encrypted successfully")
}

func (hs *HTTPServer) AdminRollbackSecrets(c *models.ReqContext) response.Response {
	success, err := hs.secretsMigrator.RollBackSecrets(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to rollback secrets", err)
	}

	if !success {
		return response.Error(http.StatusPartialContent, "Something unexpected happened, refer to the server logs for more details", err)
	}

	return response.Respond(http.StatusOK, "Secrets rolled back successfully")
}

// To migrate to the plugin, it must be installed and configured
// so as not to lose access to migrated secrets
func (hs *HTTPServer) MigrateSecretsToPlugin(c *models.ReqContext) response.Response {
	if skv.EvaluateRemoteSecretsPlugin(hs.secretsPluginManager, hs.Cfg) != nil {
		hs.log.Warn("Received secrets plugin migration request while plugin is not available")
		return response.Respond(http.StatusBadRequest, "Secrets plugin is not available")
	}
	err := hs.secretsPluginMigrator.TriggerPluginMigration(c.Req.Context(), true)
	if err != nil {
		hs.log.Error("Failed to trigger secret migration to plugin", "error", err.Error())
		return response.Respond(http.StatusInternalServerError, "Secret migration to plugin failed")
	}
	return response.Respond(http.StatusOK, "Secret migration to plugin triggered successfully")
}

// To migrate from the plugin, it must be installed only
// as it is possible the user disabled it and then wants to migrate
func (hs *HTTPServer) MigrateSecretsFromPlugin(c *models.ReqContext) response.Response {
	if hs.secretsPluginManager.SecretsManager() == nil {
		hs.log.Warn("Received secrets plugin migration request while plugin is not installed")
		return response.Respond(http.StatusBadRequest, "Secrets plugin is not installed")
	}
	err := hs.secretsPluginMigrator.TriggerPluginMigration(c.Req.Context(), false)
	if err != nil {
		hs.log.Error("Failed to trigger secret migration from plugin", "error", err.Error())
		return response.Respond(http.StatusInternalServerError, "Secret migration from plugin failed")
	}
	return response.Respond(http.StatusOK, "Secret migration from plugin triggered successfully")
}
