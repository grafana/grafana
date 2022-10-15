package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) ValidateOrgAlert(c *models.ReqContext) {
	id, err := strconv.ParseInt(web.Params(c.Req)[":alertId"], 10, 64)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "alertId is invalid", nil)
		return
	}
	query := models.GetAlertByIdQuery{Id: id}

	if err := hs.AlertEngine.AlertStore.GetAlertById(c.Req.Context(), &query); err != nil {
		c.JsonApiErr(404, "Alert not found", nil)
		return
	}

	if c.OrgID != query.Result.OrgId {
		c.JsonApiErr(403, "You are not allowed to edit/view alert", nil)
		return
	}
}

// swagger:route GET /alerts/states-for-dashboard legacy_alerts getDashboardStates
//
// Get alert states for a dashboard.
//
// Responses:
// Responses:
// 200: getDashboardStatesResponse
// 400: badRequestError
// 500: internalServerError
func (hs *HTTPServer) GetAlertStatesForDashboard(c *models.ReqContext) response.Response {
	dashboardID := c.QueryInt64("dashboardId")

	if dashboardID == 0 {
		return response.Error(400, "Missing query parameter dashboardId", nil)
	}

	query := models.GetAlertStatesForDashboardQuery{
		OrgId:       c.OrgID,
		DashboardId: c.QueryInt64("dashboardId"),
	}

	if err := hs.AlertEngine.AlertStore.GetAlertStatesForDashboard(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to fetch alert states", err)
	}

	return response.JSON(http.StatusOK, query.Result)
}

// swagger:route GET /alerts legacy_alerts getAlerts
//
// Get legacy alerts.
//
// Responses:
// 200: getAlertsResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetAlerts(c *models.ReqContext) response.Response {
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
			OrgId:        c.OrgID,
			DashboardIds: dashboardIDs,
			Type:         string(models.DashHitDB),
			FolderIds:    folderIDs,
			Permission:   models.PERMISSION_VIEW,
		}

		err := hs.SearchService.SearchHandler(c.Req.Context(), &searchQuery)
		if err != nil {
			return response.Error(500, "List alerts failed", err)
		}

		for _, d := range searchQuery.Result {
			if d.Type == models.DashHitDB && d.ID > 0 {
				dashboardIDs = append(dashboardIDs, d.ID)
			}
		}

		// if we didn't find any dashboards, return empty result
		if len(dashboardIDs) == 0 {
			return response.JSON(http.StatusOK, []*models.AlertListItemDTO{})
		}
	}

	query := models.GetAlertsQuery{
		OrgId:        c.OrgID,
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

	if err := hs.AlertEngine.AlertStore.HandleAlertsQuery(c.Req.Context(), &query); err != nil {
		return response.Error(500, "List alerts failed", err)
	}

	for _, alert := range query.Result {
		alert.Url = models.GetDashboardUrl(alert.DashboardUid, alert.DashboardSlug)
	}

	return response.JSON(http.StatusOK, query.Result)
}

// swagger:route POST /alerts/test legacy_alerts testAlert
//
// Test alert.
//
// Responses:
// 200: testAlertResponse
// 400: badRequestError
// 422: unprocessableEntityError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AlertTest(c *models.ReqContext) response.Response {
	dto := dtos.AlertTestCommand{}
	if err := web.Bind(c.Req, &dto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if _, idErr := dto.Dashboard.Get("id").Int64(); idErr != nil {
		return response.Error(400, "The dashboard needs to be saved at least once before you can test an alert rule", nil)
	}

	res, err := hs.AlertEngine.AlertTest(c.OrgID, dto.Dashboard, dto.PanelId, c.SignedInUser)
	if err != nil {
		var validationErr alerting.ValidationError
		if errors.As(err, &validationErr) {
			return response.Error(422, validationErr.Error(), nil)
		}
		if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
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

	return response.JSON(http.StatusOK, dtoRes)
}

// swagger:route GET /alerts/{alert_id} legacy_alerts getAlertByID
//
// Get alert by ID.
//
// “evalMatches” data in the response is cached in the db when and only when the state of the alert changes (e.g. transitioning from “ok” to “alerting” state).
// If data from one server triggers the alert first and, before that server is seen leaving alerting state, a second server also enters a state that would trigger the alert, the second server will not be visible in “evalMatches” data.
//
// Responses:
// 200: getAlertResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetAlert(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":alertId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "alertId is invalid", err)
	}
	query := models.GetAlertByIdQuery{Id: id}

	if err := hs.AlertEngine.AlertStore.GetAlertById(c.Req.Context(), &query); err != nil {
		return response.Error(500, "List alerts failed", err)
	}

	return response.JSON(http.StatusOK, &query.Result)
}

