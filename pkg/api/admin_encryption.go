package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	skv "github.com/grafana/grafana/pkg/services/secrets/kvstore"
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
	success, err := hs.secretsMigrator.ReEncryptSecrets(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to re-encrypt secrets", err)
	}

	if !success {
		return response.Error(http.StatusPartialContent, fmt.Sprintf("Something unexpected happened - %s", hs.Cfg.UserFacingDefaultError), err)
	}

	return response.Respond(http.StatusOK, "Secrets re-encrypted successfully")
}

func (hs *HTTPServer) AdminRollbackSecrets(c *contextmodel.ReqContext) response.Response {
	success, err := hs.secretsMigrator.RollBackSecrets(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to rollback secrets", err)
	}

	if !success {
		return response.Error(http.StatusPartialContent, fmt.Sprintf("Something unexpected happened - %s", hs.Cfg.UserFacingDefaultError), err)
	}

	return response.Respond(http.StatusOK, "Secrets rolled back successfully")
}

// To migrate to the plugin, it must be installed and configured
// so as not to lose access to migrated secrets
func (hs *HTTPServer) AdminMigrateSecretsToPlugin(c *contextmodel.ReqContext) response.Response {
	if skv.EvaluateRemoteSecretsPlugin(c.Req.Context(), hs.secretsPluginManager, hs.Cfg) != nil {
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
func (hs *HTTPServer) AdminMigrateSecretsFromPlugin(c *contextmodel.ReqContext) response.Response {
	if hs.secretsPluginManager.SecretsManager(c.Req.Context()) == nil {
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

func (hs *HTTPServer) AdminDeleteAllSecretsManagerPluginSecrets(c *contextmodel.ReqContext) response.Response {
	if hs.secretsPluginManager.SecretsManager(c.Req.Context()) == nil {
		hs.log.Warn("Received secrets plugin deletion request while plugin is not installed")
		return response.Respond(http.StatusBadRequest, "Secrets plugin is not installed")
	}
	items, err := hs.secretsStore.GetAll(c.Req.Context())
	if err != nil {
		return response.Respond(http.StatusInternalServerError, "an error occurred while retrieving secrets")
	}
	for _, item := range items {
		err := hs.secretsStore.Del(c.Req.Context(), *item.OrgId, *item.Namespace, *item.Type)
		if err != nil {
			return response.Respond(http.StatusInternalServerError, fmt.Sprintf("error deleting key with org=%v namespace=%v type=%v. error=%v", *item.OrgId, *item.Namespace, *item.Type, err.Error()))
		}
	}
	return response.Respond(http.StatusOK, fmt.Sprintf("All %d Secrets Manager plugin secrets deleted", len(items)))
}
