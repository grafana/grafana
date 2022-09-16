package resourcepermissions

import (
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func disableMiddleware(shouldDisable bool) web.Handler {
	return func(c *models.ReqContext) {
		if shouldDisable {
			c.Resp.WriteHeader(http.StatusNotFound)
			return
		}
	}
}
