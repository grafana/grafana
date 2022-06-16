package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/models"
)

func swaggerUI(c *models.ReqContext) {
	c.HTML(http.StatusOK, "swagger", nil)
}
