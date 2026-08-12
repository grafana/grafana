package resourcepermissions

import (
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func nopMiddleware(c *contextmodel.ReqContext) {}
