package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/models"
)

func openapi3(c *models.ReqContext) {
	c.HTML(http.StatusOK, "openapi3", nil)
}
