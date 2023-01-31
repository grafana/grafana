package resourcepermissions

import (
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func disableMiddleware(shouldDisable bool) web.Handler {
	return func(c *contextmodel.ReqContext) {
		if shouldDisable {
			c.Resp.WriteHeader(http.StatusNotFound)
			return
		}
	}
}

func nopMiddleware(c *contextmodel.ReqContext) {}
