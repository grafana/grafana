package api

import (
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func swaggerUI(c *contextmodel.ReqContext) {
	c.HTML(http.StatusOK, "swagger", nil)
}