func (hs *HTTPServer) GetAlertNotifiers(ngalertEnabled bool) func(*models.ReqContext) response.Response {
	return func(_ *models.ReqContext) response.Response {
		if ngalertEnabled {
			return response.JSON(http.StatusOK, channels_config.GetAvailableNotifiers())
		}
		// TODO(codesome): This wont be required in 8.0 since ngalert
		// will be enabled by default with no disabling. This is to be removed later.
		return response.JSON(http.StatusOK, alerting.GetNotifiers())
	}
}

// swagger:route GET /alert-notifications/lookup legacy_alerts_notification_channels getAlertNotificationLookup
//
// Get all notification channels (lookup).
//
// Returns all notification channels, but with less detailed information. Accessible by any authenticated user and is mainly used by providing alert notification channels in Grafana UI when configuring alert rule.
//
// Responses:
// 200: getAlertNotificationLookupResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetAlertNotificationLookup(c *models.ReqContext) response.Response {
	alertNotifications, err := hs.getAlertNotificationsInternal(c)
	if err != nil {
		return response.Error(500, "Failed to get alert notifications", err)
	}

	result := make([]*dtos.AlertNotificationLookup, 0)

	for _, notification := range alertNotifications {
		result = append(result, dtos.NewAlertNotificationLookup(notification))
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route GET /alert-notifications legacy_alerts_notification_channels getAlertNotificationChannels
//
// Get all notification channels.
//
// Returns all notification channels that the authenticated user has permission to view.
//
// Responses:
// 200: getAlertNotificationChannelsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetAlertNotifications(c *models.ReqContext) response.Response {
	alertNotifications, err := hs.getAlertNotificationsInternal(c)
	if err != nil {
		return response.Error(500, "Failed to get alert notifications", err)
	}

	result := make([]*dtos.AlertNotification, 0)

	for _, notification := range alertNotifications {
		result = append(result, dtos.NewAlertNotification(notification))
	}

	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) getAlertNotificationsInternal(c *models.ReqContext) ([]*models.AlertNotification, error) {
	query := &models.GetAllAlertNotificationsQuery{OrgId: c.OrgID}

	if err := hs.AlertNotificationService.GetAllAlertNotifications(c.Req.Context(), query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

// swagger:route GET /alert-notifications/{notification_channel_id} legacy_alerts_notification_channels getAlertNotificationChannelByID
//
// Get notification channel by ID.
//
// Returns the notification channel given the notification channel ID.
//
// Responses:
// 200: getAlertNotificationChannelResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetAlertNotificationByID(c *models.ReqContext) response.Response {
	notificationId, err := strconv.ParseInt(web.Params(c.Req)[":notificationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "notificationId is invalid", err)
	}
	query := &models.GetAlertNotificationsQuery{
		OrgId: c.OrgID,
		Id:    notificationId,
	}

	if query.Id == 0 {
		return response.Error(404, "Alert notification not found", nil)
	}

	if err := hs.AlertNotificationService.GetAlertNotifications(c.Req.Context(), query); err != nil {
		return response.Error(500, "Failed to get alert notifications", err)
	}

	if query.Result == nil {
		return response.Error(404, "Alert notification not found", nil)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(query.Result))
}

// swagger:route GET /alert-notifications/uid/{notification_channel_uid} legacy_alerts_notification_channels getAlertNotificationChannelByUID
//
// Get notification channel by UID.
//
// Returns the notification channel given the notification channel UID.
//
// Responses:
// 200: getAlertNotificationChannelResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetAlertNotificationByUID(c *models.ReqContext) response.Response {
	query := &models.GetAlertNotificationsWithUidQuery{
		OrgId: c.OrgID,
		Uid:   web.Params(c.Req)[":uid"],
	}

	if query.Uid == "" {
		return response.Error(404, "Alert notification not found", nil)
	}

	if err := hs.AlertNotificationService.GetAlertNotificationsWithUid(c.Req.Context(), query); err != nil {
		return response.Error(500, "Failed to get alert notifications", err)
	}

	if query.Result == nil {
		return response.Error(404, "Alert notification not found", nil)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(query.Result))
}

// swagger:route POST /alert-notifications legacy_alerts_notification_channels createAlertNotificationChannel
//
// Create notification channel.
//
// You can find the full list of [supported notifiers](https://grafana.com/docs/grafana/latest/alerting/old-alerting/notifications/#list-of-supported-notifiers) on the alert notifiers page.
//
// Responses:
// 200: getAlertNotificationChannelResponse
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) CreateAlertNotification(c *models.ReqContext) response.Response {
	cmd := models.CreateAlertNotificationCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgID

	if err := hs.AlertNotificationService.CreateAlertNotificationCommand(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationWithSameNameExists) || errors.Is(err, models.ErrAlertNotificationWithSameUIDExists) {
			return response.Error(409, "Failed to create alert notification", err)
		}
		var alertingErr alerting.ValidationError
		if errors.As(err, &alertingErr) {
			return response.Error(400, err.Error(), err)
		}
		return response.Error(500, "Failed to create alert notification", err)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(cmd.Result))
}

