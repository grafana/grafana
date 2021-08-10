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
)

type AdminSrv struct {
	store store.AdminConfigurationStore
	log   log.Logger
}

func (srv AdminSrv) RouteGetNGalertConfig(c *models.ReqContext) response.Response {
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
		Alertmanagers: cfg.Alertmanagers,
	}
	return response.JSON(http.StatusOK, resp)
}

func (srv AdminSrv) RoutePostNGalertConfig(c *models.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	if c.OrgRole != models.ROLE_ADMIN {
		return accessForbiddenResp()
	}

	cfg := &ngmodels.AdminConfiguration{
		Alertmanagers: body.Alertmanagers,
		OrgID:         c.OrgId,
	}

	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: cfg}
	if err := srv.store.UpdateAdminConfiguration(cmd); err != nil {
		msg := "failed to save the admin configuration to the database"
		srv.log.Error(msg, "err", err)
		return ErrResp(http.StatusBadRequest, err, msg)
	}

	return response.JSON(http.StatusCreated, "admin configuration updated")
}

func (srv AdminSrv) RouteDeleteNGalertConfig(c *models.ReqContext) response.Response {
	if c.OrgRole != models.ROLE_ADMIN {
		return accessForbiddenResp()
	}

	err := srv.store.DeleteAdminConfiguration(c.OrgId)
	if err != nil {
		srv.log.Error("unable to delete configuration", "err", err)
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, "admin configuration deleted")
}
