// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type CreateNotificationsqueryalertsNotificationEntryAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt"`
	Enrichments interface{}       `json:"enrichments,omitempty"`
}

// NewCreateNotificationsqueryalertsNotificationEntryAlert creates a new CreateNotificationsqueryalertsNotificationEntryAlert object.
func NewCreateNotificationsqueryalertsNotificationEntryAlert() *CreateNotificationsqueryalertsNotificationEntryAlert {
	return &CreateNotificationsqueryalertsNotificationEntryAlert{
		Labels:      map[string]string{},
		Annotations: map[string]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationsqueryalertsNotificationEntryAlert.
func (CreateNotificationsqueryalertsNotificationEntryAlert) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationsqueryalertsNotificationEntryAlert"
}

// +k8s:openapi-gen=true
type CreateNotificationsqueryalertsResponse struct {
	Alerts []CreateNotificationsqueryalertsNotificationEntryAlert `json:"alerts"`
}

// NewCreateNotificationsqueryalertsResponse creates a new CreateNotificationsqueryalertsResponse object.
func NewCreateNotificationsqueryalertsResponse() *CreateNotificationsqueryalertsResponse {
	return &CreateNotificationsqueryalertsResponse{
		Alerts: []CreateNotificationsqueryalertsNotificationEntryAlert{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationsqueryalertsResponse.
func (CreateNotificationsqueryalertsResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationsqueryalertsResponse"
}
