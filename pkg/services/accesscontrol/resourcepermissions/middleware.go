package resourcepermissions

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func disableMiddleware(shouldDisable bool) web.Handler {
	return func(c *model.ReqContext) {
		if shouldDisable {
			c.Resp.WriteHeader(http.StatusNotFound)
			return
		}
	}
}

func nopMiddleware(c *model.ReqContext) {}
