package api

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/search"
)

func ValidateOrgAlert(c *m.ReqContext) {
	id := c.ParamsInt64(":alertId")
	query := m.GetAlertByIdQuery{Id: id}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(404, "Alert not found", nil)
		return
	}

	if c.OrgId != query.Result.OrgId {
		c.JsonApiErr(403, "You are not allowed to edit/view alert", nil)
		return
	}
}

func GetAlertStatesForDashboard(c *m.ReqContext) Response {
	dashboardID := c.QueryInt64("dashboardId")

	if dashboardID == 0 {
		return Error(400, "Missing query parameter dashboardId", nil)
	}

	query := m.GetAlertStatesForDashboardQuery{
		OrgId:       c.OrgId,
		DashboardId: c.QueryInt64("dashboardId"),
	}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "Failed to fetch alert states", err)
	}

	return JSON(200, query.Result)
}

// GET /api/alerts
func GetAlerts(c *m.ReqContext) Response {
	dashboardQuery := c.Query("dashboardQuery")
	dashboardTags := c.QueryStrings("dashboardTag")
	stringDashboardIDs := c.QueryStrings("dashboardId")
	stringFolderIDs := c.QueryStrings("folderId")

	dashboardIDs := make([]int64, 0)
	for _, id := range stringDashboardIDs {
		dashboardID, err := strconv.ParseInt(id, 10, 64)
		if err == nil {
			dashboardIDs = append(dashboardIDs, dashboardID)
		}
	}

	if dashboardQuery != "" || len(dashboardTags) > 0 || len(stringFolderIDs) > 0 {
		folderIDs := make([]int64, 0)
		for _, id := range stringFolderIDs {
			folderID, err := strconv.ParseInt(id, 10, 64)
			if err == nil {
				folderIDs = append(folderIDs, folderID)
			}
		}

		searchQuery := search.Query{
			Title:        dashboardQuery,
			Tags:         dashboardTags,
			SignedInUser: c.SignedInUser,
			Limit:        1000,
			OrgId:        c.OrgId,
			DashboardIds: dashboardIDs,
			Type:         string(search.DashHitDB),
			FolderIds:    folderIDs,
			Permission:   m.PERMISSION_VIEW,
		}

		err := bus.Dispatch(&searchQuery)
		if err != nil {
			return Error(500, "List alerts failed", err)
		}

		for _, d := range searchQuery.Result {
			if d.Type == search.DashHitDB && d.Id > 0 {
				dashboardIDs = append(dashboardIDs, d.Id)
			}
		}

		// if we didn't find any dashboards, return empty result
		if len(dashboardIDs) == 0 {
			return JSON(200, []*m.AlertListItemDTO{})
		}
	}

	query := m.GetAlertsQuery{
		OrgId:        c.OrgId,
		DashboardIDs: dashboardIDs,
		PanelId:      c.QueryInt64("panelId"),
		Limit:        c.QueryInt64("limit"),
		User:         c.SignedInUser,
		Query:        c.Query("query"),
	}

	states := c.QueryStrings("state")
	if len(states) > 0 {
		query.State = states
	}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "List alerts failed", err)
	}

	for _, alert := range query.Result {
		alert.Url = m.GetDashboardUrl(alert.DashboardUid, alert.DashboardSlug)
	}

	return JSON(200, query.Result)
}

// POST /api/alerts/test
func AlertTest(c *m.ReqContext, dto dtos.AlertTestCommand) Response {
	if _, idErr := dto.Dashboard.Get("id").Int64(); idErr != nil {
		return Error(400, "The dashboard needs to be saved at least once before you can test an alert rule", nil)
	}

	backendCmd := alerting.AlertTestCommand{
		OrgID:     c.OrgId,
		Dashboard: dto.Dashboard,
		PanelID:   dto.PanelId,
		User:      c.SignedInUser,
	}

	if err := bus.Dispatch(&backendCmd); err != nil {
		if validationErr, ok := err.(alerting.ValidationError); ok {
			return Error(422, validationErr.Error(), nil)
		}
		if err == m.ErrDataSourceAccessDenied {
			return Error(403, "Access denied to datasource", err)
		}
		return Error(500, "Failed to test rule", err)
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

	return JSON(200, dtoRes)
}

// GET /api/alerts/:id
func GetAlert(c *m.ReqContext) Response {
	id := c.ParamsInt64(":alertId")
	query := m.GetAlertByIdQuery{Id: id}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "List alerts failed", err)
	}

	return JSON(200, &query.Result)
}

func GetAlertNotifiers(c *m.ReqContext) Response {
	return JSON(200, alerting.GetNotifiers())
}

func GetAlertNotifications(c *m.ReqContext) Response {
	query := &m.GetAllAlertNotificationsQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(query); err != nil {
		return Error(500, "Failed to get alert notifications", err)
	}

	result := make([]*dtos.AlertNotification, 0)

	for _, notification := range query.Result {
		result = append(result, dtos.NewAlertNotification(notification))
	}

	return JSON(200, result)
}

