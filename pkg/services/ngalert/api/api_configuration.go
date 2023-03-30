package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

type ConfigSrv struct {
	datasourceService    datasources.DataSourceService
	alertmanagerProvider ExternalAlertmanagerProvider
	store                store.AdminConfigurationStore
	log                  log.Logger
}

func (srv ConfigSrv) RouteGetAlertmanagers(c *contextmodel.ReqContext) response.Response {
	urls := srv.alertmanagerProvider.AlertmanagersFor(c.OrgID)
	droppedURLs := srv.alertmanagerProvider.DroppedAlertmanagersFor(c.OrgID)
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

func (srv ConfigSrv) RouteGetNGalertConfig(c *contextmodel.ReqContext) response.Response {
	if c.OrgRole != org.RoleAdmin {
		return accessForbiddenResp()
	}

	cfg, err := srv.store.GetAdminConfiguration(c.OrgID)
	if err != nil {
		if errors.Is(err, store.ErrNoAdminConfiguration) {
			return ErrResp(http.StatusNotFound, err, "")
		}

		msg := "failed to fetch admin configuration from the database"
		srv.log.Error(msg, "error", err)
		return ErrResp(http.StatusInternalServerError, err, msg)
	}

	resp := apimodels.GettableNGalertConfig{
		AlertmanagersChoice: apimodels.AlertmanagersChoice(cfg.SendAlertsTo.String()),
	}
	return response.JSON(http.StatusOK, resp)
}

func (srv ConfigSrv) RoutePostNGalertConfig(c *contextmodel.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	if c.OrgRole != org.RoleAdmin {
		return accessForbiddenResp()
	}

	sendAlertsTo, err := ngmodels.StringToAlertmanagersChoice(string(body.AlertmanagersChoice))
	if err != nil {
		return response.Error(400, "Invalid alertmanager choice specified", err)
	}

	externalAlertmanagers, err := srv.externalAlertmanagers(c.Req.Context(), c.OrgID)
	if err != nil {
		return response.Error(500, "Couldn't fetch the external Alertmanagers from datasources", err)
	}

	if sendAlertsTo == ngmodels.ExternalAlertmanagers && len(externalAlertmanagers) < 1 {
		return response.Error(400, "At least one Alertmanager must be provided or configured as a datasource that handles alerts to choose this option", nil)
	}

	cfg := &ngmodels.AdminConfiguration{
		SendAlertsTo: sendAlertsTo,
		OrgID:        c.OrgID,
	}

	cmd := store.UpdateAdminConfigurationCmd{AdminConfiguration: cfg}
	if err := srv.store.UpdateAdminConfiguration(cmd); err != nil {
		msg := "failed to save the admin configuration to the database"
		srv.log.Error(msg, "error", err)
		return ErrResp(http.StatusBadRequest, err, msg)
	}

	return response.JSON(http.StatusCreated, util.DynMap{"message": "admin configuration updated"})
}

func (srv ConfigSrv) RouteDeleteNGalertConfig(c *contextmodel.ReqContext) response.Response {
	if c.OrgRole != org.RoleAdmin {
		return accessForbiddenResp()
	}

	err := srv.store.DeleteAdminConfiguration(c.OrgID)
	if err != nil {
		srv.log.Error("unable to delete configuration", "error", err)
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, util.DynMap{"message": "admin configuration deleted"})
}

// externalAlertmanagers returns the URL of any external alertmanager that is
// configured as datasource. The URL does not contain any auth.
func (srv ConfigSrv) externalAlertmanagers(ctx context.Context, orgID int64) ([]string, error) {
	var alertmanagers []string
	query := &datasources.GetDataSourcesByTypeQuery{
		OrgID: orgID,
		Type:  datasources.DS_ALERTMANAGER,
	}
	dataSources, err := srv.datasourceService.GetDataSourcesByType(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch datasources for org: %w", err)
	}
	for _, ds := range dataSources {
		if ds.JsonData.Get(apimodels.HandleGrafanaManagedAlerts).MustBool(false) {
			// we don't need to build the exact URL as we only need
			// to know if any is set
			alertmanagers = append(alertmanagers, ds.UID)
		}
	}
	return alertmanagers, nil
}

func (srv ConfigSrv) RouteGetAlertingStatus(c *contextmodel.ReqContext) response.Response {
	sendsAlertsTo := ngmodels.InternalAlertmanager

	cfg, err := srv.store.GetAdminConfiguration(c.OrgID)
	if err != nil && !errors.Is(err, store.ErrNoAdminConfiguration) {
		msg := "failed to fetch configuration from the database"
		srv.log.Error(msg, "error", err)
		return ErrResp(http.StatusInternalServerError, err, msg)
	}
	if cfg != nil {
		sendsAlertsTo = cfg.SendAlertsTo
	}

	// handle errors
	externalAlertManagers, err := srv.externalAlertmanagers(c.Req.Context(), c.OrgID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	resp := apimodels.AlertingStatus{
		AlertmanagersChoice:      apimodels.AlertmanagersChoice(sendsAlertsTo.String()),
		NumExternalAlertmanagers: len(externalAlertManagers),
	}
	return response.JSON(http.StatusOK, resp)
}
