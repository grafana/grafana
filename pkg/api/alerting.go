package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/alerting"
	alertmodels "github.com/grafana/grafana/pkg/services/alerting/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetAlertNotifiers() func(*contextmodel.ReqContext) response.Response {
	return func(_ *contextmodel.ReqContext) response.Response {
		return response.JSON(http.StatusOK, channels_config.GetAvailableNotifiers())
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
func (hs *HTTPServer) GetAlertNotificationLookup(c *contextmodel.ReqContext) response.Response {
	alertNotifications, err := hs.getAlertNotificationsInternal(c)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get alert notifications", err)
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
func (hs *HTTPServer) GetAlertNotifications(c *contextmodel.ReqContext) response.Response {
	alertNotifications, err := hs.getAlertNotificationsInternal(c)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get alert notifications", err)
	}

	result := make([]*dtos.AlertNotification, 0)

	for _, notification := range alertNotifications {
		result = append(result, dtos.NewAlertNotification(notification))
	}

	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) getAlertNotificationsInternal(c *contextmodel.ReqContext) ([]*alertmodels.AlertNotification, error) {
	query := &alertmodels.GetAllAlertNotificationsQuery{OrgID: c.SignedInUser.GetOrgID()}
	return hs.AlertNotificationService.GetAllAlertNotifications(c.Req.Context(), query)
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
func (hs *HTTPServer) GetAlertNotificationByID(c *contextmodel.ReqContext) response.Response {
	notificationId, err := strconv.ParseInt(web.Params(c.Req)[":notificationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "notificationId is invalid", err)
	}
	query := &alertmodels.GetAlertNotificationsQuery{
		OrgID: c.SignedInUser.GetOrgID(),
		ID:    notificationId,
	}

	if query.ID == 0 {
		return response.Error(http.StatusNotFound, "Alert notification not found", nil)
	}

	res, err := hs.AlertNotificationService.GetAlertNotifications(c.Req.Context(), query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get alert notifications", err)
	}

	if res == nil {
		return response.Error(http.StatusNotFound, "Alert notification not found", nil)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(res))
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
func (hs *HTTPServer) GetAlertNotificationByUID(c *contextmodel.ReqContext) response.Response {
	query := &alertmodels.GetAlertNotificationsWithUidQuery{
		OrgID: c.SignedInUser.GetOrgID(),
		UID:   web.Params(c.Req)[":uid"],
	}

	if query.UID == "" {
		return response.Error(http.StatusNotFound, "Alert notification not found", nil)
	}

	res, err := hs.AlertNotificationService.GetAlertNotificationsWithUid(c.Req.Context(), query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get alert notifications", err)
	}

	if res == nil {
		return response.Error(http.StatusNotFound, "Alert notification not found", nil)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(res))
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
func (hs *HTTPServer) CreateAlertNotification(c *contextmodel.ReqContext) response.Response {
	cmd := alertmodels.CreateAlertNotificationCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.SignedInUser.GetOrgID()

	res, err := hs.AlertNotificationService.CreateAlertNotificationCommand(c.Req.Context(), &cmd)
	if err != nil {
		if errors.Is(err, alertmodels.ErrAlertNotificationWithSameNameExists) || errors.Is(err, alertmodels.ErrAlertNotificationWithSameUIDExists) {
			return response.Error(http.StatusConflict, "Failed to create alert notification", err)
		}
		var alertingErr alerting.ValidationError
		if errors.As(err, &alertingErr) {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to create alert notification", err)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(res))
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
func (hs *HTTPServer) UpdateAlertNotification(c *contextmodel.ReqContext) response.Response {
	cmd := alertmodels.UpdateAlertNotificationCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.SignedInUser.GetOrgID()

	err := hs.fillWithSecureSettingsData(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update alert notification", err)
	}

	if _, err := hs.AlertNotificationService.UpdateAlertNotification(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, alertmodels.ErrAlertNotificationNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), err)
		}
		var alertingErr alerting.ValidationError
		if errors.As(err, &alertingErr) {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update alert notification", err)
	}

	query := alertmodels.GetAlertNotificationsQuery{
		OrgID: c.SignedInUser.GetOrgID(),
		ID:    cmd.ID,
	}

	res, err := hs.AlertNotificationService.GetAlertNotifications(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get alert notification", err)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(res))
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
func (hs *HTTPServer) UpdateAlertNotificationByUID(c *contextmodel.ReqContext) response.Response {
	cmd := alertmodels.UpdateAlertNotificationWithUidCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.SignedInUser.GetOrgID()
	cmd.UID = web.Params(c.Req)[":uid"]

	err := hs.fillWithSecureSettingsDataByUID(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update alert notification", err)
	}

	if _, err := hs.AlertNotificationService.UpdateAlertNotificationWithUid(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, alertmodels.ErrAlertNotificationNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update alert notification", err)
	}

	query := alertmodels.GetAlertNotificationsWithUidQuery{
		OrgID: cmd.OrgID,
		UID:   cmd.UID,
	}

	res, err := hs.AlertNotificationService.GetAlertNotificationsWithUid(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get alert notification", err)
	}

	return response.JSON(http.StatusOK, dtos.NewAlertNotification(res))
}

func (hs *HTTPServer) fillWithSecureSettingsData(ctx context.Context, cmd *alertmodels.UpdateAlertNotificationCommand) error {
	if len(cmd.SecureSettings) == 0 {
		return nil
	}

	query := &alertmodels.GetAlertNotificationsQuery{
		OrgID: cmd.OrgID,
		ID:    cmd.ID,
	}

	res, err := hs.AlertNotificationService.GetAlertNotifications(ctx, query)
	if err != nil {
		return err
	}

	secureSettings, err := hs.EncryptionService.DecryptJsonData(ctx, res.SecureSettings, hs.Cfg.SecretKey)
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

func (hs *HTTPServer) fillWithSecureSettingsDataByUID(ctx context.Context, cmd *alertmodels.UpdateAlertNotificationWithUidCommand) error {
	if len(cmd.SecureSettings) == 0 {
		return nil
	}

	query := &alertmodels.GetAlertNotificationsWithUidQuery{
		OrgID: cmd.OrgID,
		UID:   cmd.UID,
	}

	res, err := hs.AlertNotificationService.GetAlertNotificationsWithUid(ctx, query)
	if err != nil {
		return err
	}

	secureSettings, err := hs.EncryptionService.DecryptJsonData(ctx, res.SecureSettings, hs.Cfg.SecretKey)
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
func (hs *HTTPServer) DeleteAlertNotification(c *contextmodel.ReqContext) response.Response {
	notificationId, err := strconv.ParseInt(web.Params(c.Req)[":notificationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "notificationId is invalid", err)
	}

	cmd := alertmodels.DeleteAlertNotificationCommand{
		OrgID: c.SignedInUser.GetOrgID(),
		ID:    notificationId,
	}

	if err := hs.AlertNotificationService.DeleteAlertNotification(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, alertmodels.ErrAlertNotificationNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete alert notification", err)
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
func (hs *HTTPServer) DeleteAlertNotificationByUID(c *contextmodel.ReqContext) response.Response {
	cmd := alertmodels.DeleteAlertNotificationWithUidCommand{
		OrgID: c.SignedInUser.GetOrgID(),
		UID:   web.Params(c.Req)[":uid"],
	}

	if err := hs.AlertNotificationService.DeleteAlertNotificationWithUid(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, alertmodels.ErrAlertNotificationNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete alert notification", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Notification deleted",
		"id":      cmd.DeletedAlertNotificationID,
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
func (hs *HTTPServer) NotificationTest(c *contextmodel.ReqContext) response.Response {
	dto := dtos.NotificationTestCommand{}
	if err := web.Bind(c.Req, &dto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd := &alerting.NotificationTestCommand{
		OrgID:          c.SignedInUser.GetOrgID(),
		ID:             dto.ID,
		Name:           dto.Name,
		Type:           dto.Type,
		Settings:       dto.Settings,
		SecureSettings: dto.SecureSettings,
	}

	if err := hs.AlertNotificationService.HandleNotificationTestCommand(c.Req.Context(), cmd); err != nil {
		if errors.Is(err, notifications.ErrSmtpNotEnabled) {
			return response.Error(http.StatusPreconditionFailed, err.Error(), err)
		}
		var alertingErr alerting.ValidationError
		if errors.As(err, &alertingErr) {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to send alert notifications", err)
	}

	return response.Success("Test notification sent")
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
	Body alertmodels.CreateAlertNotificationCommand `json:"body"`
}

// swagger:parameters updateAlertNotificationChannel
type UpdateAlertNotificationChannelParams struct {
	// in:body
	// required:true
	Body alertmodels.UpdateAlertNotificationCommand `json:"body"`
	// in:path
	// required:true
	NotificationID int64 `json:"notification_channel_id"`
}

// swagger:parameters updateAlertNotificationChannelByUID
type UpdateAlertNotificationChannelByUIDParams struct {
	// in:body
	// required:true
	Body alertmodels.UpdateAlertNotificationWithUidCommand `json:"body"`
	// in:path
	// required:true
	NotificationUID string `json:"notification_channel_uid"`
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
