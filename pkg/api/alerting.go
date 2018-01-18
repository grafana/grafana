package api

import (
	"fmt"

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

func GetAlertStatesForDashboard(c *middleware.Context) Response {
	dashboardId := c.QueryInt64("dashboardId")

	if dashboardId == 0 {
		return ApiError(400, "Missing query parameter dashboardId", nil)
	}

	query := models.GetAlertStatesForDashboardQuery{
		OrgId:       c.OrgId,
		DashboardId: c.QueryInt64("dashboardId"),
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to fetch alert states", err)
	}

	return Json(200, query.Result)
}

// GET /api/alerts
func GetAlerts(c *middleware.Context) Response {
	query := models.GetAlertsQuery{
		OrgId:       c.OrgId,
		DashboardId: c.QueryInt64("dashboardId"),
		PanelId:     c.QueryInt64("panelId"),
		Limit:       c.QueryInt64("limit"),
	}

	states := c.QueryStrings("state")
	if len(states) > 0 {
		query.State = states
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "List alerts failed", err)
	}

	dashboardIds := make([]int64, 0)
	alertDTOs := make([]*dtos.AlertRule, 0)
	for _, alert := range query.Result {
		dashboardIds = append(dashboardIds, alert.DashboardId)
		alertDTOs = append(alertDTOs, &dtos.AlertRule{
			Id:             alert.Id,
			DashboardId:    alert.DashboardId,
			PanelId:        alert.PanelId,
			Name:           alert.Name,
			Message:        alert.Message,
			State:          alert.State,
			NewStateDate:   alert.NewStateDate,
			ExecutionError: alert.ExecutionError,
			EvalData:       alert.EvalData,
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
func AlertTest(c *middleware.Context, dto dtos.AlertTestCommand) Response {
	if _, idErr := dto.Dashboard.Get("id").Int64(); idErr != nil {
		return ApiError(400, "The dashboard needs to be saved at least once before you can test an alert rule", nil)
	}

	backendCmd := alerting.AlertTestCommand{
		OrgId:     c.OrgId,
		Dashboard: dto.Dashboard,
		PanelId:   dto.PanelId,
	}

	if err := bus.Dispatch(&backendCmd); err != nil {
		if validationErr, ok := err.(alerting.ValidationError); ok {
			return ApiError(422, validationErr.Error(), nil)
		}
		return ApiError(500, "Failed to test rule", err)
	}

	res := backendCmd.Result
	dtoRes := &dtos.AlertTestResult{
		Firing:         res.Firing,
		ConditionEvals: res.ConditionEvals,
		State:          res.Rule.State,
	}

	if res.Error != nil {
		dtoRes.Error = res.Error.Error()
	}

	for _, log := range res.Logs {
		dtoRes.Logs = append(dtoRes.Logs, &dtos.AlertTestResultLog{Message: log.Message, Data: log.Data})
	}
	for _, match := range res.EvalMatches {
		dtoRes.EvalMatches = append(dtoRes.EvalMatches, &dtos.EvalMatch{Metric: match.Metric, Value: match.Value})
	}

	dtoRes.TimeMs = fmt.Sprintf("%1.3fms", res.GetDurationMs())

	return Json(200, dtoRes)
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

func GetAlertNotifiers(c *middleware.Context) Response {
	return Json(200, alerting.GetNotifiers())
}

func GetAlertNotifications(c *middleware.Context) Response {
	query := &models.GetAllAlertNotificationsQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(query); err != nil {
		return ApiError(500, "Failed to get alert notifications", err)
	}

	result := make([]*dtos.AlertNotification, 0)

	for _, notification := range query.Result {
		result = append(result, &dtos.AlertNotification{
			Id:        notification.Id,
			Name:      notification.Name,
			Type:      notification.Type,
			IsDefault: notification.IsDefault,
			Created:   notification.Created,
			Updated:   notification.Updated,
		})
	}

	return Json(200, result)
}

func GetAlertNotificationById(c *middleware.Context) Response {
	query := &models.GetAlertNotificationsQuery{
		OrgId: c.OrgId,
		Id:    c.ParamsInt64("notificationId"),
	}

	if err := bus.Dispatch(query); err != nil {
		return ApiError(500, "Failed to get alert notifications", err)
	}

	return Json(200, query.Result)
}

func CreateAlertNotification(c *middleware.Context, cmd models.CreateAlertNotificationCommand) Response {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to create alert notification", err)
	}

	return Json(200, cmd.Result)
}

func UpdateAlertNotification(c *middleware.Context, cmd models.UpdateAlertNotificationCommand) Response {
	cmd.OrgId = c.OrgId

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

	return ApiSuccess("Notification deleted")
}

//POST /api/alert-notifications/test
func NotificationTest(c *middleware.Context, dto dtos.NotificationTestCommand) Response {
	cmd := &alerting.NotificationTestCommand{
		Name:     dto.Name,
		Type:     dto.Type,
		Settings: dto.Settings,
	}

	if err := bus.Dispatch(cmd); err != nil {
		if err == models.ErrSmtpNotEnabled {
			return ApiError(412, err.Error(), err)
		}
		return ApiError(500, "Failed to send alert notifications", err)
	}

	return ApiSuccess("Test notification sent")
}

//POST /api/alerts/:alertId/pause
func PauseAlert(c *middleware.Context, dto dtos.PauseAlertCommand) Response {
	alertId := c.ParamsInt64("alertId")
	cmd := models.PauseAlertCommand{
		OrgId:    c.OrgId,
		AlertIds: []int64{alertId},
		Paused:   dto.Paused,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "", err)
	}

	var response models.AlertStateType = models.AlertStatePending
	pausedState := "un-paused"
	if cmd.Paused {
		response = models.AlertStatePaused
		pausedState = "paused"
	}

	result := map[string]interface{}{
		"alertId": alertId,
		"state":   response,
		"message": "Alert " + pausedState,
	}

	return Json(200, result)
}

//POST /api/admin/pause-all-alerts
func PauseAllAlerts(c *middleware.Context, dto dtos.PauseAllAlertsCommand) Response {
	updateCmd := models.PauseAllAlertCommand{
		Paused: dto.Paused,
	}

	if err := bus.Dispatch(&updateCmd); err != nil {
		return ApiError(500, "Failed to pause alerts", err)
	}

	var response models.AlertStateType = models.AlertStatePending
	pausedState := "un paused"
	if updateCmd.Paused {
		response = models.AlertStatePaused
		pausedState = "paused"
	}

	result := map[string]interface{}{
		"state":          response,
		"message":        "alerts " + pausedState,
		"alertsAffected": updateCmd.ResultCount,
	}

	return Json(200, result)
}