// swagger:route PUT /alert-notifications/{notification_channel_id} legacy_alerts_notification_channels updateAlertNotificationChannel
//
// Update notification channel by ID.
//
// Updates an existing notification channel identified by ID.
//
// Responses:
// 200: getAlertNotificationChannelResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) UpdateAlertNotification(c *models.ReqContext) response.Response {
	cmd := models.UpdateAlertNotificationCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgID

	err := hs.fillWithSecureSettingsData(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to update alert notification", err)
	}

	if err := hs.AlertNotificationService.UpdateAlertNotification(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationNotFound) {
			return response.Error(404, err.Error(), err)
		}
		var alertingErr alerting.ValidationError
		if errors.As(err, &alertingErr) {
			return response.Error(400, err.Error(), err)
		}
		return response.Error(500, "Failed to update alert notification", err)
	}

	query := models.GetAlertNotificationsQuery{
		OrgId: c.OrgID,
		Id:    cmd.Id,
	}

	if err := hs.AlertNotificationService.GetAlertNotifications(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get alert notification", err)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(query.Result))
}

// swagger:route PUT /alert-notifications/uid/{notification_channel_uid} legacy_alerts_notification_channels updateAlertNotificationChannelByUID
//
// Update notification channel by UID.
//
// Updates an existing notification channel identified by uid.
//
// Responses:
// 200: getAlertNotificationChannelResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) UpdateAlertNotificationByUID(c *models.ReqContext) response.Response {
	cmd := models.UpdateAlertNotificationWithUidCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgID
	cmd.Uid = web.Params(c.Req)[":uid"]

	err := hs.fillWithSecureSettingsDataByUID(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to update alert notification", err)
	}

	if err := hs.AlertNotificationService.UpdateAlertNotificationWithUid(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationNotFound) {
			return response.Error(404, err.Error(), nil)
		}
		return response.Error(500, "Failed to update alert notification", err)
	}

	query := models.GetAlertNotificationsWithUidQuery{
		OrgId: cmd.OrgId,
		Uid:   cmd.Uid,
	}

	if err := hs.AlertNotificationService.GetAlertNotificationsWithUid(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get alert notification", err)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(query.Result))
}

func (hs *HTTPServer) fillWithSecureSettingsData(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) error {
	if len(cmd.SecureSettings) == 0 {
		return nil
	}

	query := &models.GetAlertNotificationsQuery{
		OrgId: cmd.OrgId,
		Id:    cmd.Id,
	}

	if err := hs.AlertNotificationService.GetAlertNotifications(ctx, query); err != nil {
		return err
	}

	secureSettings, err := hs.EncryptionService.DecryptJsonData(ctx, query.Result.SecureSettings, setting.SecretKey)
	if err != nil {
		return err
	}

	for k, v := range secureSettings {
		if _, ok := cmd.SecureSettings[k]; !ok {
			cmd.SecureSettings[k] = v
		}
	}

	return nil
}

