package api

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
)

type AlertmanagerSrv struct {
	am    Alertmanager
	store store.AlertingStore
	log   log.Logger
}

func (srv AlertmanagerSrv) RouteCreateSilence(c *models.ReqContext, postableSilence apimodels.PostableSilence) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return response.Error(http.StatusForbidden, "Permission denied", nil)
	}
	silenceID, err := srv.am.CreateSilence(&postableSilence)
	if err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}

		if errors.Is(err, notifier.ErrCreateSilenceBadPayload) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}

		return response.Error(http.StatusInternalServerError, "failed to create silence", err)
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "silence created", "id": silenceID})
}

func (srv AlertmanagerSrv) RouteDeleteAlertingConfig(c *models.ReqContext) response.Response {
	// not implemented
	return response.Error(http.StatusNotImplemented, "", nil)
}

func (srv AlertmanagerSrv) RouteDeleteSilence(c *models.ReqContext) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return response.Error(http.StatusForbidden, "Permission denied", nil)
	}
	silenceID := c.Params(":SilenceId")
	if err := srv.am.DeleteSilence(silenceID); err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, err.Error(), nil)
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "silence deleted"})
}

func (srv AlertmanagerSrv) RouteGetAlertingConfig(c *models.ReqContext) response.Response {
	query := ngmodels.GetLatestAlertmanagerConfigurationQuery{}
	if err := srv.store.GetLatestAlertmanagerConfiguration(&query); err != nil {
		if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "failed to get latest configuration", err)
	}

	cfg, err := notifier.Load([]byte(query.Result.AlertmanagerConfiguration))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to unmarshal alertmanager configuration", err)
	}

	result := apimodels.GettableUserConfig{
		TemplateFiles: cfg.TemplateFiles,
		AlertmanagerConfig: apimodels.GettableApiAlertingConfig{
			Config: cfg.AlertmanagerConfig.Config,
		},
	}
	for _, recv := range cfg.AlertmanagerConfig.Receivers {
		receivers := make([]*apimodels.GettableGrafanaReceiver, 0, len(recv.PostableGrafanaReceivers.GrafanaManagedReceivers))
		for _, pr := range recv.PostableGrafanaReceivers.GrafanaManagedReceivers {
			secureFields := make(map[string]bool, len(pr.SecureSettings))
			for k := range pr.SecureSettings {
				decryptedValue, err := pr.GetDecryptedSecret(k)
				if err != nil {
					return response.Error(http.StatusInternalServerError, fmt.Sprintf("failed to decrypt stored secure setting: %s", k), err)
				}
				if decryptedValue == "" {
					continue
				}
				secureFields[k] = true
			}
			gr := apimodels.GettableGrafanaReceiver{
				UID:                   pr.UID,
				Name:                  pr.Name,
				Type:                  pr.Type,
				DisableResolveMessage: pr.DisableResolveMessage,
				Settings:              pr.Settings,
				SecureFields:          secureFields,
			}
			receivers = append(receivers, &gr)
		}
		gettableApiReceiver := apimodels.GettableApiReceiver{
			GettableGrafanaReceivers: apimodels.GettableGrafanaReceivers{
				GrafanaManagedReceivers: receivers,
			},
		}
		gettableApiReceiver.Name = recv.Name
		result.AlertmanagerConfig.Receivers = append(result.AlertmanagerConfig.Receivers, &gettableApiReceiver)
	}

	return response.JSON(http.StatusOK, result)
}

func (srv AlertmanagerSrv) RouteGetAMAlertGroups(c *models.ReqContext) response.Response {
	groups, err := srv.am.GetAlertGroups(
		c.QueryBoolWithDefault("active", true),
		c.QueryBoolWithDefault("silenced", true),
		c.QueryBoolWithDefault("inhibited", true),
		c.QueryStrings("filter"),
		c.Query("receiver"),
	)
	if err != nil {
		if errors.Is(err, notifier.ErrGetAlertGroupsBadPayload) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}
		// any other error here should be an unexpected failure and thus an internal error
		return response.Error(http.StatusInternalServerError, err.Error(), nil)
	}

	return response.JSON(http.StatusOK, groups)
}

