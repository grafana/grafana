package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func openapi3(c *model.ReqContext) {
	c.HTML(http.StatusOK, "openapi3", nil)
}
