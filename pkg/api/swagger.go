package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func swaggerUI(c *model.ReqContext) {
	c.HTML(http.StatusOK, "swagger", nil)
}
