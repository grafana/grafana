package api

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/util"
)

func ValidateOrgAlert(c *models.ReqContext) {
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

func GetAlertStatesForDashboard(c *models.ReqContext) response.Response {
	dashboardID := c.QueryInt64("dashboardId")

	if dashboardID == 0 {
		return response.Error(400, "Missing query parameter dashboardId", nil)
	}

	query := models.GetAlertStatesForDashboardQuery{
		OrgId:       c.OrgId,
		DashboardId: c.QueryInt64("dashboardId"),
	}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "Failed to fetch alert states", err)
	}

	return response.JSON(200, query.Result)
}

// GET /api/alerts
func GetAlerts(c *models.ReqContext) response.Response {
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
			Permission:   models.PERMISSION_VIEW,
		}

		err := bus.Dispatch(&searchQuery)
		if err != nil {
			return response.Error(500, "List alerts failed", err)
		}

		for _, d := range searchQuery.Result {
			if d.Type == search.DashHitDB && d.ID > 0 {
				dashboardIDs = append(dashboardIDs, d.ID)
			}
		}

		// if we didn't find any dashboards, return empty result
		if len(dashboardIDs) == 0 {
			return response.JSON(200, []*models.AlertListItemDTO{})
		}
	}

	query := models.GetAlertsQuery{
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
		return response.Error(500, "List alerts failed", err)
	}

	for _, alert := range query.Result {
		alert.Url = models.GetDashboardUrl(alert.DashboardUid, alert.DashboardSlug)
	}

	return response.JSON(200, query.Result)
}

// POST /api/alerts/test
func (hs *HTTPServer) AlertTest(c *models.ReqContext, dto dtos.AlertTestCommand) response.Response {
	if _, idErr := dto.Dashboard.Get("id").Int64(); idErr != nil {
		return response.Error(400, "The dashboard needs to be saved at least once before you can test an alert rule", nil)
	}

	res, err := hs.AlertEngine.AlertTest(c.OrgId, dto.Dashboard, dto.PanelId, c.SignedInUser)
	if err != nil {
		var validationErr alerting.ValidationError
		if errors.As(err, &validationErr) {
			return response.Error(422, validationErr.Error(), nil)
		}
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			return response.Error(403, "Access denied to datasource", err)
		}
		return response.Error(500, "Failed to test rule", err)
	}

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

	return response.JSON(200, dtoRes)
}

// GET /api/alerts/:id
func GetAlert(c *models.ReqContext) response.Response {
	id := c.ParamsInt64(":alertId")
	query := models.GetAlertByIdQuery{Id: id}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "List alerts failed", err)
	}

	return response.JSON(200, &query.Result)
}

func GetAlertNotifiers(ngalertEnabled bool) func(*models.ReqContext) response.Response {
	return func(_ *models.ReqContext) response.Response {
		if ngalertEnabled {
			return response.JSON(200, notifier.GetAvailableNotifiers())
		}
		// TODO(codesome): This wont be required in 8.0 since ngalert
		// will be enabled by default with no disabling. This is to be removed later.
		return response.JSON(200, alerting.GetNotifiers())
	}
}

func GetAlertNotificationLookup(c *models.ReqContext) response.Response {
	alertNotifications, err := getAlertNotificationsInternal(c)
	if err != nil {
		return response.Error(500, "Failed to get alert notifications", err)
	}

	result := make([]*dtos.AlertNotificationLookup, 0)

	for _, notification := range alertNotifications {
		result = append(result, dtos.NewAlertNotificationLookup(notification))
	}

	return response.JSON(200, result)
}

func GetAlertNotifications(c *models.ReqContext) response.Response {
	alertNotifications, err := getAlertNotificationsInternal(c)
	if err != nil {
		return response.Error(500, "Failed to get alert notifications", err)
	}

	result := make([]*dtos.AlertNotification, 0)

	for _, notification := range alertNotifications {
		result = append(result, dtos.NewAlertNotification(notification))
	}

	return response.JSON(200, result)
}

