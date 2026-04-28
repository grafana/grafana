package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
	"github.com/open-feature/go-sdk/openfeature"
)

// syncableAMImplementations lists the alertmanager datasource implementations
// whose configuration the external AM sync worker can fetch.
var syncableAMImplementations = []string{"mimir", "cortex"}

type ConfigSrv struct {
	datasourceService    datasources.DataSourceService
	alertmanagerProvider ExternalAlertmanagerProvider
	store                store.AdminConfigurationStore
	log                  log.Logger
}

func (srv ConfigSrv) RouteGetAlertmanagers(c *contextmodel.ReqContext) response.Response {
	urls := srv.alertmanagerProvider.AlertmanagersFor(c.GetOrgID())
	droppedURLs := srv.alertmanagerProvider.DroppedAlertmanagersFor(c.GetOrgID())
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
	if c.GetOrgRole() != org.RoleAdmin {
		return accessForbiddenResp()
	}

	cfg, err := srv.store.GetAdminConfiguration(c.GetOrgID())
	if err != nil {
		if errors.Is(err, store.ErrNoAdminConfiguration) {
			return ErrResp(http.StatusNotFound, err, "")
		}

		msg := "failed to fetch admin configuration from the database"
		srv.log.Error(msg, "error", err)
		return ErrResp(http.StatusInternalServerError, err, msg)
	}

	var resp apimodels.GettableNGalertConfig
	if cfg.SendAlertsTo != nil {
		resp.AlertmanagersChoice = apimodels.AlertmanagersChoice(cfg.SendAlertsTo.String())
	}

	if cfg.ExternalAlertmanagerUID != nil {
		resp.ExternalAlertmanagerUID = *cfg.ExternalAlertmanagerUID
	}

	return response.JSON(http.StatusOK, resp)
}

func (srv ConfigSrv) RoutePostNGalertConfig(c *contextmodel.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	ctx := c.Req.Context()
	ofClient := openfeature.NewDefaultClient()

	if c.GetOrgRole() != org.RoleAdmin {
		return accessForbiddenResp()
	}

	if body.AlertmanagersChoice == nil && body.ExternalAlertmanagerUID == nil {
		return response.Error(http.StatusBadRequest, "No fields to update", nil)
	}

	adminConfig := ngmodels.AdminConfiguration{
		OrgID: c.GetOrgID(),
	}

	if body.AlertmanagersChoice != nil {
		sendAlertsTo, err := ngmodels.StringToAlertmanagersChoice(string(*body.AlertmanagersChoice))
		if err != nil {
			return response.Error(http.StatusBadRequest, "Invalid alertmanager choice specified", err)
		}

		disableExternal := ofClient.Boolean(ctx, featuremgmt.FlagAlertingDisableSendAlertsExternal, false, openfeature.TransactionContext(ctx))
		if disableExternal && sendAlertsTo != ngmodels.InternalAlertmanager {
			return response.Error(http.StatusBadRequest, "Sending alerts to external alertmanagers is disallowed on this instance", nil)
		}

		externalAlertmanagers, err := srv.externalAlertmanagers(ctx, c.GetOrgID())
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Couldn't fetch the external Alertmanagers from datasources", err)
		}

		if sendAlertsTo == ngmodels.ExternalAlertmanagers && len(externalAlertmanagers) < 1 {
			return response.Error(http.StatusBadRequest, "At least one Alertmanager must be provided or configured as a datasource that handles alerts to choose this option", nil)
		}

		adminConfig.SendAlertsTo = &sendAlertsTo
	}

	if body.ExternalAlertmanagerUID != nil && ofClient.Boolean(ctx, featuremgmt.FlagAlertingSyncExternalAlertmanager, false, openfeature.TransactionContext(ctx)) {
		// Validate the datasource only when the value actually changes, so unrelated
		// updates (e.g. AlertmanagersChoice only) don't fail because the previously
		// stored UID is no longer valid.
		current := ""
		currentCfg, err := srv.store.GetAdminConfiguration(c.GetOrgID())
		if err != nil && !errors.Is(err, store.ErrNoAdminConfiguration) {
			return response.Error(http.StatusInternalServerError, "failed to fetch admin configuration", err)
		}
		if currentCfg != nil && currentCfg.ExternalAlertmanagerUID != nil {
			current = *currentCfg.ExternalAlertmanagerUID
		}

		if *body.ExternalAlertmanagerUID != current && *body.ExternalAlertmanagerUID != "" {
			ds, err := srv.datasourceService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
				UID:   *body.ExternalAlertmanagerUID,
				OrgID: c.GetOrgID(),
			})
			if err != nil {
				if errors.Is(err, datasources.ErrDataSourceNotFound) {
					return response.Error(http.StatusBadRequest, "datasource not found", err)
				}
				return response.Error(http.StatusInternalServerError, "failed to look up datasource", err)
			}
			if ds.Type != datasources.DS_ALERTMANAGER {
				return response.Error(http.StatusBadRequest, "datasource must be of type alertmanager", nil)
			}
			impl := strings.ToLower(ds.JsonData.Get("implementation").MustString(""))
			if !slices.Contains(syncableAMImplementations, impl) {
				var msg string
				if impl == "prometheus" {
					msg = `"prometheus" implementation is not supported for sync: vanilla Prometheus Alertmanager has no config API. Use the alertmanager import UI to upload config manually for these datasources.`
				} else {
					msg = fmt.Sprintf("%q implementation is not supported for sync (must be one of: %s)", impl, strings.Join(syncableAMImplementations, ", "))
				}
				return response.Error(http.StatusBadRequest, msg, nil)
			}
		}

		adminConfig.ExternalAlertmanagerUID = body.ExternalAlertmanagerUID
	}

	if err := srv.store.UpdateAdminConfiguration(store.UpdateAdminConfigurationCmd{
		AdminConfiguration: &adminConfig,
	}); err != nil {
		msg := "failed to save the admin configuration to the database"
		srv.log.Error(msg, "error", err)
		return ErrResp(http.StatusInternalServerError, err, msg)
	}

	return response.JSON(http.StatusCreated, util.DynMap{"message": "admin configuration updated"})
}

func (srv ConfigSrv) RouteDeleteNGalertConfig(c *contextmodel.ReqContext) response.Response {
	if c.GetOrgRole() != org.RoleAdmin {
		return accessForbiddenResp()
	}

	err := srv.store.DeleteAdminConfiguration(c.GetOrgID())
	if err != nil {
		srv.log.Error("Unable to delete configuration", "error", err)
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

	cfg, err := srv.store.GetAdminConfiguration(c.GetOrgID())
	if err != nil && !errors.Is(err, store.ErrNoAdminConfiguration) {
		msg := "failed to fetch configuration from the database"
		srv.log.Error(msg, "error", err)
		return ErrResp(http.StatusInternalServerError, err, msg)
	}
	if cfg != nil && cfg.SendAlertsTo != nil {
		sendsAlertsTo = *cfg.SendAlertsTo
	}

	// handle errors
	externalAlertManagers, err := srv.externalAlertmanagers(c.Req.Context(), c.GetOrgID())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	resp := apimodels.AlertingStatus{
		AlertmanagersChoice:      apimodels.AlertmanagersChoice(sendsAlertsTo.String()),
		NumExternalAlertmanagers: len(externalAlertManagers),
	}
	return response.JSON(http.StatusOK, resp)
}
