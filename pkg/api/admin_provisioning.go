package api

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

// swagger:route POST /admin/provisioning/dashboards/reload admin_provisioning adminProvisioningReloadDashboards
//
// Reload dashboard provisioning configurations.
//
// Reloads the provisioning config files for dashboards again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:dashboards`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AdminProvisioningReloadDashboards(c *contextmodel.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionDashboards(c.Req.Context())
	if err != nil && !errors.Is(err, context.Canceled) {
		return response.Error(500, "", err)
	}
	return response.Success("Dashboards config reloaded")
}

// swagger:route POST /admin/provisioning/datasources/reload admin_provisioning adminProvisioningReloadDatasources
//
// Reload datasource provisioning configurations.
//
// Reloads the provisioning config files for datasources again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:datasources`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AdminProvisioningReloadDatasources(c *contextmodel.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionDatasources(c.Req.Context())
	if err != nil {
		return response.Error(500, "", err)
	}
	return response.Success("Datasources config reloaded")
}

// swagger:route POST /admin/provisioning/plugins/reload admin_provisioning adminProvisioningReloadPlugins
//
// Reload plugin provisioning configurations.
//
// Reloads the provisioning config files for plugins again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:plugin`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AdminProvisioningReloadPlugins(c *contextmodel.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionPlugins(c.Req.Context())
	if err != nil {
		return response.Error(500, "Failed to reload plugins config", err)
	}
	return response.Success("Plugins config reloaded")
}

// swagger:route POST /admin/provisioning/notifications/reload admin_provisioning adminProvisioningReloadNotifications
//
// Reload legacy alert notifier provisioning configurations.
//
// Reloads the provisioning config files for legacy alert notifiers again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:notifications`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AdminProvisioningReloadNotifications(c *contextmodel.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionNotifications(c.Req.Context())
	if err != nil {
		return response.Error(500, "", err)
	}
	return response.Success("Notifications config reloaded")
}

func (hs *HTTPServer) AdminProvisioningReloadAlerting(c *contextmodel.ReqContext) response.Response {
	err := hs.ProvisioningService.ProvisionAlerting(c.Req.Context())
	if err != nil {
		return response.Error(500, "", err)
	}
	return response.Success("Alerting config reloaded")
}
