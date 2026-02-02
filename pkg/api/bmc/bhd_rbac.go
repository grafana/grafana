package bmc

import (
	"github.com/grafana/grafana/pkg/api/bmc/bhd_rbac"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func (p *PluginsAPI) GetRolePermissions(c *contextmodel.ReqContext) response.Response {
	return bhd_rbac.GetRolePermissions(c, p.store.WithDbSession)
}

func (p *PluginsAPI) UpdateRolePermissions(c *contextmodel.ReqContext) response.Response {
	return bhd_rbac.UpdateRolePermissions(c, p.store.WithDbSession)
}

func (p *PluginsAPI) GetPermissionsByUser(c *contextmodel.ReqContext) response.Response {
	return bhd_rbac.GetPermissionsByUser(c, p.store.WithDbSession)
}
