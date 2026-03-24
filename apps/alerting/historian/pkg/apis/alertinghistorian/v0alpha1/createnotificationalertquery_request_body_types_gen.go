// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

type CreateNotificationAlertQueryRequestBody struct {
	// From is the starting timestamp for the query.
	From *time.Time `json:"from,omitempty"`
	// To is the ending timestamp for the query.
	To *time.Time `json:"to,omitempty"`
	// UUID filters the alerts to those belonging to a specific alert rule.
	Uuid *string `json:"uuid,omitempty"`
	// Limit is the maximum number of entries to return.
	Limit *int64 `json:"limit,omitempty"`
}

// NewCreateNotificationAlertQueryRequestBody creates a new CreateNotificationAlertQueryRequestBody object.
func NewCreateNotificationAlertQueryRequestBody() *CreateNotificationAlertQueryRequestBody {
	return &CreateNotificationAlertQueryRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationAlertQueryRequestBody.
func (CreateNotificationAlertQueryRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationAlertQueryRequestBody"
}