func getAlertNotificationsInternal(c *models.ReqContext) ([]*models.AlertNotification, error) {
	query := &models.GetAllAlertNotificationsQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

func GetAlertNotificationByID(c *models.ReqContext) response.Response {
	query := &models.GetAlertNotificationsQuery{
		OrgId: c.OrgId,
		Id:    c.ParamsInt64("notificationId"),
	}

	if query.Id == 0 {
		return response.Error(404, "Alert notification not found", nil)
	}

	if err := bus.Dispatch(query); err != nil {
		return response.Error(500, "Failed to get alert notifications", err)
	}

	if query.Result == nil {
		return response.Error(404, "Alert notification not found", nil)
	}

	return response.JSON(200, dtos.NewAlertNotification(query.Result))
}

func GetAlertNotificationByUID(c *models.ReqContext) response.Response {
	query := &models.GetAlertNotificationsWithUidQuery{
		OrgId: c.OrgId,
		Uid:   c.Params("uid"),
	}

	if query.Uid == "" {
		return response.Error(404, "Alert notification not found", nil)
	}

	if err := bus.Dispatch(query); err != nil {
		return response.Error(500, "Failed to get alert notifications", err)
	}

	if query.Result == nil {
		return response.Error(404, "Alert notification not found", nil)
	}

	return response.JSON(200, dtos.NewAlertNotification(query.Result))
}

func CreateAlertNotification(c *models.ReqContext, cmd models.CreateAlertNotificationCommand) response.Response {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationWithSameNameExists) || errors.Is(err, models.ErrAlertNotificationWithSameUIDExists) {
			return response.Error(409, "Failed to create alert notification", err)
		}
		return response.Error(500, "Failed to create alert notification", err)
	}

	return response.JSON(200, dtos.NewAlertNotification(cmd.Result))
}

func UpdateAlertNotification(c *models.ReqContext, cmd models.UpdateAlertNotificationCommand) response.Response {
	cmd.OrgId = c.OrgId

	err := fillWithSecureSettingsData(&cmd)
	if err != nil {
		return response.Error(500, "Failed to update alert notification", err)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationNotFound) {
			return response.Error(404, err.Error(), err)
		}
		return response.Error(500, "Failed to update alert notification", err)
	}

	query := models.GetAlertNotificationsQuery{
		OrgId: c.OrgId,
		Id:    cmd.Id,
	}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "Failed to get alert notification", err)
	}

	return response.JSON(200, dtos.NewAlertNotification(query.Result))
}

func UpdateAlertNotificationByUID(c *models.ReqContext, cmd models.UpdateAlertNotificationWithUidCommand) response.Response {
	cmd.OrgId = c.OrgId
	cmd.Uid = c.Params("uid")

	err := fillWithSecureSettingsDataByUID(&cmd)
	if err != nil {
		return response.Error(500, "Failed to update alert notification", err)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationNotFound) {
			return response.Error(404, err.Error(), nil)
		}
		return response.Error(500, "Failed to update alert notification", err)
	}

	query := models.GetAlertNotificationsWithUidQuery{
		OrgId: cmd.OrgId,
		Uid:   cmd.Uid,
	}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "Failed to get alert notification", err)
	}

	return response.JSON(200, dtos.NewAlertNotification(query.Result))
}

func fillWithSecureSettingsData(cmd *models.UpdateAlertNotificationCommand) error {
	if len(cmd.SecureSettings) == 0 {
		return nil
	}

	query := &models.GetAlertNotificationsQuery{
		OrgId: cmd.OrgId,
		Id:    cmd.Id,
	}

	if err := bus.Dispatch(query); err != nil {
		return err
	}

	secureSettings := query.Result.SecureSettings.Decrypt()
	for k, v := range secureSettings {
		if _, ok := cmd.SecureSettings[k]; !ok {
			cmd.SecureSettings[k] = v
		}
	}

	return nil
}

func fillWithSecureSettingsDataByUID(cmd *models.UpdateAlertNotificationWithUidCommand) error {
	if len(cmd.SecureSettings) == 0 {
		return nil
	}

	query := &models.GetAlertNotificationsWithUidQuery{
		OrgId: cmd.OrgId,
		Uid:   cmd.Uid,
	}

	if err := bus.Dispatch(query); err != nil {
		return err
	}

	secureSettings := query.Result.SecureSettings.Decrypt()
	for k, v := range secureSettings {
		if _, ok := cmd.SecureSettings[k]; !ok {
			cmd.SecureSettings[k] = v
		}
	}

	return nil
}

