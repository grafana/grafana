package api

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) AdminProvisioningReloadDashboards(c *models.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionDashboards()
	if err != nil && !errors.Is(err, context.Canceled) {
		return response.Error(500, "", err)
	}
	return response.Success("Dashboards config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadDatasources(c *models.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionDatasources()
	if err != nil {
		return response.Error(500, "", err)
	}
	return response.Success("Datasources config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadPlugins(c *models.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionPlugins()
	if err != nil {
		return response.Error(500, "Failed to reload plugins config", err)
	}
	return response.Success("Plugins config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadNotifications(c *models.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionNotifications()
	if err != nil {
		return response.Error(500, "", err)
	}
	return response.Success("Notifications config reloaded")
}