func (hs *HTTPServer) fillWithSecureSettingsDataByUID(ctx context.Context, cmd *models.UpdateAlertNotificationWithUidCommand) error {
	if len(cmd.SecureSettings) == 0 {
		return nil
	}

	query := &models.GetAlertNotificationsWithUidQuery{
		OrgId: cmd.OrgId,
		Uid:   cmd.Uid,
	}

	if err := hs.AlertNotificationService.GetAlertNotificationsWithUid(ctx, query); err != nil {
		return err
	}

	secureSettings, err := hs.EncryptionService.DecryptJsonData(ctx, query.Result.SecureSettings, setting.SecretKey)
	if err != nil {
		return err
	}

	for k, v := range secureSettings {
		if _, ok := cmd.SecureSettings[k]; !ok {
			cmd.SecureSettings[k] = v
		}
	}

	return nil
}

// swagger:route DELETE /alert-notifications/{notification_channel_id} legacy_alerts_notification_channels deleteAlertNotificationChannel
//
// Delete alert notification by ID.
//
// Deletes an existing notification channel identified by ID.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteAlertNotification(c *models.ReqContext) response.Response {
	notificationId, err := strconv.ParseInt(web.Params(c.Req)[":notificationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "notificationId is invalid", err)
	}

	cmd := models.DeleteAlertNotificationCommand{
		OrgId: c.OrgID,
		Id:    notificationId,
	}

	if err := hs.AlertNotificationService.DeleteAlertNotification(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationNotFound) {
			return response.Error(404, err.Error(), nil)
		}
		return response.Error(500, "Failed to delete alert notification", err)
	}

	return response.Success("Notification deleted")
}

// swagger:route DELETE /alert-notifications/uid/{notification_channel_uid} legacy_alerts_notification_channels deleteAlertNotificationChannelByUID
//
// Delete alert notification by UID.
//
// Deletes an existing notification channel identified by UID.
//
// Responses:
// 200: deleteAlertNotificationChannelResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteAlertNotificationByUID(c *models.ReqContext) response.Response {
	cmd := models.DeleteAlertNotificationWithUidCommand{
		OrgId: c.OrgID,
		Uid:   web.Params(c.Req)[":uid"],
	}

	if err := hs.AlertNotificationService.DeleteAlertNotificationWithUid(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrAlertNotificationNotFound) {
			return response.Error(404, err.Error(), nil)
		}
		return response.Error(500, "Failed to delete alert notification", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Notification deleted",
		"id":      cmd.DeletedAlertNotificationId,
	})
}