func DeleteAlertNotification(c *models.ReqContext) response.Response {
	cmd := models.DeleteAlertNotificationCommand{
		OrgId: c.OrgId,
		Id:    c.ParamsInt64("notificationId"),
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationNotFound) {
			return response.Error(404, err.Error(), nil)
		}
		return response.Error(500, "Failed to delete alert notification", err)
	}

	return response.Success("Notification deleted")
}

func DeleteAlertNotificationByUID(c *models.ReqContext) response.Response {
	cmd := models.DeleteAlertNotificationWithUidCommand{
		OrgId: c.OrgId,
		Uid:   c.Params("uid"),
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationNotFound) {
			return response.Error(404, err.Error(), nil)
		}
		return response.Error(500, "Failed to delete alert notification", err)
	}

	return response.JSON(200, util.DynMap{
		"message": "Notification deleted",
		"id":      cmd.DeletedAlertNotificationId,
	})
}

// POST /api/alert-notifications/test
func NotificationTest(c *models.ReqContext, dto dtos.NotificationTestCommand) response.Response {
	cmd := &alerting.NotificationTestCommand{
		OrgID:          c.OrgId,
		ID:             dto.ID,
		Name:           dto.Name,
		Type:           dto.Type,
		Settings:       dto.Settings,
		SecureSettings: dto.SecureSettings,
	}

	if err := bus.DispatchCtx(c.Req.Context(), cmd); err != nil {
		if errors.Is(err, models.ErrSmtpNotEnabled) {
			return response.Error(412, err.Error(), err)
		}
		var alertingErr alerting.ValidationError
		if errors.As(err, &alertingErr) {
			return response.Error(400, err.Error(), err)
		}

		return response.Error(500, "Failed to send alert notifications", err)
	}

	return response.Success("Test notification sent")
}

// POST /api/alerts/:alertId/pause
func PauseAlert(c *models.ReqContext, dto dtos.PauseAlertCommand) response.Response {
	alertID := c.ParamsInt64("alertId")
	result := make(map[string]interface{})
	result["alertId"] = alertID

	query := models.GetAlertByIdQuery{Id: alertID}
	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "Get Alert failed", err)
	}

	guardian := guardian.New(query.Result.DashboardId, c.OrgId, c.SignedInUser)
	if canEdit, err := guardian.CanEdit(); err != nil || !canEdit {
		if err != nil {
			return response.Error(500, "Error while checking permissions for Alert", err)
		}

		return response.Error(403, "Access denied to this dashboard and alert", nil)
	}

	// Alert state validation
	if query.Result.State != models.AlertStatePaused && !dto.Paused {
		result["state"] = "un-paused"
		result["message"] = "Alert is already un-paused"
		return response.JSON(200, result)
	} else if query.Result.State == models.AlertStatePaused && dto.Paused {
		result["state"] = models.AlertStatePaused
		result["message"] = "Alert is already paused"
		return response.JSON(200, result)
	}

	cmd := models.PauseAlertCommand{
		OrgId:    c.OrgId,
		AlertIds: []int64{alertID},
		Paused:   dto.Paused,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return response.Error(500, "", err)
	}

	var resp models.AlertStateType = models.AlertStateUnknown
	pausedState := "un-paused"
	if cmd.Paused {
		resp = models.AlertStatePaused
		pausedState = "paused"
	}

	result["state"] = resp
	result["message"] = "Alert " + pausedState
	return response.JSON(200, result)
}

// POST /api/admin/pause-all-alerts
func PauseAllAlerts(c *models.ReqContext, dto dtos.PauseAllAlertsCommand) response.Response {
	updateCmd := models.PauseAllAlertCommand{
		Paused: dto.Paused,
	}

	if err := bus.Dispatch(&updateCmd); err != nil {
		return response.Error(500, "Failed to pause alerts", err)
	}

	var resp models.AlertStateType = models.AlertStatePending
	pausedState := "un paused"
	if updateCmd.Paused {
		resp = models.AlertStatePaused
		pausedState = "paused"
	}

	result := map[string]interface{}{
		"state":          resp,
		"message":        "alerts " + pausedState,
		"alertsAffected": updateCmd.ResultCount,
	}

	return response.JSON(200, result)
}
