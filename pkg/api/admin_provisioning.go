package api

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) AdminProvisioningReloadDashboards(c *models.ReqContext) Response {
	err := hs.ProvisioningService.ProvisionDashboards()
	if err != nil && err != context.Canceled {
		return Error(500, "", err)
	}
	return Success("Dashboards config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadDatasources(c *models.ReqContext) Response {
	err := hs.ProvisioningService.ProvisionDatasources()
	if err != nil {
		return Error(500, "", err)
	}
	return Success("Datasources config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadPlugins(c *models.ReqContext) Response {
	err := hs.ProvisioningService.ProvisionPlugins()
	if err != nil {
		return Error(500, "Failed to reload plugins config", err)
	}
	return Success("Plugins config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadNotifications(c *models.ReqContext) Response {
	err := hs.ProvisioningService.ProvisionNotifications()
	if err != nil {
		return Error(500, "", err)
	}
	return Success("Notifications config reloaded")
}
