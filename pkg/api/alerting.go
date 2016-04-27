package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
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

// GET /api/alert_rule/changes
func GetAlertChanges(c *middleware.Context) Response {
	query := models.GetAlertChangesQuery{
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "List alerts failed", err)
	}

	return Json(200, query.Result)
}

// GET /api/alert_rule
func GetAlerts(c *middleware.Context) Response {
	query := models.GetAlertsQuery{
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "List alerts failed", err)
	}

	dashboardIds := make([]int64, 0)
	alertDTOs := make([]*dtos.AlertRuleDTO, 0)
	for _, alert := range query.Result {
		dashboardIds = append(dashboardIds, alert.DashboardId)
		alertDTOs = append(alertDTOs, &dtos.AlertRuleDTO{
			Id:          alert.Id,
			DashboardId: alert.DashboardId,
			PanelId:     alert.PanelId,
			Query:       alert.Query,
			QueryRefId:  alert.QueryRefId,
			WarnLevel:   alert.WarnLevel,
			CritLevel:   alert.CritLevel,
			Interval:    alert.Interval,
			Title:       alert.Title,
			Description: alert.Description,
			QueryRange:  alert.QueryRange,
			Aggregator:  alert.Aggregator,
		})
	}

	dashboardsQuery := models.GetDashboardsQuery{
		DashboardIds: dashboardIds,
	}

	if err := bus.Dispatch(&dashboardsQuery); err != nil {
		return ApiError(500, "List alerts failed", err)
	}

	//TODO: should be possible to speed this up with lookup table
	for _, alert := range alertDTOs {
		for _, dash := range *dashboardsQuery.Result {
			if alert.DashboardId == dash.Id {
				alert.DashbboardUri = "db/" + dash.Slug
			}
		}
	}

	return Json(200, alertDTOs)
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
