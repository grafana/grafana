package api

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (server *HTTPServer) AdminProvisioningReloadDashboards(c *models.ReqContext) Response {
	err := server.ProvisioningService.ProvisionDashboards()
	if err != nil && err != context.Canceled {
		return Error(500, "", err)
	}
	return Success("Dashboards config reloaded")
}

func (server *HTTPServer) AdminProvisioningReloadDatasources(c *models.ReqContext) Response {
	err := server.ProvisioningService.ProvisionDatasources()
	if err != nil {
		return Error(500, "", err)
	}
	return Success("Datasources config reloaded")
}

func (server *HTTPServer) AdminProvisioningReloadPlugins(c *models.ReqContext) Response {
	err := server.ProvisioningService.ProvisionPlugins()
	if err != nil {
		return Error(500, "Failed to reload plugins config", err)
	}
	return Success("Plugins config reloaded")
}

func (server *HTTPServer) AdminProvisioningReloadNotifications(c *models.ReqContext) Response {
	err := server.ProvisioningService.ProvisionNotifications()
	if err != nil {
		return Error(500, "", err)
	}
	return Success("Notifications config reloaded")
}
