package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
)

func ValidateOrgAlert(c *middleware.Context) {
	id := c.ParamsInt64(":id")
	query := models.GetAlertById{Id: id}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(404, "Alert not found", nil)
		return
	}

	if c.OrgId != query.Result.OrgId {
		c.JsonApiErr(403, "You are not allowed to edit/view alert", nil)
		return
	}
}

// GET /api/alert_rule
func GetAlerts(c *middleware.Context) Response {
	query := models.GetAlertsQuery{
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "List alerts failed", err)
	}

	return Json(200, query.Result)
}

// GET /api/alert_rule/:id
func GetAlert(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")
	query := models.GetAlertById{Id: id}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "List alerts failed", err)
	}

	return Json(200, &query.Result)
}
