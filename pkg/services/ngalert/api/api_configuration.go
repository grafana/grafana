package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

type ConfigSrv struct {
	alertmanagerProvider ExternalAlertmanagerProvider
	store                store.AdminConfigurationStore
	log                  log.Logger
}

func (srv ConfigSrv) RouteGetAlertmanagers(c *models.ReqContext) response.Response {
	urls := srv.alertmanagerProvider.AlertmanagersFor(c.OrgId)
	droppedURLs := srv.alertmanagerProvider.DroppedAlertmanagersFor(c.OrgId)
	ams := v1.AlertManagersResult{Active: make([]v1.AlertManager, len(urls)), Dropped: make([]v1.AlertManager, len(droppedURLs))}
	for i, url := range urls {
		ams.Active[i].URL = url.String()
	}
	for i, url := range droppedURLs {
		ams.Dropped[i].URL = url.String()
	}

	return response.JSON(http.StatusOK, apimodels.GettableAlertmanagers{
		Status: "success",
		Data:   ams,
	})
}

func (srv ConfigSrv) RouteGetNGalertConfig(c *models.ReqContext) response.Response {
	if c.OrgRole != models.ROLE_ADMIN {
		return accessForbiddenResp()
	}

	cfg, err := srv.store.GetAdminConfiguration(c.OrgId)
	if err != nil {
		if errors.Is(err, store.ErrNoAdminConfiguration) {
			return ErrResp(http.StatusNotFound, err, "")
		}

		msg := "failed to fetch admin configuration from the database"
		srv.log.Error(msg, "err", err)
		return ErrResp(http.StatusInternalServerError, err, msg)
	}

	resp := apimodels.GettableNGalertConfig{
		Alertmanagers:       cfg.Alertmanagers,
		AlertmanagersChoice: apimodels.AlertmanagersChoice(cfg.SendAlertsTo.String()),
	}
	return response.JSON(http.StatusOK, resp)
}

func (srv ConfigSrv) RoutePostNGalertConfig(c *models.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	if c.OrgRole != models.ROLE_ADMIN {
		return accessForbiddenResp()
	}

	sendAlertsTo, err := ngmodels.StringToAlertmanagersChoice(string(body.AlertmanagersChoice))
	if err != nil {
		return response.Error(400, "Invalid alertmanager choice specified", nil)
	}

	if sendAlertsTo == ngmodels.ExternalAlertmanagers && len(body.Alertmanagers) == 0 {
		return response.Error(400, "At least one Alertmanager must be provided to choose this option", nil)
	}

	cfg := &ngmodels.AdminConfiguration{
		Alertmanagers: body.Alertmanagers,
		SendAlertsTo:  sendAlertsTo,
		OrgID:         c.OrgId,
	}

	if err := cfg.Validate(); err != nil {
		msg := "failed to validate admin configuration"
		srv.log.Error(msg, "err", err)
		return ErrResp(http.StatusBadRequest, err, msg)
	}

	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: cfg}
	if err := srv.store.UpdateAdminConfiguration(cmd); err != nil {
		msg := "failed to save the admin configuration to the database"
		srv.log.Error(msg, "err", err)
		return ErrResp(http.StatusBadRequest, err, msg)
	}

	return response.JSON(http.StatusCreated, util.DynMap{"message": "admin configuration updated"})
}

func (srv ConfigSrv) RouteDeleteNGalertConfig(c *models.ReqContext) response.Response {
	if c.OrgRole != models.ROLE_ADMIN {
		return accessForbiddenResp()
	}

	err := srv.store.DeleteAdminConfiguration(c.OrgId)
	if err != nil {
		srv.log.Error("unable to delete configuration", "err", err)
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, util.DynMap{"message": "admin configuration deleted"})
}
