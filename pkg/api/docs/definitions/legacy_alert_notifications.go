package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

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

// swagger:route GET /alert-notifications/lookup legacy_alerts_notification_channels lookupAlertNotificationChannels
//
// Get all notification channels (lookup)
//
// Returns all notification channels, but with less detailed information. Accessible by any authenticated user and is mainly used by providing alert notification channels in Grafana UI when configuring alert rule.
//
// Responses:
// 200: lookupAlertNotificationChannelsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

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

// swagger:route GET /alert-notifications/uid/{notification_channel_uid} legacy_alerts_notification_channels getAlertNotificationChannelByUID
//
// Get notification channel by UID
//
// Returns the notification channel given the notification channel UID.
//
// Responses:
// 200: getAlertNotificationChannelResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

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
type UpdateAlertNotificationChannelBYUIDParams struct {
	// in:body
	// required:true
	Body models.UpdateAlertNotificationWithUidCommand `json:"body"`
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

// swagger:response lookupAlertNotificationChannelsResponse
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
