package api

import "github.com/grafana/grafana/pkg/models"

func swaggerUI(c *models.ReqContext) {
	c.HTML(200, "swagger", nil)
}