// swagger:route POST /alert-notifications/test legacy_alerts_notification_channels notificationChannelTest
//
// Test notification channel.
//
// Sends a test notification to the channel.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 412: SMTPNotEnabledError
// 500: internalServerError
func (hs *HTTPServer) NotificationTest(c *models.ReqContext) response.Response {
	dto := dtos.NotificationTestCommand{}
	if err := web.Bind(c.Req, &dto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd := &alerting.NotificationTestCommand{
		OrgID:          c.OrgID,
		ID:             dto.ID,
		Name:           dto.Name,
		Type:           dto.Type,
		Settings:       dto.Settings,
		SecureSettings: dto.SecureSettings,
	}

	if err := hs.AlertNotificationService.HandleNotificationTestCommand(c.Req.Context(), cmd); err != nil {
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

// swagger:route POST /alerts/{alert_id}/pause legacy_alerts pauseAlert
//
// Pause/unpause alert by id.
//
// Responses:
// 200: pauseAlertResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) PauseAlert(legacyAlertingEnabled *bool) func(c *models.ReqContext) response.Response {
	if legacyAlertingEnabled == nil || !*legacyAlertingEnabled {
		return func(_ *models.ReqContext) response.Response {
			return response.Error(http.StatusBadRequest, "legacy alerting is disabled, so this call has no effect.", nil)
		}
	}

	return func(c *models.ReqContext) response.Response {
		dto := dtos.PauseAlertCommand{}
		if err := web.Bind(c.Req, &dto); err != nil {
			return response.Error(http.StatusBadRequest, "bad request data", err)
		}
		alertID, err := strconv.ParseInt(web.Params(c.Req)[":alertId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "alertId is invalid", err)
		}
		result := make(map[string]interface{})
		result["alertId"] = alertID

		query := models.GetAlertByIdQuery{Id: alertID}
		if err := hs.AlertEngine.AlertStore.GetAlertById(c.Req.Context(), &query); err != nil {
			return response.Error(500, "Get Alert failed", err)
		}

		guardian := guardian.New(c.Req.Context(), query.Result.DashboardId, c.OrgID, c.SignedInUser)
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
			return response.JSON(http.StatusOK, result)
		} else if query.Result.State == models.AlertStatePaused && dto.Paused {
			result["state"] = models.AlertStatePaused
			result["message"] = "Alert is already paused"
			return response.JSON(http.StatusOK, result)
		}

		cmd := models.PauseAlertCommand{
			OrgId:    c.OrgID,
			AlertIds: []int64{alertID},
			Paused:   dto.Paused,
		}

		if err := hs.AlertEngine.AlertStore.PauseAlert(c.Req.Context(), &cmd); err != nil {
			return response.Error(500, "", err)
		}

		resp := models.AlertStateUnknown
		pausedState := "un-paused"
		if cmd.Paused {
			resp = models.AlertStatePaused
			pausedState = "paused"
		}

		result["state"] = resp
		result["message"] = "Alert " + pausedState
		return response.JSON(http.StatusOK, result)
	}
}

// swagger:route POST /admin/pause-all-alerts admin pauseAllAlerts
//
// Pause/unpause all (legacy) alerts.
//
// Security:
// - basic:
//
// Responses:
// 200: pauseAlertsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) PauseAllAlerts(legacyAlertingEnabled *bool) func(c *models.ReqContext) response.Response {
	if legacyAlertingEnabled == nil || !*legacyAlertingEnabled {
		return func(_ *models.ReqContext) response.Response {
			return response.Error(http.StatusBadRequest, "legacy alerting is disabled, so this call has no effect.", nil)
		}
	}

	return func(c *models.ReqContext) response.Response {
		dto := dtos.PauseAllAlertsCommand{}
		if err := web.Bind(c.Req, &dto); err != nil {
			return response.Error(http.StatusBadRequest, "bad request data", err)
		}
		updateCmd := models.PauseAllAlertCommand{
			Paused: dto.Paused,
		}

		if err := hs.AlertEngine.AlertStore.PauseAllAlerts(c.Req.Context(), &updateCmd); err != nil {
			return response.Error(500, "Failed to pause alerts", err)
		}

		resp := models.AlertStatePending
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

		return response.JSON(http.StatusOK, result)
	}
}

// swagger:parameters pauseAllAlerts
type PauseAllAlertsParams struct {
	// in:body
	// required:true
	Body dtos.PauseAllAlertsCommand `json:"body"`
}

// swagger:parameters deleteAlertNotificationChannel
type DeleteAlertNotificationChannelParams struct {
	// in:path
	// required:true
	NotificationID int64 `json:"notification_channel_id"`
}

// swagger:parameters getAlertNotificationChannelByID
type GetAlertNotificationChannelByIDParams struct {
	// in:path
	// required:true
	NotificationID int64 `json:"notification_channel_id"`
}

// swagger:parameters deleteAlertNotificationChannelByUID
type DeleteAlertNotificationChannelByUIDParams struct {
	// in:path
	// required:true
	NotificationUID string `json:"notification_channel_uid"`
}

// swagger:parameters getAlertNotificationChannelByUID
type GetAlertNotificationChannelByUIDParams struct {
	// in:path
	// required:true
	NotificationUID string `json:"notification_channel_uid"`
}

// swagger:parameters notificationChannelTest
type NotificationChannelTestParams struct {
	// in:body
	// required:true
	Body dtos.NotificationTestCommand `json:"body"`
}

// swagger:parameters createAlertNotificationChannel
type CreateAlertNotificationChannelParams struct {
	// in:body
	// required:true
	Body models.CreateAlertNotificationCommand `json:"body"`
}

// swagger:parameters updateAlertNotificationChannel
type UpdateAlertNotificationChannelParams struct {
	// in:body
	// required:true
	Body models.UpdateAlertNotificationCommand `json:"body"`
	// in:path
	// required:true
	NotificationID int64 `json:"notification_channel_id"`
}

// swagger:parameters updateAlertNotificationChannelByUID
type UpdateAlertNotificationChannelByUIDParams struct {
	// in:body
	// required:true
	Body models.UpdateAlertNotificationWithUidCommand `json:"body"`
	// in:path
	// required:true
	NotificationUID string `json:"notification_channel_uid"`
}

// swagger:parameters getAlertByID
type GetAlertByIDParams struct {
	// in:path
	// required:true
	AlertID string `json:"alert_id"`
}

// swagger:parameters pauseAlert
type PauseAlertParams struct {
	// in:path
	// required:true
	AlertID string `json:"alert_id"`
	// in:body
	// required:true
	Body dtos.PauseAlertCommand `json:"body"`
}

// swagger:parameters getAlerts
type GetAlertsParams struct {
	// Limit response to alerts in specified dashboard(s). You can specify multiple dashboards.
	// in:query
	// required:false
	DashboardID []string `json:"dashboardId"`
	//  Limit response to alert for a specified panel on a dashboard.
	// in:query
	// required:false
	PanelID int64 `json:"panelId"`
	// Limit response to alerts having a name like this value.
	// in:query
	// required: false
	Query string `json:"query"`
	// Return alerts with one or more of the following alert states
	// in:query
	// required:false
	// Description:
	// * `all`
	// * `no_data`
	// * `paused`
	// * `alerting`
	// * `ok`
	// * `pending`
	// * `unknown`
	// enum: all,no_data,paused,alerting,ok,pending,unknown
	State string `json:"state"`
	// Limit response to X number of alerts.
	// in:query
	// required:false
	Limit int64 `json:"limit"`
	// Limit response to alerts of dashboards in specified folder(s). You can specify multiple folders
	// in:query
	// required:false
	// type array
	// collectionFormat: multi
	FolderID []string `json:"folderId"`
	// Limit response to alerts having a dashboard name like this value./ Limit response to alerts having a dashboard name like this value.
	// in:query
	// required:false
	DashboardQuery string `json:"dashboardQuery"`
	// Limit response to alerts of dashboards with specified tags. To do an “AND” filtering with multiple tags, specify the tags parameter multiple times
	// in:query
	// required:false
	// type: array
	// collectionFormat: multi
	DashboardTag []string `json:"dashboardTag"`
}

// swagger:parameters testAlert
type TestAlertParams struct {
	// in:body
	Body dtos.AlertTestCommand `json:"body"`
}

// swagger:parameters getDashboardStates
type GetDashboardStatesParams struct {
	// in:query
	// required: true
	DashboardID int64 `json:"dashboardId"`
}

// swagger:response pauseAlertsResponse
type PauseAllAlertsResponse struct {
	// in:body
	Body struct {
		// AlertsAffected is the number of the affected alerts.
		// required: true
		AlertsAffected int64 `json:"alertsAffected"`
		// required: true
		Message string `json:"message"`
		// Alert result state
		// required true
		State string `json:"state"`
	} `json:"body"`
}

// swagger:response getAlertNotificationChannelsResponse
type GetAlertNotificationChannelsResponse struct {
	// The response message
	// in: body
	Body []*dtos.AlertNotification `json:"body"`
}

// swagger:response getAlertNotificationLookupResponse
type LookupAlertNotificationChannelsResponse struct {
	// The response message
	// in: body
	Body []*dtos.AlertNotificationLookup `json:"body"`
}

// swagger:response getAlertNotificationChannelResponse
type GetAlertNotificationChannelResponse struct {
	// The response message
	// in: body
	Body *dtos.AlertNotification `json:"body"`
}

// swagger:response deleteAlertNotificationChannelResponse
type DeleteAlertNotificationChannelResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the deleted notification channel.
		// required: true
		// example: 65
		ID int64 `json:"id"`

		// Message Message of the deleted notificatiton channel.
		// required: true
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:response SMTPNotEnabledError
type SMTPNotEnabledError PreconditionFailedError

// swagger:response getAlertsResponse
type GetAlertsResponse struct {
	// The response message
	// in: body
	Body []*models.AlertListItemDTO `json:"body"`
}

// swagger:response getAlertResponse
type GetAlertResponse struct {
	// The response message
	// in: body
	Body *models.Alert `json:"body"`
}

// swagger:response pauseAlertResponse
type PauseAlertResponse struct {
	// in:body
	Body struct {
		// required: true
		AlertID int64 `json:"alertId"`
		// required: true
		Message string `json:"message"`
		// Alert result state
		// required true
		State string `json:"state"`
	} `json:"body"`
}

// swagger:response testAlertResponse
type TestAlertResponse struct {
	// The response message
	// in: body
	Body *dtos.AlertTestResult `json:"body"`
}

// swagger:response getDashboardStatesResponse
type GetDashboardStatesResponse struct {
	// The response message
	// in: body
	Body []*models.AlertStateInfoDTO `json:"body"`
}
