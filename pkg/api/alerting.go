package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func ValidateOrgAlert(c *middleware.Context) {
	id := c.ParamsInt64(":alertId")
	query := models.GetAlertByIdQuery{Id: id}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(404, "Alert not found", nil)
		return
	}

	if c.OrgId != query.Result.OrgId {
		c.JsonApiErr(403, "You are not allowed to edit/view alert", nil)
		return
	}
}

// GET /api/alerts/rules/
func GetAlerts(c *middleware.Context) Response {
	query := models.GetAlertsQuery{
		OrgId:       c.OrgId,
		State:       c.QueryStrings("state"),
		DashboardId: c.QueryInt64("dashboardId"),
		PanelId:     c.QueryInt64("panelId"),
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
			Name:        alert.Name,
			Description: alert.Description,
			State:       alert.State,
		})
	}

	dashboardsQuery := models.GetDashboardsQuery{
		DashboardIds: dashboardIds,
	}

	if len(alertDTOs) > 0 {
		if err := bus.Dispatch(&dashboardsQuery); err != nil {
			return ApiError(500, "List alerts failed", err)
		}
	}

	//TODO: should be possible to speed this up with lookup table
	for _, alert := range alertDTOs {
		for _, dash := range dashboardsQuery.Result {
			if alert.DashboardId == dash.Id {
				alert.DashbboardUri = "db/" + dash.Slug
			}
		}
	}

	return Json(200, alertDTOs)
}

// POST /api/alerts/test
func TestAlertRule(c *middleware.Context, dto dtos.TestAlertRuleCommand) Response {
	backendCmd := alerting.TestAlertRuleCommand{
		OrgId:     c.OrgId,
		Dashboard: dto.Dashboard,
		PanelId:   dto.PanelId,
	}

	if err := bus.Dispatch(&backendCmd); err != nil {
		return ApiError(500, "Failed to test rule", err)
	}

	return Json(200, backendCmd.Result)
}

// GET /api/alerts/:id
func GetAlert(c *middleware.Context) Response {
	id := c.ParamsInt64(":alertId")
	query := models.GetAlertByIdQuery{Id: id}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "List alerts failed", err)
	}

	return Json(200, &query.Result)
}

// DEL /api/alerts/:id
func DelAlert(c *middleware.Context) Response {
	alertId := c.ParamsInt64(":alertId")

	if alertId == 0 {
		return ApiError(401, "Failed to parse alertid", nil)
	}

	cmd := models.DeleteAlertCommand{AlertId: alertId}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete alert", err)
	}

	var resp = map[string]interface{}{"alertId": alertId}
	return Json(200, resp)
}

// GET /api/alerts/events/:id
func GetAlertStates(c *middleware.Context) Response {
	alertId := c.ParamsInt64(":alertId")

	query := models.GetAlertsStateQuery{
		AlertId: alertId,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed get alert state log", err)
	}

	return Json(200, query.Result)
}

// PUT /api/alerts/events/:id
func PutAlertState(c *middleware.Context, cmd models.UpdateAlertStateCommand) Response {
	cmd.AlertId = c.ParamsInt64(":alertId")
	cmd.OrgId = c.OrgId

	query := models.GetAlertByIdQuery{Id: cmd.AlertId}
	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get alertstate", err)
	}

	if query.Result.OrgId != 0 && query.Result.OrgId != c.OrgId {
		return ApiError(500, "Alert not found", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to set new state", err)
	}

	return Json(200, cmd.Result)
}

func GetAlertNotifications(c *middleware.Context) Response {
	query := &models.GetAlertNotificationQuery{
		OrgID: c.OrgId,
	}

	if err := bus.Dispatch(query); err != nil {
		return ApiError(500, "Failed to get alert notifications", err)
	}

	var result []dtos.AlertNotificationDTO

	for _, notification := range query.Result {
		result = append(result, dtos.AlertNotificationDTO{
			Id:      notification.Id,
			Name:    notification.Name,
			Type:    notification.Type,
			Created: notification.Created,
			Updated: notification.Updated,
		})
	}

	return Json(200, result)
}

func GetAlertNotificationById(c *middleware.Context) Response {
	query := &models.GetAlertNotificationQuery{
		OrgID: c.OrgId,
		Id:    c.ParamsInt64("notificationId"),
	}

	if err := bus.Dispatch(query); err != nil {
		return ApiError(500, "Failed to get alert notifications", err)
	}

	return Json(200, query.Result[0])
}

func CreateAlertNotification(c *middleware.Context, cmd models.CreateAlertNotificationCommand) Response {
	cmd.OrgID = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to create alert notification", err)
	}

	return Json(200, cmd.Result)
}

func UpdateAlertNotification(c *middleware.Context, cmd models.UpdateAlertNotificationCommand) Response {
	cmd.OrgID = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to update alert notification", err)
	}

	return Json(200, cmd.Result)
}

func DeleteAlertNotification(c *middleware.Context) Response {
	cmd := models.DeleteAlertNotificationCommand{
		OrgId: c.OrgId,
		Id:    c.ParamsInt64("notificationId"),
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete alert notification", err)
	}

	return Json(200, map[string]interface{}{"notificationId": cmd.Id})
}