func GetAlertNotificationByID(c *m.ReqContext) Response {
	query := &m.GetAlertNotificationsQuery{
		OrgId: c.OrgId,
		Id:    c.ParamsInt64("notificationId"),
	}

	if query.Id == 0 {
		return Error(404, "Alert notification not found", nil)
	}

	if err := bus.Dispatch(query); err != nil {
		return Error(500, "Failed to get alert notifications", err)
	}

	if query.Result == nil {
		return Error(404, "Alert notification not found", nil)
	}

	return JSON(200, dtos.NewAlertNotification(query.Result))
}

func GetAlertNotificationByUID(c *m.ReqContext) Response {
	query := &m.GetAlertNotificationsWithUidQuery{
		OrgId: c.OrgId,
		Uid:   c.Params("uid"),
	}

	if query.Uid == "" {
		return Error(404, "Alert notification not found", nil)
	}

	if err := bus.Dispatch(query); err != nil {
		return Error(500, "Failed to get alert notifications", err)
	}

	if query.Result == nil {
		return Error(404, "Alert notification not found", nil)
	}

	return JSON(200, dtos.NewAlertNotification(query.Result))
}

func CreateAlertNotification(c *m.ReqContext, cmd m.CreateAlertNotificationCommand) Response {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to create alert notification", err)
	}

	return JSON(200, dtos.NewAlertNotification(cmd.Result))
}

func UpdateAlertNotification(c *m.ReqContext, cmd m.UpdateAlertNotificationCommand) Response {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to update alert notification", err)
	}

	if cmd.Result == nil {
		return Error(404, "Alert notification not found", nil)
	}

	return JSON(200, dtos.NewAlertNotification(cmd.Result))
}

func UpdateAlertNotificationByUID(c *m.ReqContext, cmd m.UpdateAlertNotificationWithUidCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.Uid = c.Params("uid")

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to update alert notification", err)
	}

	if cmd.Result == nil {
		return Error(404, "Alert notification not found", nil)
	}

	return JSON(200, dtos.NewAlertNotification(cmd.Result))
}

func DeleteAlertNotification(c *m.ReqContext) Response {
	cmd := m.DeleteAlertNotificationCommand{
		OrgId: c.OrgId,
		Id:    c.ParamsInt64("notificationId"),
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to delete alert notification", err)
	}

	return Success("Notification deleted")
}

func DeleteAlertNotificationByUID(c *m.ReqContext) Response {
	cmd := m.DeleteAlertNotificationWithUidCommand{
		OrgId: c.OrgId,
		Uid:   c.Params("uid"),
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to delete alert notification", err)
	}

	return Success("Notification deleted")
}

//POST /api/alert-notifications/test
func NotificationTest(c *m.ReqContext, dto dtos.NotificationTestCommand) Response {
	cmd := &alerting.NotificationTestCommand{
		Name:     dto.Name,
		Type:     dto.Type,
		Settings: dto.Settings,
	}

	if err := bus.Dispatch(cmd); err != nil {
		if err == m.ErrSmtpNotEnabled {
			return Error(412, err.Error(), err)
		}
		return Error(500, "Failed to send alert notifications", err)
	}

	return Success("Test notification sent")
}

//POST /api/alerts/:alertId/pause
func PauseAlert(c *m.ReqContext, dto dtos.PauseAlertCommand) Response {
	alertID := c.ParamsInt64("alertId")

	query := m.GetAlertByIdQuery{Id: alertID}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "Get Alert failed", err)
	}

	guardian := guardian.New(query.Result.DashboardId, c.OrgId, c.SignedInUser)
	if canEdit, err := guardian.CanEdit(); err != nil || !canEdit {
		if err != nil {
			return Error(500, "Error while checking permissions for Alert", err)
		}

		return Error(403, "Access denied to this dashboard and alert", nil)
	}

	cmd := m.PauseAlertCommand{
		OrgId:    c.OrgId,
		AlertIds: []int64{alertID},
		Paused:   dto.Paused,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "", err)
	}

	var response m.AlertStateType = m.AlertStateUnknown
	pausedState := "un-paused"
	if cmd.Paused {
		response = m.AlertStatePaused
		pausedState = "paused"
	}

	result := map[string]interface{}{
		"alertId": alertID,
		"state":   response,
		"message": "Alert " + pausedState,
	}

	return JSON(200, result)
}

//POST /api/admin/pause-all-alerts
func PauseAllAlerts(c *m.ReqContext, dto dtos.PauseAllAlertsCommand) Response {
	updateCmd := m.PauseAllAlertCommand{
		Paused: dto.Paused,
	}

	if err := bus.Dispatch(&updateCmd); err != nil {
		return Error(500, "Failed to pause alerts", err)
	}

	var response m.AlertStateType = m.AlertStatePending
	pausedState := "un paused"
	if updateCmd.Paused {
		response = m.AlertStatePaused
		pausedState = "paused"
	}

	result := map[string]interface{}{
		"state":          response,
		"message":        "alerts " + pausedState,
		"alertsAffected": updateCmd.ResultCount,
	}

	return JSON(200, result)
}