func (srv AlertmanagerSrv) RouteGetAMAlerts(c *models.ReqContext) response.Response {
	alerts, err := srv.am.GetAlerts(
		c.QueryBoolWithDefault("active", true),
		c.QueryBoolWithDefault("silenced", true),
		c.QueryBoolWithDefault("inhibited", true),
		c.QueryStrings("filter"),
		c.Query("receiver"),
	)
	if err != nil {
		if errors.Is(err, notifier.ErrGetAlertsBadPayload) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}
		// any other error here should be an unexpected failure and thus an internal error
		return response.Error(http.StatusInternalServerError, err.Error(), nil)
	}

	return response.JSON(http.StatusOK, alerts)
}

func (srv AlertmanagerSrv) RouteGetSilence(c *models.ReqContext) response.Response {
	silenceID := c.Params(":SilenceId")
	gettableSilence, err := srv.am.GetSilence(silenceID)
	if err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		// any other error here should be an unexpected failure and thus an internal error
		return response.Error(http.StatusInternalServerError, err.Error(), nil)
	}
	return response.JSON(http.StatusOK, gettableSilence)
}

func (srv AlertmanagerSrv) RouteGetSilences(c *models.ReqContext) response.Response {
	gettableSilences, err := srv.am.ListSilences(c.QueryStrings("filter"))
	if err != nil {
		if errors.Is(err, notifier.ErrListSilencesBadPayload) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}
		// any other error here should be an unexpected failure and thus an internal error
		return response.Error(http.StatusInternalServerError, err.Error(), nil)
	}
	return response.JSON(http.StatusOK, gettableSilences)
}

func (srv AlertmanagerSrv) RoutePostAlertingConfig(c *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return response.Error(http.StatusForbidden, "Permission denied", nil)
	}

	// Get the last known working configuration
	query := ngmodels.GetLatestAlertmanagerConfigurationQuery{}
	if err := srv.store.GetLatestAlertmanagerConfiguration(&query); err != nil {
		// If we don't have a configuration there's nothing for us to know and we should just continue saving the new one
		if !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return response.Error(http.StatusInternalServerError, "failed to get latest configuration", err)
		}
	}

	currentConfig, err := notifier.Load([]byte(query.Result.AlertmanagerConfiguration))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to load lastest configuration", err)
	}
	currentReceiverMap := currentConfig.GetGrafanaReceiverMap()

	// Copy the previously known secure settings
	for i, r := range body.AlertmanagerConfig.Receivers {
		for j, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
			if gr.UID == "" { // new receiver
				continue
			}

			cgmr, ok := currentReceiverMap[gr.UID]
			if !ok {
				// it tries to update a receiver that didn't previously exist
				return response.Error(http.StatusBadRequest, fmt.Sprintf("unknown receiver: %s", gr.UID), nil)
			}

			// frontend sends only the secure settings that have to be updated
			// therefore we have to copy from the last configuration only those secure settings not included in the request
			for key := range cgmr.SecureSettings {
				_, ok := body.AlertmanagerConfig.Receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings[key]
				if !ok {
					decryptedValue, err := cgmr.GetDecryptedSecret(key)
					if err != nil {
						return response.Error(http.StatusInternalServerError, fmt.Sprintf("failed to decrypt stored secure setting: %s", key), err)
					}

					if body.AlertmanagerConfig.Receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings == nil {
						body.AlertmanagerConfig.Receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings = make(map[string]string, len(cgmr.SecureSettings))
					}

					body.AlertmanagerConfig.Receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings[key] = decryptedValue
				}
			}
		}
	}

	if err := body.ProcessConfig(); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to post process Alertmanager configuration", err)
	}

	if err := srv.am.SaveAndApplyConfig(&body); err != nil {
		srv.log.Error("unable to save and apply alertmanager configuration", "err", err)
		return response.Error(http.StatusBadRequest, "failed to save and apply Alertmanager configuration", err)
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "configuration created"})
}

func (srv AlertmanagerSrv) RoutePostAMAlerts(c *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	// not implemented
	return response.Error(http.StatusNotImplemented, "", nil)
}
