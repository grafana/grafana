package api

import (
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func openapi3(c *contextmodel.ReqContext) {
	c.HTML(http.StatusOK, "openapi3", nil)
}
