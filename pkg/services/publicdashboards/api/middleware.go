package api

import "github.com/grafana/grafana/pkg/models"

func SetPublicDashboardFlag() func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		c.IsPublicDashboardView = true
	}
}
