package api

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/utils"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) AdminProvisioningReloadDashboards(c *models.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionDashboards()
	if err != nil && !errors.Is(err, context.Canceled) {
		return utils.Error(500, "", err)
	}
	return utils.Success("Dashboards config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadDatasources(c *models.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionDatasources()
	if err != nil {
		return utils.Error(500, "", err)
	}
	return utils.Success("Datasources config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadPlugins(c *models.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionPlugins()
	if err != nil {
		return utils.Error(500, "Failed to reload plugins config", err)
	}
	return utils.Success("Plugins config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadNotifications(c *models.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionNotifications()
	if err != nil {
		return utils.Error(500, "", err)
	}
	return utils.Success("Notifications config reloaded")
}
